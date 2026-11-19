"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { Note, ToneBadge } from "@/components/ui/PanelKit";
import { cn } from "@/lib/cn";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import { useAppFormatter } from "@/lib/i18n/use-app-formatter";
import {
  depositFromDesiredCredit,
  formatFeePercentLabel,
} from "@/lib/payments/deposit-fee";
import { formatPenAmount } from "@/lib/payments/manual-deposit.shared";
import type { VoucherReviewNotice } from "@/lib/payments/voucher-review-notice";
import { GatewayLogo } from "./GatewayLogo";
import { VoucherReviewCard } from "./VoucherReviewCard";
import { PaymentAppIcon, resolvePaymentAppKey } from "./PaymentAppIcon";
import {
  PaymentModalHeader,
  PaymentOutcome,
  PaymentSegmented,
} from "./PaymentModalChrome";
import {
  PaymentAmountInput,
  PaymentCalc,
  PaymentDialogBody,
  PaymentDialogFooter,
  PaymentDialogFrame,
  PaymentFieldError,
  PaymentFieldHint,
  PaymentFieldLabel,
} from "./PaymentDialog";

type ChargeCurrency = "USD" | "PEN";
type Step =
  "form" | "banks" | "voucher" | "analyzing" | "confirmed" | "pending";

type BankAccount = {
  id: string;
  label: string;
  bank?: string;
  holder: string;
  accountNumber: string;
  cci?: string;
  notes?: string;
};

type ManualConfig = {
  fxRateUsdPen: number;
  fxSource?: string;
  fxAsOf?: string | null;
  bankAccounts: BankAccount[];
  bankAccountsUsd: BankAccount[];
  aiEnabled: boolean;
  binance?: { email: string; notes: string } | null;
};

interface ManualPaymentModalProps {
  open: boolean;
  onClose: () => void;
  feePercent?: number;
  initialPayMethod?: "bank" | "binance";
  /** Link público de Lo pagado: mismas pantallas, APIs atadas al token. */
  endpoints?: {
    config: string;
    create: string;
    proof: (paymentIntentId: string) => string;
  };
  /** Paga la deuda del mes. No recarga cartera. */
  paysDebt?: boolean;
  /** YYYY-MM de la deuda. */
  debtMonth?: string;
  /** Retomar una recarga ya creada: abre en «Pago» con su monto exacto. */
  resume?: {
    paymentIntentId: string;
    chargeCents: number;
    chargeCurrency: ChargeCurrency;
    manualPayMethod?: "bank" | "binance";
  } | null;
}

interface CreateIntentResponse {
  ok: boolean;
  paymentIntent: {
    paymentIntentId: string;
    creditCents: number;
    grossCents: number;
    grossChargeCents?: number;
    chargeCurrency?: ChargeCurrency;
    fxRateUsdPen?: number;
  };
}

interface ProofResponse {
  ok: boolean;
  paymentIntent: {
    autoApproved: boolean;
    creditUsdCents?: number;
    analysis?: { reason?: string; confirmed?: boolean };
    review?: VoucherReviewNotice | null;
  };
}

const MIN_USD = 10;
const MIN_DEBT_USD = 1;
const MAX_USD = 50_000;
const subscribeToNothing = () => () => {};

function buildPenQuote(creditUsd: number, feePercent: number, rate: number) {
  const usd = depositFromDesiredCredit(Math.round(creditUsd * 100), feePercent);
  const creditPenCents = Math.round(creditUsd * rate * 100);
  const grossPenCents = Math.round(creditPenCents * (1 + feePercent / 100));
  return {
    creditUsdCents: usd.creditCents,
    grossUsdCents: usd.grossCents,
    feeUsdCents: usd.feeCents,
    creditPenCents,
    grossPenCents,
    feePenCents: grossPenCents - creditPenCents,
  };
}

export function ManualPaymentModal({
  open,
  onClose,
  feePercent = 10,
  initialPayMethod = "bank",
  endpoints,
  paysDebt = false,
  debtMonth,
  resume = null,
}: ManualPaymentModalProps) {
  const router = useRouter();
  const t = useTranslations("payments");
  const tCommon = useTranslations("common");
  const amountFieldId = useId();
  const { formatMoney } = useAppFormatter();
  const mounted = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
  const manualSteps = useMemo(
    () =>
      [
        t("manualModal.stepAmount"),
        t("manualModal.stepTransfer"),
        t("manualModal.stepProof"),
      ] as const,
    [t],
  );
  // Al retomar una recarga se monta con key propia y arranca en «Pago».
  const [step, setStep] = useState<Step>(resume ? "banks" : "form");
  const [amount, setAmount] = useState("");
  const [payMethod, setPayMethod] = useState<"bank" | "binance">(resume?.manualPayMethod ?? initialPayMethod);
  const [chargeCurrency, setChargeCurrency] = useState<ChargeCurrency>(resume?.chargeCurrency ?? (initialPayMethod === "binance" ? "USD" : "PEN"));
  const [config, setConfig] = useState<ManualConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(resume?.paymentIntentId ?? null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [creditResult, setCreditResult] = useState<number | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [reviewNotice, setReviewNotice] = useState<VoucherReviewNotice | null>(null);
  const [serverChargeCents, setServerChargeCents] = useState<number | null>(resume?.chargeCents ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pasteZoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void apiClient<ManualConfig>(endpoints?.config ?? "/api/payments/manual/config")
      .then((value) => { if (!cancelled) setConfig(value); })
      .catch(() => { if (!cancelled) { setConfig(null); setError("No pudimos consultar el tipo de cambio SBS. Cierra y vuelve a abrir para reintentar."); } });
    return () => { cancelled = true; };
  }, [open, endpoints?.config]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const effectiveFee = paysDebt ? 0 : feePercent;
  const minUsd = paysDebt ? MIN_DEBT_USD : MIN_USD;
  const parsedAmount = Number.parseFloat(amount);
  const rate = config?.fxRateUsdPen ?? 0;
  const fxLabel = useMemo(() => {
    const src = (config?.fxSource ?? "").toLowerCase();
    if (src === "sbs") {
      return config?.fxAsOf
        ? t("addBalance.fxSbsAsOf", { date: config.fxAsOf })
        : t("addBalance.fxSbs");
    }
    return t("addBalance.fxReferential");
  }, [config, t]);
  const isValidAmount =
    rate > 0 &&
    Number.isFinite(parsedAmount) &&
    parsedAmount >= minUsd &&
    parsedAmount <= MAX_USD;

  const quote = useMemo(() => {
    if (!isValidAmount) return null;
    const usd = depositFromDesiredCredit(
      Math.round(parsedAmount * 100),
      effectiveFee,
    );
    const pen = buildPenQuote(parsedAmount, effectiveFee, rate);
    return { usd, pen };
  }, [effectiveFee, isValidAmount, parsedAmount, rate]);

  const banks =
    chargeCurrency === "PEN"
      ? (config?.bankAccounts ?? [])
      : (config?.bankAccountsUsd ?? []);

  const localChargeLabel =
    quote && chargeCurrency === "PEN"
      ? formatPenAmount(quote.pen.grossPenCents)
      : quote
        ? formatMoney(quote.usd.grossCents / 100)
        : "";
  const baseChargeLabel =
    serverChargeCents != null
      ? chargeCurrency === "PEN"
        ? formatPenAmount(serverChargeCents)
        : formatMoney(serverChargeCents / 100)
      : localChargeLabel || tCommon("emDash");
  const chargeLabel = payMethod === "binance"
    ? `${((serverChargeCents ?? quote?.usd.grossCents ?? 0) / 100).toFixed(2)} USDT`
    : baseChargeLabel;
  const modalStepIndex = step === "form" ? 0 : step === "banks" ? 1 : 2;

  function resetAndClose() {
    setStep("form");
    setAmount("");
    setChargeCurrency("PEN");
    setPayMethod("bank");
    setError(null);
    setPaymentIntentId(null);
    setProofFile(null);
    setProofPreview(null);
    setCreditResult(null);
    setPendingMessage(null);
    setReviewNotice(null);
    setServerChargeCents(null);
    onClose();
  }

  const applyProofFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      setError(t("manualModal.errFileType"));
      return;
    }
    setProofFile(file);
    setError(null);
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setProofPreview(url);
    } else {
      setProofPreview(null);
    }
  }, [t]);

  const handlePaste = useCallback((event: ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          event.preventDefault();
          applyProofFile(
            new File([file], `pasted-${Date.now()}.png`, { type: file.type }),
          );
        }
        break;
      }
    }
  }, [applyProofFile]);

  useEffect(() => {
    if (step !== "voucher") return;
    const zone = pasteZoneRef.current;
    if (!zone) return;
    zone.addEventListener("paste", handlePaste);
    return () => zone.removeEventListener("paste", handlePaste);
  }, [handlePaste, step]);

  async function handleCreateIntent() {
    if (!isValidAmount || !quote) {
      setError(
        t("manualModal.errAmountRange", {
          min: formatMoney(minUsd),
          max: formatMoney(MAX_USD),
        }),
      );
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient<CreateIntentResponse>(
        endpoints?.create ?? "/api/payments/intents",
        {
          method: "POST",
          body: JSON.stringify({
            amount: parsedAmount,
            provider: "manual",
            chargeCurrency,
            ...(!endpoints ? { manualPayMethod: payMethod } : {}),
            ...(paysDebt ? { periodoResumen: debtMonth ?? "" } : {}),
          }),
        },
      );
      setPaymentIntentId(data.paymentIntent.paymentIntentId);
      if (
        typeof data.paymentIntent.grossChargeCents === "number"
      ) {
        setServerChargeCents(data.paymentIntent.grossChargeCents);
      }
      setStep("banks");
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : t("manualModal.errCreate"),
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitVoucher() {
    if (!paymentIntentId || !proofFile) {
      setError(t("manualModal.errNeedProof"));
      return;
    }
    setStep("analyzing");
    setError(null);
    const formData = new FormData();
    formData.append("proof", proofFile);
    formData.append("payMethod", payMethod);
    try {
      const data = await apiClient<ProofResponse>(
        endpoints?.proof(paymentIntentId) ??
          `/api/payments/intents/${paymentIntentId}/proof`,
        { method: "POST", body: formData },
      );
      const credit = (data.paymentIntent.creditUsdCents ?? 0) / 100;
      setCreditResult(credit);
      if (data.paymentIntent.autoApproved) {
        setStep("confirmed");
        router.refresh();
      } else {
        setPendingMessage(
          data.paymentIntent.analysis?.reason ??
            t("manualModal.pendingToast"),
        );
        setReviewNotice(data.paymentIntent.review ?? null);
        setStep("pending");
      }
    } catch (err) {
      setStep("voucher");
      setError(
        err instanceof ApiClientError
          ? err.message
          : t("manualModal.errProcess"),
      );
    }
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }

  if (!open || !mounted) return null;

  // Cabecera común a los pasos: método elegido, pasos y cierre.
  const isBinance = payMethod === "binance";
  const methodHeader = {
    identityIcon: (
      <GatewayLogo gatewayId={isBinance ? "crypto" : "manual"} size="sm" />
    ),
    identityLabel: isBinance ? "Binance Pay" : t("manualModal.title"),
    identityDescription: t(
      isBinance ? "manualModal.binanceSubtitle" : "manualModal.subtitle",
    ),
    steps: manualSteps,
    currentStep: modalStepIndex,
    onClose: resetAndClose,
  };

  return createPortal(
    <PaymentDialogFrame
      onDismiss={resetAndClose}
      dismissLabel={tCommon("close")}
      labelledBy="manual-payment-title"
    >
      {step === "form" ? (
        <>
          <PaymentModalHeader
            titleId="manual-payment-title"
            title={
              paysDebt
                ? "¿Cuánto de tu deuda vas a pagar?"
                : t("manualModal.amountTitle")
            }
            description={
              paysDebt
                ? "Este pago baja lo que debes de este mes. No recarga cartera."
                : t(payMethod === "binance" ? "manualModal.binanceAmountHint" : "manualModal.amountHint")
            }
            {...methodHeader}
            identityDescription={
              paysDebt
                ? "Pago de deuda · Lo pagado"
                : methodHeader.identityDescription
            }
          />

          <PaymentDialogBody className="space-y-5">
            <div>
              <PaymentFieldLabel htmlFor={amountFieldId}>
                {paysDebt
                  ? "Deuda que vas a pagar (USD)"
                  : t("manualModal.receiveLabel")}
              </PaymentFieldLabel>
              <PaymentAmountInput
                big
                suffix="USD"
                id={amountFieldId}
                type="number"
                min={minUsd}
                max={MAX_USD}
                step="0.01"
                placeholder="120.00"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setServerChargeCents(null); }}
                autoFocus
              />
            </div>

            {!endpoints && !paysDebt && config?.binance ? (
              <div>
                <p className="mb-1.5 text-sm font-medium text-ink">
                  {t("reloadSection.method")}
                </p>
                <PaymentSegmented
                  label={t("reloadSection.method")}
                  value={payMethod}
                  options={[
                    { value: "bank", label: "Transferencia BCP" },
                    { value: "binance", label: "Binance Pay" },
                  ]}
                  onChange={(method) => { setPayMethod(method); setChargeCurrency(method === "binance" ? "USD" : "PEN"); setServerChargeCents(null); }}
                />
              </div>
            ) : null}

            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">
                {t("manualModal.currency")}
              </p>
              <PaymentSegmented
                label={t("manualModal.currency")}
                value={chargeCurrency}
                options={(payMethod === "binance" ? ["USD"] as const : ["PEN", "USD"] as const).map((c) => ({
                  value: c,
                  label:
                    payMethod === "binance"
                      ? "USDT"
                      : c === "PEN"
                        ? t("manualModal.pen")
                        : t("manualModal.usd"),
                }))}
                onChange={(c) => { setChargeCurrency(c); setServerChargeCents(null); }}
              />
            </div>

            {quote ? (
              <div>
                <p className="mb-2 text-sm font-medium text-ink">
                  {t("manualModal.transferSummary")}
                </p>
                <PaymentCalc
                  live
                  rows={[
                    {
                      label: paysDebt
                        ? "Baja tu deuda"
                        : t("manualModal.receiveWallet"),
                      value: formatMoney(quote.usd.creditCents / 100),
                    },
                    !paysDebt && {
                      label: `Fee ${formatFeePercentLabel(feePercent)}`,
                      value:
                        chargeCurrency === "PEN"
                          ? formatPenAmount(quote.pen.feePenCents)
                          : formatMoney(quote.usd.feeCents / 100),
                    },
                    {
                      label: t("manualModal.totalTransfer"),
                      value: chargeLabel,
                      total: true,
                    },
                  ]}
                />
                {chargeCurrency === "PEN" ? (
                  <PaymentFieldHint className="mt-2">
                    {t("manualModal.fxFixed", {
                      label: fxLabel,
                      rate: rate.toFixed(4),
                    })}
                  </PaymentFieldHint>
                ) : null}
              </div>
            ) : null}

            {error ? <PaymentFieldError>{error}</PaymentFieldError> : null}
          </PaymentDialogBody>

          <PaymentDialogFooter>
            <Button
              variant="outline"
              onClick={resetAndClose}
              className="w-full sm:w-auto"
            >
              {tCommon("cancel")}
            </Button>
            <Button
              onClick={handleCreateIntent}
              disabled={!isValidAmount || loading || (payMethod === "binance" && !config?.binance)}
              className="w-full sm:w-auto"
            >
              {loading ? t("addBalance.processing") : t("manualModal.seeBanks")}
            </Button>
          </PaymentDialogFooter>
        </>
      ) : null}

      {step === "banks" ? (
        <>
          <PaymentModalHeader
            titleId="manual-payment-title"
            title={t("manualModal.doTransfer")}
            description={payMethod === "binance" ? t("manualModal.binanceInstructions") : t("manualModal.transferHint", { amount: chargeLabel })}
            {...methodHeader}
          />

          <PaymentDialogBody className="space-y-3">
            {payMethod === "binance" ? (
              <>
                <div className="overflow-hidden rounded-box border border-line bg-surface shadow-ctl">
                  <div className="flex items-center gap-3 border-b border-line bg-field px-4 py-3">
                    <PaymentAppIcon app="binance" size="sm" />
                    <p className="text-sm font-semibold text-ink">Binance Pay · USDT</p>
                  </div>
                  <div className="space-y-3 px-4 py-3">
                    <p className="text-[13px] leading-5 text-ink-2">
                      {t("manualModal.binanceInstructions")}
                    </p>
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 break-all text-sm font-semibold text-ink">
                        {config?.binance?.email ?? tCommon("emDash")}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!config?.binance?.email}
                        onClick={() => config?.binance?.email && void copyText(config.binance.email)}
                      >
                        <PanelIcon name="copy" />
                        {t("addBalance.copy")}
                      </Button>
                    </div>
                  </div>
                </div>
                <Note tone="warn">{t("manualModal.binanceReview")}</Note>
              </>
            ) : banks.length === 0 ? (
              <Note tone="warn">
                Las cuentas bancarias están pendientes de configuración.
                Contacta con soporte.
              </Note>
            ) : (
              banks.map((bank) => {
                const bankApp = resolvePaymentAppKey(bank.bank, bank.label);
                const currencyBadge =
                  chargeCurrency === "USD" ? "USD" : "PEN";
                return (
                  <div
                    key={bank.id}
                    className="overflow-hidden rounded-box border border-line bg-surface shadow-ctl"
                  >
                    <div className="flex items-center justify-between gap-3 bg-field px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <PaymentAppIcon app={bankApp} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">
                            {bank.label}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-ink-2">
                            {bank.holder}
                          </p>
                        </div>
                      </div>
                      <ToneBadge
                        tone={currencyBadge === "USD" ? "ok" : "accent"}
                        className="num shrink-0"
                      >
                        {currencyBadge}
                      </ToneBadge>
                    </div>
                    <BankDataRow
                      label={t("manualModal.accountNumber")}
                      value={bank.accountNumber}
                      copyLabel={t("addBalance.copy")}
                      onCopy={() => void copyText(bank.accountNumber)}
                    />
                    {bank.cci ? (
                      <BankDataRow
                        label={t("manualModal.cci")}
                        value={bank.cci}
                        copyLabel={t("addBalance.copy")}
                        onCopy={() => void copyText(bank.cci!)}
                      />
                    ) : null}
                    {bank.notes ? (
                      <p className="border-t border-line px-4 py-2.5 text-xs leading-snug text-ink-3">
                        {bank.notes}
                      </p>
                    ) : null}
                  </div>
                );
              })
            )}
          </PaymentDialogBody>

          <PaymentDialogFooter>
            <Button
              variant="outline"
              onClick={() => setStep("form")}
              className="w-full sm:w-auto"
            >
              {tCommon("back")}
            </Button>
            <Button
              className="w-full sm:w-auto"
              onClick={() => setStep("voucher")}
            >
              {t("manualModal.paidUpload")}
            </Button>
          </PaymentDialogFooter>
        </>
      ) : null}

      {step === "voucher" ? (
        <>
          <PaymentModalHeader
            titleId="manual-payment-title"
            title={t("manualModal.uploadTitle")}
            description={t(payMethod === "binance" ? "manualModal.binanceUploadDesc" : "manualModal.uploadDesc")}
            {...methodHeader}
          />
          {/* Zona de pegado: con el foco aquí, Ctrl+V sube la captura. */}
          <div
            ref={pasteZoneRef}
            tabIndex={0}
            className="flex min-h-0 flex-1 flex-col outline-none"
          >
            <PaymentDialogBody>
              {/* Zona para elegir el archivo (v3 «drop»). */}
              <div
                className={cn(
                  "grid min-h-[140px] cursor-pointer content-center justify-items-center gap-1 rounded-box border border-dashed p-5 text-center transition-colors",
                  proofFile
                    ? "border-ok-solid bg-ok-bg"
                    : "border-line-strong bg-field hover:border-accent focus-visible:border-accent",
                )}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") fileInputRef.current?.click();
                }}
                role="button"
                tabIndex={0}
              >
                {proofPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={proofPreview}
                    alt={t("manualModal.previewAlt")}
                    className="max-h-32 max-w-full rounded-ctl object-contain"
                  />
                ) : proofFile ? (
                  <p className="max-w-full break-all text-center text-sm font-medium text-ok-fg">
                    {proofFile.name}
                  </p>
                ) : (
                  <>
                    <PanelIcon name="upload" className="text-ink-2" />
                    <p className="text-sm font-semibold text-ink">
                      {t("manualModal.uploadHint")}
                    </p>
                    <p className="text-xs text-ink-3">
                      {t("manualModal.fileTypesHint")}
                    </p>
                  </>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) applyProofFile(f);
                }}
              />

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {t("manualModal.gallery")}
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => pasteZoneRef.current?.focus()}
                >
                  {t("manualModal.paste")}
                </Button>
              </div>

              {error ? (
                <PaymentFieldError className="mt-3">{error}</PaymentFieldError>
              ) : null}
            </PaymentDialogBody>

            <PaymentDialogFooter>
              <Button
                variant="outline"
                onClick={() => setStep("banks")}
                className="w-full sm:w-auto"
              >
                {tCommon("back")}
              </Button>
              <Button
                disabled={!proofFile}
                className="w-full sm:w-auto"
                onClick={handleSubmitVoucher}
              >
                {paysDebt ? "Verificar voucher" : t("manualModal.verify")}
              </Button>
            </PaymentDialogFooter>
          </div>
        </>
      ) : null}

      {step === "analyzing" ? (
        <>
          <PaymentModalHeader
            titleId="manual-payment-title"
            title={t("manualModal.verifying")}
            description={t("manualModal.verifyingDesc")}
            {...methodHeader}
          />
          <PaymentDialogBody>
            <div className="flex flex-col items-center py-8 text-center">
              <span
                aria-hidden
                className="size-10 animate-spin rounded-full border-[3px] border-line border-t-accent motion-reduce:animate-none"
              />
              <p className="mt-5 text-[13px] font-medium text-ink-2">
                {t(paysDebt ? "manualModal.reviewWait" : "manualModal.analyzingWait")}
              </p>
            </div>
          </PaymentDialogBody>
        </>
      ) : null}

      {step === "confirmed" ? (
        <>
          <PaymentModalHeader
            titleId="manual-payment-title"
            title={t("manualModal.confirmed")}
            description={
              paysDebt
                ? "Gerencia ya puede revisar el voucher. Al aceptarlo, baja tu deuda. No entra a cartera."
                : t("manualModal.confirmedDesc")
            }
            {...methodHeader}
          />
          <PaymentDialogBody>
            <PaymentOutcome
              tone="ok"
              icon="check-circle"
              label={paysDebt ? "Deuda que pagaste" : t("manualModal.credited")}
              value={formatMoney(creditResult ?? parsedAmount)}
            >
              {paysDebt
                ? "Gerencia revisa el voucher y baja la deuda. No entra a cartera."
                : t("manualModal.canAssign")}
            </PaymentOutcome>
          </PaymentDialogBody>
          <PaymentDialogFooter>
            <Button className="w-full sm:w-auto" onClick={resetAndClose}>
              {t("manualModal.done")}
            </Button>
          </PaymentDialogFooter>
        </>
      ) : null}

      {step === "pending" ? (
        <>
          <PaymentModalHeader
            titleId="manual-payment-title"
            title={
              paysDebt
                ? "Comprobante en revisión"
                : reviewNotice && reviewNotice.kind !== "review"
                  ? "No pudimos acreditar tu recarga"
                  : t("manualModal.pendingTitle")
            }
            description={
              paysDebt
                ? "Gerencia revisa la transferencia y, al aceptarla, baja la deuda de este mes. No acredita cartera."
                : reviewNotice && reviewNotice.kind !== "review"
                  ? "Tu comprobante pasó a verificación de soporte. No vuelvas a pagar."
                  : t(payMethod === "binance" ? "manualModal.binanceReview" : "manualModal.pendingDesc")
            }
            {...methodHeader}
          />
          <PaymentDialogBody>
            {reviewNotice && !paysDebt ? (
              <VoucherReviewCard notice={reviewNotice} />
            ) : (
              <PaymentOutcome tone="warn" icon="clock">
                {pendingMessage}
              </PaymentOutcome>
            )}
          </PaymentDialogBody>
          <PaymentDialogFooter>
            <Button className="w-full sm:w-auto" onClick={resetAndClose}>
              {t("manualModal.understood")}
            </Button>
          </PaymentDialogFooter>
        </>
      ) : null}
    </PaymentDialogFrame>,
    document.body,
  );
}

/** Dato de la cuenta de destino con su botón para copiarlo. */
function BankDataRow({
  label,
  value,
  copyLabel,
  onCopy,
}: {
  label: string;
  value: string;
  copyLabel: string;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink-2">{label}</p>
        <p className="num mt-0.5 break-all text-sm font-semibold text-ink">{value}</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onCopy}
        aria-label={`${copyLabel}: ${label}`}
      >
        <PanelIcon name="copy" />
        {copyLabel}
      </Button>
    </div>
  );
}
