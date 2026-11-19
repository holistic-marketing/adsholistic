"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useIsClient } from "@/hooks/useIsClient";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Note, PropList, ToneBadge } from "@/components/ui/PanelKit";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import { useAppFormatter } from "@/lib/i18n/use-app-formatter";
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

interface ReclaimBalanceModalProps {
  account: PaymentAccountAllocation | null;
  open: boolean;
  onClose: () => void;
  /** Staff: permite forzar solo ledger si TikTok falla. */
  allowForceLedger?: boolean;
  /** Refresca saldo TikTok en vivo (sin F5). */
  onFundingChanged?: () => void | Promise<void>;
}

interface ReclaimResponse {
  ok: boolean;
  amountUsd: number;
  path: string;
}

export function ReclaimBalanceModal({
  account,
  open,
  ...props
}: ReclaimBalanceModalProps) {
  const mounted = useIsClient();
  if (!open || !account || !mounted) return null;
  // El cuerpo solo existe mientras está abierto: el formulario arranca limpio en cada
  // apertura (y con otra cuenta, por la key) sin efecto que lo reinicie.
  return <ReclaimBalanceModalBody key={account.id} account={account} {...props} />;
}

function ReclaimBalanceModalBody({
  account,
  onClose,
  allowForceLedger = false,
  onFundingChanged,
}: Omit<ReclaimBalanceModalProps, "open" | "account"> & {
  account: PaymentAccountAllocation;
}) {
  const router = useRouter();
  const t = useTranslations("payments");
  const tCommon = useTranslations("common");
  const { formatMoney } = useAppFormatter();
  const [amount, setAmount] = useState(() =>
    account.balance > 0 ? String(account.balance) : "",
  );
  const [forceLedgerOnly, setForceLedgerOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const maxAmount = account.balance;
  const parsed = Number.parseFloat(amount);
  const isValid =
    Number.isFinite(parsed) && parsed > 0 && parsed <= maxAmount + 1e-9;

  function resetAndClose() {
    setAmount("");
    setError(null);
    setSuccess(null);
    setLoading(false);
    setForceLedgerOnly(false);
    onClose();
  }

  async function handleSubmit() {
    if (!isValid) {
      setError(
        maxAmount <= 0
          ? t("reclaimModal.none")
          : t("reclaimModal.errAmountRange", {
              max: formatMoney(maxAmount),
            }),
      );
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiClient<ReclaimResponse>("/api/payments/reclaim", {
        method: "POST",
        body: JSON.stringify({
          adAccountId: account!.id,
          amount: parsed,
          forceLedgerOnly: allowForceLedger ? forceLedgerOnly : false,
        }),
      });
      setSuccess(
        t("reclaimModal.success", { amount: formatMoney(res.amountUsd) }),
      );
      router.refresh();
      await onFundingChanged?.();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : t("reclaimModal.errGeneric"),
      );
    } finally {
      setLoading(false);
    }
  }

  const closeLabel = t("reclaimModal.closeAria");

  return createPortal(
    <PaymentDialogFrame
      onDismiss={resetAndClose}
      dismissLabel={closeLabel}
      labelledBy="reclaim-balance-title"
    >
      <PaymentDialogHeader
        titleId="reclaim-balance-title"
        title={t("reclaimModal.title")}
        description={t("reclaimModal.body")}
        onClose={resetAndClose}
        closeLabel={closeLabel}
      />

      <PaymentDialogBody className="space-y-4">
        <div>
          <PropList
            items={[
              {
                label: t("reclaimModal.account"),
                value: (
                  <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
                    <span className="break-words">{account.name}</span>
                    {account.bmLabel ? (
                      <ToneBadge tone="info">{account.bmLabel}</ToneBadge>
                    ) : null}
                  </span>
                ),
              },
              {
                label: t("reclaimModal.balanceOnAccount"),
                value: <span className="num">{formatMoney(account.balance)}</span>,
              },
            ]}
          />
          <p className="mt-2 text-xs text-warn-fg">
            {account.status === "disabled"
              ? t("reclaimModal.statusSuspended")
              : t("reclaimModal.statusPrefix", { status: account.status })}
          </p>
        </div>

        <div>
          <PaymentFieldLabel htmlFor="reclaim-amount">
            {t("reclaimModal.amountLabel")}
          </PaymentFieldLabel>
          <PaymentAmountInput
            id="reclaim-amount"
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
            {t("reclaimModal.maxHint", { amount: formatMoney(maxAmount) })}
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
              Solo ledger (staff): si TikTok falla, igual devolver a cartera
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
        <Button onClick={handleSubmit} disabled={loading || !isValid}>
          {loading
            ? t("reclaimModal.reclaiming")
            : t("reclaimModal.cta")}
        </Button>
      </PaymentDialogFooter>
    </PaymentDialogFrame>,
    document.body,
  );
}
