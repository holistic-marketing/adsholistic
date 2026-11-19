"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useIsClient } from "@/hooks/useIsClient";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { Note, PropList, ToneBadge } from "@/components/ui/PanelKit";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import { useAppFormatter } from "@/lib/i18n/use-app-formatter";
import type { AdAccountLiveMetricsClient } from "@/features/ad-accounts/hooks/useAdAccountLiveMetrics";
import type { PaymentAccountAllocation } from "@/types/payment";
import {
  PaymentAmountInput,
  PaymentDialogBody,
  PaymentDialogFooter,
  PaymentDialogFrame,
  PaymentDialogHeader,
  PaymentFieldHint,
  PaymentFieldLabel,
} from "./PaymentDialog";

interface TransferBalanceModalProps {
  sourceAccount: PaymentAccountAllocation | null;
  allAccounts: PaymentAccountAllocation[];
  open: boolean;
  onClose: () => void;
  agencyBmFunding?: boolean;
  allowForceLedger?: boolean;
  /** Copy para cliente final (no gerente). */
  clientSelfService?: boolean;
  /** Refresca saldo TikTok en vivo (sin F5). */
  onFundingChanged?: () => void | Promise<void>;
  liveMetricsByAdvertiser?: Record<string, AdAccountLiveMetricsClient>;
}

interface TransferResponse {
  ok: boolean;
  amountUsd: number;
  requestedAmountUsd: number;
  fromAccountName: string;
  toAccountName: string;
  reclaimPath: string;
}

function friendlyTransferError(raw: string, fallback: string): string {
  const text = raw.trim();
  if (text.length <= 280 && !/\| bc=/.test(text)) return text;
  if (/cartera holistic/i.test(text)) return text;
  return fallback;
}

export function TransferBalanceModal({
  sourceAccount,
  open,
  ...props
}: TransferBalanceModalProps) {
  const mounted = useIsClient();
  if (!open || !sourceAccount || !mounted) return null;
  // El cuerpo solo existe mientras está abierto: monto y destino se fijan al abrir y el
  // polling del saldo en vivo ya no pisa lo escrito ni borra el mensaje de éxito.
  return (
    <TransferBalanceModalBody
      key={sourceAccount.id}
      sourceAccount={sourceAccount}
      {...props}
    />
  );
}

function TransferBalanceModalBody({
  sourceAccount,
  allAccounts,
  onClose,
  agencyBmFunding = false,
  allowForceLedger = false,
  clientSelfService = false,
  onFundingChanged,
  liveMetricsByAdvertiser,
}: Omit<TransferBalanceModalProps, "open" | "sourceAccount"> & {
  sourceAccount: PaymentAccountAllocation;
}) {
  const router = useRouter();
  const t = useTranslations("payments");
  const tCommon = useTranslations("common");
  const { formatMoney } = useAppFormatter();

  const destinationOptions = useMemo(
    () =>
      allAccounts.filter(
        (a) =>
          a.id !== sourceAccount.id &&
          a.status !== "disabled" &&
          Number(a.balance) >= 0,
      ),
    [allAccounts, sourceAccount.id],
  );

  // Máximo transferible: se recalcula en cada render (validación siempre al día).
  const sourceLiveUsd =
    liveMetricsByAdvertiser?.[sourceAccount.externalAccountId?.trim() ?? ""]
      ?.balanceUsd;
  const maxAmount = Math.max(
    0,
    sourceLiveUsd != null && Number.isFinite(sourceLiveUsd)
      ? sourceLiveUsd
      : Number(sourceAccount.balance) || 0,
  );

  // Valores iniciales: solo al abrir (misma fórmula que el efecto anterior).
  const [toAccountId, setToAccountId] = useState(() => destinationOptions[0]?.id ?? "");
  const [amount, setAmount] = useState(() => (maxAmount > 0 ? String(maxAmount) : ""));
  const [forceLedgerOnly, setForceLedgerOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const parsed = Number.parseFloat(amount);
  const isValid =
    Boolean(toAccountId) &&
    Number.isFinite(parsed) &&
    parsed > 0 &&
    parsed <= maxAmount + 1e-9;

  const destAccount = destinationOptions.find((a) => a.id === toAccountId);

  function resetAndClose() {
    setAmount("");
    setToAccountId("");
    setError(null);
    setSuccess(null);
    setLoading(false);
    setForceLedgerOnly(false);
    onClose();
  }

  async function handleSubmit() {
    if (destinationOptions.length === 0) {
      setError(t("transferModal.noTarget"));
      return;
    }
    if (!isValid) {
      setError(
        maxAmount <= 0
          ? t("transferModal.errNoTransferable")
          : t("transferModal.errAmountRange", {
              max: formatMoney(maxAmount),
            }),
      );
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiClient<TransferResponse>("/api/payments/transfer", {
        method: "POST",
        body: JSON.stringify({
          fromAdAccountId: sourceAccount!.id,
          toAdAccountId: toAccountId,
          amount: parsed,
          agencyBmFunding,
          forceLedgerOnly: allowForceLedger ? forceLedgerOnly : false,
        }),
      });
      const partial =
        res.requestedAmountUsd > res.amountUsd + 1e-9
          ? t("transferModal.partialNote", {
              allowed: formatMoney(res.amountUsd),
              requested: formatMoney(res.requestedAmountUsd),
            })
          : "";
      setSuccess(
        t("transferModal.success", {
          amount: formatMoney(res.amountUsd),
          from: res.fromAccountName,
          to: res.toAccountName,
          partial,
        }),
      );
      router.refresh();
      await onFundingChanged?.();
    } catch (err) {
      setError(
        friendlyTransferError(
          err instanceof ApiClientError
            ? err.message
            : t("transferModal.errGeneric"),
          t("transferModal.errFriendly"),
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  const closeLabel = t("transferModal.closeAria");

  return createPortal(
    <PaymentDialogFrame
      onDismiss={resetAndClose}
      dismissLabel={closeLabel}
      labelledBy="transfer-balance-title"
    >
      <PaymentDialogHeader
        titleId="transfer-balance-title"
        title={
          clientSelfService
            ? t("transferModal.titleLong")
            : t("transferModal.title")
        }
        description={
          clientSelfService
            ? t("transferModal.bodyClient")
            : t("transferModal.bodyStaff")
        }
        onClose={resetAndClose}
        closeLabel={closeLabel}
      />

      <PaymentDialogBody className="space-y-4">
        <div>
          <PropList
            items={[
              {
                label: t("transferModal.from"),
                value: (
                  <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
                    <span className="break-words">{sourceAccount.name}</span>
                    {sourceAccount.bmLabel ? (
                      <ToneBadge tone="info">{sourceAccount.bmLabel}</ToneBadge>
                    ) : null}
                  </span>
                ),
              },
              {
                label: t("transferModal.transferable"),
                value: <span className="num">{formatMoney(maxAmount)}</span>,
              },
            ]}
          />
          {sourceLiveUsd != null &&
          Math.abs(sourceLiveUsd - Number(sourceAccount.balance)) > 0.5 ? (
            <p className="num mt-2 text-xs text-ink-3">
              {t("transferModal.holisticAssigned", {
                amount: formatMoney(sourceAccount.balance),
              })}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-warn-fg">
            {t("transferModal.statusPrefix", {
              status:
                sourceAccount.status === "disabled"
                  ? t("transferModal.statusSuspendedTransfer")
                  : sourceAccount.status,
            })}
          </p>
        </div>

        <div>
          <PaymentFieldLabel htmlFor="transfer-dest">
            {t("transferModal.to")}
          </PaymentFieldLabel>
          {destinationOptions.length === 0 ? (
            <Note tone="warn">{t("transferModal.noTarget")}</Note>
          ) : (
            <Select
              id="transfer-dest"
              value={toAccountId}
              onChange={(e) => setToAccountId(e.target.value)}
            >
              {destinationOptions.map((account) => {
                const destLive =
                  liveMetricsByAdvertiser?.[
                    account.externalAccountId?.trim() ?? ""
                  ]?.balanceUsd;
                return (
                  <option key={account.id} value={account.id}>
                    {account.name}
                    {account.bmLabel ? ` · ${account.bmLabel}` : ""}
                    {" · "}
                    {formatMoney(
                      destLive != null ? destLive : account.balance,
                    )}
                  </option>
                );
              })}
            </Select>
          )}
          {destAccount ? (
            <PaymentFieldHint className="break-all font-mono">
              adv {destAccount.externalAccountId?.trim() || "—"}
            </PaymentFieldHint>
          ) : null}
        </div>

        <div>
          <PaymentFieldLabel htmlFor="transfer-amount">
            {t("transferModal.amountLabel")}
          </PaymentFieldLabel>
          <PaymentAmountInput
            id="transfer-amount"
            type="number"
            suffix="USD"
            min={0.01}
            max={maxAmount}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={error ? true : undefined}
            autoFocus
          />
          <PaymentFieldHint>
            {clientSelfService
              ? t("transferModal.maxLiveBalance", {
                  amount: formatMoney(maxAmount),
                })
              : t("transferModal.maxLiveCupo", {
                  amount: formatMoney(maxAmount),
                })}
          </PaymentFieldHint>
        </div>

        {allowForceLedger ? (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-box border border-line bg-field px-3 py-2.5 text-[13px] leading-snug text-ink-2">
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 accent-[var(--ui-accent-btn)]"
              checked={forceLedgerOnly}
              onChange={(e) => setForceLedgerOnly(e.target.checked)}
            />
            <span>
              Solo ledger (staff): si TikTok falla en origen, igual mover en
              Holistic. Usar con cuidado.
            </span>
          </label>
        ) : null}

        {error ? (
          <div role="alert">
            <Note tone="warn">{error}</Note>
          </div>
        ) : null}
        {success ? (
          <div role="status">
            <Note tone="ok" icon="check-circle">
              {success}
            </Note>
          </div>
        ) : null}
      </PaymentDialogBody>

      <PaymentDialogFooter>
        <Button variant="outline" onClick={resetAndClose} disabled={loading}>
          {tCommon("close")}
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={loading || !isValid || destinationOptions.length === 0}
        >
          {loading
            ? t("transferModal.transferring")
            : t("transferModal.cta")}
        </Button>
      </PaymentDialogFooter>
    </PaymentDialogFrame>,
    document.body,
  );
}
