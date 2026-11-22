"use client";

import { useEffect, useState } from "react";
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
  PaymentCalc,
  PaymentDialogBody,
  PaymentDialogFooter,
  PaymentDialogFrame,
  PaymentDialogHeader,
  PaymentFieldHint,
  PaymentFieldLabel,
} from "./PaymentDialog";

interface AllocateBalanceModalProps {
  account: PaymentAccountAllocation | null;
  open: boolean;
  onClose: () => void;
  /** Passed explicitly from parent (context can break across RSC boundaries). */
  agencyBmFunding?: boolean;
  /** Refresca saldo TikTok en vivo (sin F5). */
  onFundingChanged?: () => void | Promise<void>;
  /** Saldo disponible en cartera Holistic (modo cliente). */
  walletBalance?: number;
  /** Éxito: el padre cierra y muestra banner. */
  onAllocated?: (info: {
    amount: number;
    accountName: string;
    agencyBmFunding: boolean;
  }) => void;
}

interface AllocateResponse {
  ok: boolean;
  journalId: string;
}

/** Quita dumps técnicos (bc=/token=/req=) y deja texto usable. */
function friendlyAllocateError(
  raw: string,
  agencyBmFunding: boolean,
  messages: {
    errMin10: string;
    errBmNoFunds: string;
    errWallet: string;
    errBmMapped: string;
    errAssignMapped: string;
    errBmTikTok: string;
    errAssignTikTok: string;
    errBmFallback: string;
    errAssignFallback: string;
  },
): string {
  const text = raw.trim();
  if (/amountToTransfer|mínimo|minimo|menor al mínimo|al menos \$10/i.test(text)) {
    return messages.errMin10;
  }
  // BM de la agencia sin fondos: es problema nuestro, no del cliente. No se
  // muestran montos del BM; un asesor lo resuelve.
  if (/^Este BM\b|Este Business Center no tiene/i.test(text)) {
    return messages.errBmNoFunds;
  }
  if (
    /no aparece en el BM|rechazó el presupuesto|falta permiso de presupuesto|línea de crédito|crédito compartido|portfolio de crédito|no tiene saldo en efectivo|no tiene cupo disponible|limitó los cambios de presupuesto|FrequencyControl/i.test(
      text,
    )
  ) {
    return text.length <= 280
      ? text
      : agencyBmFunding
        ? messages.errBmMapped
        : messages.errAssignMapped;
  }
  if (/TikTok BC transfer falló|token=agency_env|bc=\d+|adv=\d+|req=/i.test(text)) {
    return agencyBmFunding
      ? messages.errBmTikTok
      : messages.errAssignTikTok;
  }
  // Solo el rechazo real de cartera: varios errores de TikTok terminan en
  // «Tu saldo sigue en la cartera» y no son falta de saldo.
  if (/Insufficient wallet balance/i.test(text)) {
    return messages.errWallet;
  }
  if (text.length <= 220 && !/\| bc=/.test(text)) return text;
  return agencyBmFunding
    ? messages.errBmFallback
    : messages.errAssignFallback;
}

export function AllocateBalanceModal({
  account,
  open,
  ...props
}: AllocateBalanceModalProps) {
  const mounted = useIsClient();
  if (!open || !account || !mounted) return null;
  // El cuerpo solo existe mientras está abierto: el formulario arranca limpio en cada
  // apertura (y con otra cuenta, por la key) sin efecto que lo reinicie.
  return <AllocateBalanceModalBody key={account.id} account={account} {...props} />;
}

function AllocateBalanceModalBody({
  account,
  onClose,
  agencyBmFunding = false,
  onFundingChanged,
  walletBalance = 0,
  onAllocated,
}: Omit<AllocateBalanceModalProps, "open" | "account"> & {
  account: PaymentAccountAllocation;
}) {
  const router = useRouter();
  const t = useTranslations("payments");
  const tCommon = useTranslations("common");
  const { formatMoney } = useAppFormatter();
  // Monto inicial al abrir: misma fórmula que antes (vacío en modo agencia).
  const [amount, setAmount] = useState(() => {
    if (agencyBmFunding) return "";
    const available = Math.max(0, Number(walletBalance) || 0);
    return available > 0 ? String(Math.round(available * 100) / 100) : "";
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const targetAccount = account;
  const parsedAmount = Number.parseFloat(amount);
  const isValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const walletAvailable = Math.max(0, Number(walletBalance) || 0);
  const alreadyOnAccount = Math.max(0, Number(targetAccount.balance) || 0);
  const tiktokMinLabel = formatMoney(10);
  const oneToOneExample = formatMoney(100);

  function resetAndClose() {
    setAmount("");
    setError(null);
    setLoading(false);
    onClose();
  }

  async function handleSubmit() {
    if (!isValidAmount) {
      setError(t("allocateModal.errInvalid"));
      return;
    }

    if (agencyBmFunding && parsedAmount < 10) {
      setError(t("allocateModal.errMin10", { amount: tiktokMinLabel }));
      return;
    }

    if (!agencyBmFunding && parsedAmount > walletAvailable + 1e-9) {
      setError(t("allocateModal.errWallet"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiClient<AllocateResponse>("/api/payments/allocations", {
        method: "POST",
        body: JSON.stringify({
          adAccountId: targetAccount.id,
          amount: parsedAmount,
          currency: "USD",
          agencyBmFunding,
        }),
      });

      // Cerrar ya: refresh live / RSC no debe frenar el UX.
      onAllocated?.({
        amount: parsedAmount,
        accountName: targetAccount.name,
        agencyBmFunding,
      });
      resetAndClose();
      void Promise.resolve(onFundingChanged?.()).finally(() => {
        router.refresh();
      });
    } catch (err) {
      const raw =
        err instanceof ApiClientError
          ? err.message
          : t("allocateModal.errGeneric");
      setError(
        friendlyAllocateError(raw, agencyBmFunding, {
          errMin10: t("allocateModal.errMin10", { amount: tiktokMinLabel }),
          errBmNoFunds: t("allocateModal.errBmNoFunds"),
          errWallet: t("allocateModal.errWallet"),
          errBmMapped: t("allocateModal.errBmMapped"),
          errAssignMapped: t("allocateModal.errAssignMapped"),
          errBmTikTok: t("allocateModal.errBmTikTok"),
          errAssignTikTok: t("allocateModal.errAssignTikTok"),
          errBmFallback: t("allocateModal.errBmFallback"),
          errAssignFallback: t("allocateModal.errAssignFallback"),
        }),
      );
    } finally {
      setLoading(false);
    }
  }

  const closeLabel = t("allocateModal.closeAria");
  const advertiserId = targetAccount.externalAccountId?.trim();

  return createPortal(
    <PaymentDialogFrame
      onDismiss={resetAndClose}
      dismissLabel={closeLabel}
      labelledBy="allocate-balance-title"
    >
      <PaymentDialogHeader
        titleId="allocate-balance-title"
        title={
          agencyBmFunding
            ? t("allocateModal.titleBm")
            : t("allocateModal.title")
        }
        description={
          agencyBmFunding
            ? t("allocateModal.bodyBm")
            : t("allocateModal.body")
        }
        onClose={resetAndClose}
        closeLabel={closeLabel}
      />

      <PaymentDialogBody className="space-y-4">
        <div>
          <PropList
            items={[
              {
                label: t("allocateModal.account"),
                value: (
                  <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
                    <span className="break-words">{targetAccount.name}</span>
                    {targetAccount.bmLabel ? (
                      <ToneBadge tone="info">{targetAccount.bmLabel}</ToneBadge>
                    ) : null}
                  </span>
                ),
              },
              {
                label: t("allocateModal.advertiserLabel").replace(/:\s*$/, ""),
                value: advertiserId ? (
                  <span className="font-mono text-xs">{advertiserId}</span>
                ) : (
                  <span className="text-danger-fg">
                    {t("allocateModal.notConfigured")}
                  </span>
                ),
              },
            ]}
          />
          {agencyBmFunding ? (
            <p className="num mt-2 text-xs text-ink-3">
              {t("allocateModal.ledgerBalance", {
                amount: formatMoney(targetAccount.balance),
              })}
            </p>
          ) : null}
        </div>

        {targetAccount.status === "disabled" ? (
          <div role="alert">
            <Note tone="warn">{t("allocateModal.disabledAlert")}</Note>
          </div>
        ) : null}

        <div>
          <PaymentFieldLabel htmlFor="allocation-amount">
            {t("allocateModal.amountLabel")}
          </PaymentFieldLabel>
          <PaymentAmountInput
            id="allocation-amount"
            type="number"
            suffix="USD"
            min={agencyBmFunding ? 10 : 0.01}
            step="0.01"
            max={!agencyBmFunding ? walletAvailable || undefined : undefined}
            placeholder={agencyBmFunding ? "10.00" : "100.00"}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={error ? true : undefined}
            autoFocus
          />
          <PaymentFieldHint>
            {agencyBmFunding
              ? t("allocateModal.minHint", { amount: tiktokMinLabel })
              : t("allocateModal.maxNow", {
                  amount: formatMoney(walletAvailable),
                })}
          </PaymentFieldHint>
        </div>

        {!agencyBmFunding ? (
          <PaymentCalc
            rows={[
              {
                label: t("allocateModal.walletAvailable"),
                value: formatMoney(walletAvailable),
              },
              {
                label: t("allocateModal.alreadyOnAccount"),
                value: formatMoney(alreadyOnAccount),
              },
            ]}
          />
        ) : null}

        <Note tone="ok" icon="check-circle">
          <span className="font-semibold">{t("allocateModal.oneToOne")}</span>{" "}
          {t("allocateModal.oneToOneBody", { amount: oneToOneExample })}
        </Note>
        {agencyBmFunding ? (
          <Note tone="info">{t("allocateModal.budgetHint")}</Note>
        ) : null}

        {error ? (
          <div role="alert">
            <Note tone="warn">{error}</Note>
          </div>
        ) : null}
      </PaymentDialogBody>

      <PaymentDialogFooter>
        <Button variant="outline" onClick={resetAndClose} disabled={loading}>
          {tCommon("close")}
        </Button>
        <Button onClick={handleSubmit} disabled={loading || !isValidAmount}>
          {loading
            ? agencyBmFunding
              ? t("allocateModal.funding")
              : t("allocateModal.assigning")
            : agencyBmFunding
              ? t("allocateModal.fundCta")
              : t("allocateModal.assignCta")}
        </Button>
      </PaymentDialogFooter>
    </PaymentDialogFrame>,
    document.body,
  );
}
