"use client";

import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { Note } from "@/components/ui/PanelKit";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import { useAppFormatter } from "@/lib/i18n/use-app-formatter";
import {
  formatFeePercentLabel,
  depositFromDesiredCredit,
  effectiveDepositFeePercent,
  DEFAULT_STRIPE_DEPOSIT_SURCHARGE_PERCENT,
} from "@/lib/payments/deposit-fee";
import { formatPenAmount } from "@/lib/payments/manual-deposit.shared";
import { CRYPTO_MIN_USD } from "@/lib/payments/crypto-limits";
import { COBRANA_YAPE_SERVICE_COMPANY } from "@/lib/payments/cobrana/service-brand";
import { normalizeYapeDocument } from "@/lib/payments/cobrana/document";
import type { PaymentGatewayId } from "@/types/payment";
import {
  PaymentAppIcon,
  paymentAppButtonClass,
  paymentAppLabel,
  resolvePaymentAppKey,
} from "./PaymentAppIcon";
import { cn } from "@/lib/cn";
import { GatewayLogo } from "./GatewayLogo";
import { YapePayQr } from "./YapePayQr.client";
import { PaymentModalHeader, PaymentOutcome } from "./PaymentModalChrome";
import {
  PaymentAmountInput,
  PaymentCalc,
  PaymentDialogBody,
  PaymentDialogFooter,
  PaymentDialogFrame,
  PaymentFieldError,
  PaymentFieldLabel,
} from "./PaymentDialog";
import { HowToSteps } from "@/components/ui/HelpGuide";

interface AddBalanceModalProps {
  open: boolean;
  onClose: () => void;
  selectedGateway?: PaymentGatewayId;
  /** Fee % Hecom (tiktok_default_fee / cuenta). Sin surcharge Stripe. */
  feePercent?: number;
  /** Recargo pasarela Stripe (default 3). Solo si gateway = stripe. */
  stripeSurchargePercent?: number;
}

type CobranaDeeplink = { key: string; label: string; url: string };

interface CreateIntentResponse {
  ok: boolean;
  paymentIntent: {
    paymentIntentId: string;
    status: string;
    checkoutUrl: string | null;
    providerConfigured: boolean;
    message?: string;
    feePercent?: number;
    feeCents?: number;
    creditCents?: number;
    grossCents?: number;
    grossPenCents?: number | null;
    fxRateUsdPen?: number;
    cobranaCode?: string | null;
    cobranaDeeplinks?: CobranaDeeplink[];
  };
}

interface ProofUploadResponse {
  ok: boolean;
  paymentIntent: {
    id: string;
    status: string;
    manualReviewStatus: string;
    proofFileName: string;
    autoApproved?: boolean;
    analysis?: { reason?: string };
    submittedAt: string;
  };
}

interface IntentPollResponse {
  ok: boolean;
  paymentIntent: {
    id: string;
    status: string;
    cobranaCode?: string | null;
    cobranaDeeplinks?: CobranaDeeplink[];
  };
}

const MIN_AMOUNT = 1;
const MAX_AMOUNT = 100_000;
const DEFAULT_FX = 0; // No cotizar soles hasta obtener SBS.

const subscribeToNothing = () => () => {};

type Step = "form" | "confirm" | "proof" | "yape" | "result";

export function AddBalanceModal({
  open,
  onClose,
  selectedGateway = "cobrana",
  feePercent = 10,
  stripeSurchargePercent = DEFAULT_STRIPE_DEPOSIT_SURCHARGE_PERCENT,
}: AddBalanceModalProps) {
  const router = useRouter();
  const t = useTranslations("payments");
  const tCommon = useTranslations("common");
  const { formatMoney } = useAppFormatter();
  const mounted = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
  const addBalanceSteps = useMemo(
    () =>
      [
        t("addBalance.stepAmount"),
        t("addBalance.stepConfirm"),
        t("addBalance.stepPay"),
      ] as const,
    [t],
  );
  const gatewayLabels = useMemo(
    (): Record<PaymentGatewayId, string> => ({
      stripe: "Stripe",
      whop: "Whop",
      culqi: "Culqi",
      mercadopago: "Mercado Pago",
      crypto: t("addBalance.gatewayCrypto"),
      manual: t("addBalance.gatewayManual"),
      cobrana: t("addBalance.gatewayYapePlin"),
    }),
    [t],
  );
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [fxRate, setFxRate] = useState(DEFAULT_FX);
  const [fxSourceLabel, setFxSourceLabel] = useState(() =>
    t("addBalance.fxReferential"),
  );
  const [cobranaCode, setCobranaCode] = useState<string | null>(null);
  const [cobranaDeeplinks, setCobranaDeeplinks] = useState<CobranaDeeplink[]>(
    [],
  );
  const [codeCopied, setCodeCopied] = useState(false);
  const [paidConfirmed, setPaidConfirmed] = useState(false);
  const [needsCustomerDocument, setNeedsCustomerDocument] = useState(false);
  const [customerDocument, setCustomerDocument] = useState("");
  const [crmDocumentHint, setCrmDocumentHint] = useState<string | null>(null);

  const isCobrana = selectedGateway === "cobrana";
  const isStripe = selectedGateway === "stripe";
  const isWhop = selectedGateway === "whop";
  const isCardGateway = isStripe || isWhop;
  const isCrypto = selectedGateway === "crypto";
  const stripeExtra = isCardGateway ? Math.max(0, stripeSurchargePercent) : 0;
  const chargeFeePercent = effectiveDepositFeePercent({
    holisticFeePercent: feePercent,
    provider: selectedGateway,
    stripeSurchargePercent: stripeExtra,
  });
  const parsedAmount = Number.parseFloat(amount);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !isCobrana) return;
    let cancelled = false;
    void apiClient<{
      fxRateUsdPen: number;
      fxSource?: string;
      fxAsOf?: string | null;
    }>("/api/payments/manual/config")
      .then((cfg) => {
        if (cancelled) return;
        if (Number.isFinite(cfg.fxRateUsdPen) && cfg.fxRateUsdPen > 0) {
          setFxRate(cfg.fxRateUsdPen);
        }
        const src = (cfg.fxSource ?? "").toLowerCase();
        if (src === "sbs") {
          setFxSourceLabel(
            cfg.fxAsOf
              ? t("addBalance.fxSbsAsOf", { date: cfg.fxAsOf })
              : t("addBalance.fxSbs"),
          );
        } else {
          setFxSourceLabel(t("addBalance.fxReferential"));
        }
      })
      .catch(() => {
        if (!cancelled) { setFxRate(0); setError("No pudimos consultar el tipo de cambio SBS. Cierra y vuelve a abrir para reintentar."); }
      });
    return () => { cancelled = true; };
  }, [open, isCobrana, t]);

  useEffect(() => {
    if (!open || !isCobrana || step !== "confirm") return;
    let cancelled = false;
    void apiClient<{
      ok: boolean;
      needsDocument: boolean;
      crmDocument: string | null;
      message: string | null;
    }>("/api/payments/cobrana/document")
      .then((data) => {
        if (cancelled) return;
        setNeedsCustomerDocument(Boolean(data.needsDocument));
        setCrmDocumentHint(
          data.needsDocument && data.crmDocument ? data.crmDocument : null,
        );
      })
      .catch(() => {
        if (cancelled) return;
        // Ante duda, pedir DNI: mejor UX que bloquear con error opaco.
        setNeedsCustomerDocument(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, isCobrana, step]);

  useEffect(() => {
    if (!open || step !== "yape" || !paymentIntentId || paidConfirmed) return;

    let cancelled = false;

    async function poll() {
      try {
        const data = await apiClient<IntentPollResponse>(
          `/api/payments/intents/${paymentIntentId}`,
        );
        if (cancelled) return;
        if (data.paymentIntent.cobranaCode) {
          setCobranaCode(data.paymentIntent.cobranaCode);
        }
        if (data.paymentIntent.cobranaDeeplinks?.length) {
          setCobranaDeeplinks(data.paymentIntent.cobranaDeeplinks);
        }
        if (data.paymentIntent.status === "succeeded") {
          setPaidConfirmed(true);
          setResultMessage(
            t("addBalance.successConfirmed", {
              amount: formatMoney(parsedAmount),
            }),
          );
          setStep("result");
          router.refresh();
        }
      } catch {
        /* keep waiting — webhook is source of truth */
      }
    }

    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [open, step, paymentIntentId, paidConfirmed, router, parsedAmount]);

  // La red TRC20 rechaza montos bajos, así que el piso sube con Cripto.
  const minAmount = isCrypto ? CRYPTO_MIN_USD : MIN_AMOUNT;
  const isValidAmount =
    (!isCobrana || fxRate > 0) &&
    Number.isFinite(parsedAmount) &&
    parsedAmount >= minAmount &&
    parsedAmount <= MAX_AMOUNT;
  const belowCryptoMinimum =
    isCrypto && Number.isFinite(parsedAmount) && parsedAmount < CRYPTO_MIN_USD;
  const isVoucher = selectedGateway === "manual";

  const feePreview = useMemo(() => {
    if (!isValidAmount) return null;
    return depositFromDesiredCredit(
      Math.round(parsedAmount * 100),
      chargeFeePercent,
    );
  }, [chargeFeePercent, isValidAmount, parsedAmount]);

  const penPreview = useMemo(() => {
    if (!isCobrana || !isValidAmount) return null;
    const creditPenCents = Math.round(parsedAmount * fxRate * 100);
    const grossPenCents = Math.round(
      creditPenCents * (1 + chargeFeePercent / 100),
    );
    return {
      creditPenCents,
      feePenCents: Math.max(0, grossPenCents - creditPenCents),
      grossPenCents,
    };
  }, [chargeFeePercent, fxRate, isCobrana, isValidAmount, parsedAmount]);

  function handleClose() {
    setStep("form");
    setAmount("");
    setError(null);
    setResultMessage(null);
    setPaymentIntentId(null);
    setProofFile(null);
    setLoading(false);
    setUploadingProof(false);
    setCobranaCode(null);
    setCobranaDeeplinks([]);
    setPaidConfirmed(false);
    setNeedsCustomerDocument(false);
    setCustomerDocument("");
    setCrmDocumentHint(null);
    onClose();
  }

  function handleContinueToConfirm() {
    if (!isValidAmount) {
      setError(t("addBalance.errAmount"));
      return;
    }
    setError(null);
    setStep("confirm");
  }

  async function handleConfirm() {
    setLoading(true);
    setError(null);

    try {
      if (isCobrana && needsCustomerDocument) {
        const doc = normalizeYapeDocument(customerDocument);
        if (!doc.ok) {
          setError(doc.message);
          setLoading(false);
          return;
        }
      }

      const data = await apiClient<CreateIntentResponse>(
        "/api/payments/intents",
        {
          method: "POST",
          body: JSON.stringify({
            amount: parsedAmount,
            currency: "USD",
            provider: selectedGateway,
            ...(isCobrana ? { chargeCurrency: "PEN" } : {}),
            ...(isCobrana && needsCustomerDocument
              ? { customerDocument: customerDocument.replace(/\D/g, "") }
              : {}),
          }),
        },
      );

      if (data.paymentIntent.checkoutUrl) {
        window.location.assign(data.paymentIntent.checkoutUrl);
        return;
      }

      setPaymentIntentId(data.paymentIntent.paymentIntentId);

      if (isCobrana) {
        setCobranaCode(data.paymentIntent.cobranaCode ?? null);
        setCobranaDeeplinks(data.paymentIntent.cobranaDeeplinks ?? []);
        setResultMessage(data.paymentIntent.message ?? null);
        setStep("yape");
        router.refresh();
        return;
      }

      const chargeLabel =
        data.paymentIntent.grossCents != null
          ? formatMoney(data.paymentIntent.grossCents / 100)
          : feePreview
            ? formatMoney(feePreview.grossCents / 100)
            : formatMoney(parsedAmount);
      const defaultMessage = data.paymentIntent.providerConfigured
        ? t("addBalance.successCreated", {
            amount: formatMoney(parsedAmount),
            charge: chargeLabel,
            fee: formatFeePercentLabel(chargeFeePercent),
          })
        : t("addBalance.gatewayNotConfigured");

      setResultMessage(data.paymentIntent.message ?? defaultMessage);
      setStep(isVoucher ? "proof" : "result");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : t("addBalance.errCreateIntent");
      if (
        isCobrana &&
        /NEED_CUSTOMER_DOCUMENT|DNI \(8|RUC \(11|documento|Ingresa tu DNI/i.test(
          message,
        )
      ) {
        setNeedsCustomerDocument(true);
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleProofUpload() {
    if (!paymentIntentId) {
      setError(t("addBalance.errNeedIntent"));
      return;
    }
    if (!proofFile) {
      setError(t("addBalance.errNeedVoucher"));
      return;
    }

    setUploadingProof(true);
    setError(null);

    const formData = new FormData();
    formData.append("proof", proofFile);

    try {
      const data = await apiClient<ProofUploadResponse>(
        `/api/payments/intents/${paymentIntentId}/proof`,
        {
          method: "POST",
          body: formData,
        },
      );
      setResultMessage(
        data.paymentIntent.autoApproved
          ? t("manualModal.confirmedDesc")
          : data.paymentIntent.analysis?.reason ?? t("addBalance.voucherSent", {
          fileName: data.paymentIntent.proofFileName,
        }),
      );
      setPaidConfirmed(data.paymentIntent.autoApproved === true);
      setStep("result");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : t("addBalance.errUploadProof"),
      );
    } finally {
      setUploadingProof(false);
    }
  }

  const yapeLink =
    cobranaDeeplinks.find((d) => d.key.toLowerCase() === "yape") ?? null;
  const otherLinks = cobranaDeeplinks.filter(
    (d) => d.key.toLowerCase() !== "yape",
  );
  // Yape ya sale arriba como QR / botón grande: abajo quedan los bancos.
  const orderedLinks = otherLinks;
  const modalStepIndex = step === "form" ? 0 : step === "confirm" ? 1 : 2;
  const gatewayIdentityDescription = isCobrana
    ? t("addBalance.gatewayLocal")
    : isCardGateway
      ? t("addBalance.gatewayCards")
      : t("addBalance.gatewayWallet");

  if (!open || !mounted) return null;

  // Cabecera común a los pasos: método elegido, pasos y cierre.
  const gatewayHeader = {
    identityIcon: <GatewayLogo gatewayId={selectedGateway} size="sm" />,
    identityLabel: gatewayLabels[selectedGateway],
    identityDescription: gatewayIdentityDescription,
    steps: addBalanceSteps,
    currentStep: modalStepIndex,
    onClose: handleClose,
  };

  return createPortal(
    <PaymentDialogFrame
      onDismiss={handleClose}
      dismissLabel={tCommon("close")}
      labelledBy="add-balance-title"
    >
      {step === "form" ? (
        <>
          <PaymentModalHeader
            titleId="add-balance-title"
            title={t("addBalance.titleAmount")}
            description={
              isCobrana
                ? t("addBalance.cobranaUsdHint")
                : isCardGateway
                  ? t("addBalance.stripeAmountHint")
                  : t("addBalance.defaultAmountHint")
            }
            {...gatewayHeader}
          />

          <PaymentDialogBody className="space-y-5">
            <div>
              <PaymentFieldLabel htmlFor="topup-amount">
                {t("addBalance.receiveLabel")}
              </PaymentFieldLabel>
              <PaymentAmountInput
                big
                suffix="USD"
                id="topup-amount"
                type="number"
                min={minAmount}
                max={MAX_AMOUNT}
                step="0.01"
                placeholder="100.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
              {error ? <PaymentFieldError>{error}</PaymentFieldError> : null}
              {!error && belowCryptoMinimum ? (
                <p
                  className="mt-1.5 flex items-start gap-1.5 text-xs text-warn-fg"
                  role="alert"
                >
                  <PanelIcon name="alert" className="mt-px size-3.5!" />
                  <span>
                    {t("addBalance.cryptoMinAmount", { min: CRYPTO_MIN_USD })}
                  </span>
                </p>
              ) : null}
            </div>

            {feePreview ? (
              <div>
                <p className="mb-2 text-sm font-medium text-ink">
                  {t("addBalance.summary")}
                </p>
                <PaymentCalc
                  live
                  rows={[
                    {
                      label: t("addBalance.receiveWallet"),
                      value: formatMoney(feePreview.creditCents / 100),
                    },
                    {
                      label: `${t("addBalance.feeHolistic")} (${formatFeePercentLabel(feePercent)})`,
                      value:
                        isCobrana && penPreview
                          ? formatPenAmount(penPreview.feePenCents)
                          : formatMoney((parsedAmount * feePercent) / 100),
                    },
                    isCardGateway &&
                      stripeExtra > 0 && {
                        label: `${
                          isWhop
                            ? t("addBalance.feeGateway")
                            : t("addBalance.feeStripe")
                        } (${formatFeePercentLabel(stripeExtra)})`,
                        value: formatMoney((parsedAmount * stripeExtra) / 100),
                      },
                    {
                      label: t("addBalance.totalPay"),
                      value:
                        isCobrana && penPreview
                          ? formatPenAmount(penPreview.grossPenCents)
                          : formatMoney(feePreview.grossCents / 100),
                      total: true,
                    },
                  ]}
                />
                <p className="mt-2 text-xs leading-snug text-ink-3">
                  {isCobrana
                    ? t("addBalance.fxNeedDni", {
                        fx: fxSourceLabel,
                        rate: fxRate.toFixed(3),
                      })
                    : isCardGateway
                      ? t("addBalance.feeTotalHint", {
                          fee: formatFeePercentLabel(chargeFeePercent),
                          stripe: formatFeePercentLabel(stripeExtra),
                        })
                      : t("addBalance.feeExample")}
                </p>
              </div>
            ) : null}

            {isCardGateway ? (
              <Note tone="info" icon="shield" title={t("addBalance.payWithCard")}>
                <p>
                  {isWhop
                    ? t("addBalance.whopSecure")
                    : t("addBalance.stripeSecure")}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {(["visa", "mastercard"] as const).map((app) => (
                    <PaymentAppIcon key={app} app={app} size="sm" />
                  ))}
                </div>
              </Note>
            ) : isCobrana ? (
              <Note tone="neutral" title={t("addBalance.cobranaProcessed")}>
                <p>
                  {t("addBalance.yapeServiceHint", {
                    company: COBRANA_YAPE_SERVICE_COMPANY,
                  })}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      "yape",
                      "plin",
                      "bcp",
                      "interbank",
                      "bbva",
                      "scotiabank",
                    ] as const
                  ).map((app) => (
                    <PaymentAppIcon key={app} app={app} size="sm" />
                  ))}
                </div>
              </Note>
            ) : isCrypto ? (
              <Note tone="neutral">{t("addBalance.cryptoCheckoutHint")}</Note>
            ) : isVoucher ? (
              <Note tone="neutral">{t("addBalance.manualAfterCreateHint")}</Note>
            ) : null}
          </PaymentDialogBody>

          <PaymentDialogFooter>
            <Button
              variant="outline"
              onClick={handleClose}
              className="w-full sm:w-auto"
            >
              {tCommon("cancel")}
            </Button>
            <Button
              onClick={handleContinueToConfirm}
              className="w-full sm:w-auto"
            >
              {t("addBalance.reviewCta")}
            </Button>
          </PaymentDialogFooter>
        </>
      ) : step === "confirm" ? (
        <>
          <PaymentModalHeader
            titleId="add-balance-title"
            title={t("addBalance.titleConfirm")}
            description={
              isCobrana
                ? t("addBalance.cobranaConfirmHint")
                : selectedGateway === "crypto"
                  ? t("addBalance.cryptoConfirmHint")
                  : isWhop
                    ? t("addBalance.whopConfirmHint")
                    : t("addBalance.confirmDefaultHint")
            }
            {...gatewayHeader}
          />

          <PaymentDialogBody>
            <PaymentCalc
              rows={[
                {
                  label: (
                    <CalcLabel
                      main={t("addBalance.receiveWallet")}
                      sub={t("addBalance.inHolisticWallet")}
                    />
                  ),
                  value: formatMoney(parsedAmount),
                },
                {
                  label: `${t("addBalance.feeHolistic")} (${formatFeePercentLabel(feePercent)})`,
                  value:
                    isCobrana && penPreview
                      ? formatPenAmount(penPreview.feePenCents)
                      : formatMoney((parsedAmount * feePercent) / 100),
                },
                isCardGateway &&
                  stripeExtra > 0 && {
                    label: `${
                      isWhop
                        ? t("addBalance.feeGateway")
                        : t("addBalance.feeStripe")
                    } (${formatFeePercentLabel(stripeExtra)})`,
                    value: formatMoney((parsedAmount * stripeExtra) / 100),
                  },
                isCobrana && {
                  label: t("addBalance.yapeService"),
                  value: (
                    <span className="font-panel font-semibold">
                      {COBRANA_YAPE_SERVICE_COMPANY}
                    </span>
                  ),
                },
                {
                  label: (
                    <CalcLabel
                      main={t("addBalance.totalPay")}
                      sub={t("addBalance.viaGateway", {
                        gateway: gatewayLabels[selectedGateway],
                      })}
                    />
                  ),
                  value:
                    isCobrana && penPreview
                      ? formatPenAmount(penPreview.grossPenCents)
                      : feePreview
                        ? formatMoney(feePreview.grossCents / 100)
                        : formatMoney(parsedAmount),
                  total: true,
                },
              ]}
            />

            {isCobrana && needsCustomerDocument ? (
              <div className="mt-4 rounded-box border border-line bg-surface p-4">
                <p className="text-sm font-semibold text-ink">
                  {t("addBalance.dniTitle")}
                </p>
                <p className="mt-1 text-[13px] leading-5 text-ink-2">
                  {crmDocumentHint
                    ? t("addBalance.crmDocInvalid", { doc: crmDocumentHint })
                    : t("addBalance.dniRequired")}
                </p>
                <label className="mt-3 block">
                  <span className="text-sm font-medium text-ink">
                    {t("addBalance.dniLabel")}
                  </span>
                  <Input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder={t("addBalance.dniPlaceholder")}
                    maxLength={11}
                    value={customerDocument}
                    onChange={(e) =>
                      setCustomerDocument(
                        e.target.value.replace(/\D/g, "").slice(0, 11),
                      )
                    }
                    className="num mt-1.5 font-semibold tracking-wide"
                  />
                </label>
              </div>
            ) : null}

            {error ? (
              <PaymentFieldError className="mt-3">{error}</PaymentFieldError>
            ) : null}
          </PaymentDialogBody>

          <PaymentDialogFooter>
            <Button
              variant="outline"
              onClick={() => setStep("form")}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              {tCommon("back")}
            </Button>
            <Button
              onClick={() => void handleConfirm()}
              disabled={
                loading || (isCobrana && fxRate <= 0) ||
                (isCobrana &&
                  needsCustomerDocument &&
                  !normalizeYapeDocument(customerDocument).ok)
              }
              className="w-full sm:w-auto"
            >
              {loading
                ? t("addBalance.processing")
                : isCobrana
                  ? t("addBalance.continueCobrana")
                  : selectedGateway === "crypto"
                    ? t("addBalance.payCrypto")
                    : selectedGateway === "stripe"
                      ? t("addBalance.payStripe")
                      : selectedGateway === "whop"
                        ? t("addBalance.payWhop")
                        : t("reloadSection.reloadWith", {
                            name: gatewayLabels[selectedGateway],
                          })}
            </Button>
          </PaymentDialogFooter>
        </>
      ) : step === "yape" ? (
        <>
          <PaymentModalHeader
            titleId="add-balance-title"
            title={t("addBalance.titlePay")}
            description={resultMessage ?? t("addBalance.cobranaCodeHint")}
            identityIcon={<GatewayLogo gatewayId="cobrana" size="sm" />}
            identityLabel={t("addBalance.gatewayYapePlin")}
            identityDescription={t("addBalance.gatewayLocal")}
            steps={addBalanceSteps}
            currentStep={modalStepIndex}
            onClose={handleClose}
          />

          <PaymentDialogBody className="space-y-4">
            {yapeLink ? (
              <>
                <YapePayQr
                  url={yapeLink.url}
                  amountLabel={
                    penPreview ? formatPenAmount(penPreview.grossPenCents) : null
                  }
                />
                <p className="text-xs font-medium text-ink-2">
                  {t("addBalance.yapeManualFallback")}
                </p>
              </>
            ) : null}
            {/* Código de pago (v3 «paycode»). */}
            <div className="grid justify-items-center gap-1.5 rounded-box border border-dashed border-line-strong bg-subtle p-5 text-center">
              <span className="eyebrow">{t("addBalance.paymentCode")}</span>
              {cobranaCode ? (
                <p className="max-w-full break-all font-mono text-[1.875rem] font-bold leading-[1.1] tracking-[0.1em] text-ink">
                  {cobranaCode}
                </p>
              ) : (
                <p className="text-[13px] text-ink-2">
                  {t("addBalance.preparingCode")}
                </p>
              )}
              <p className="text-[13px] text-ink-2">
                {t("addBalance.youPay")}{" "}
                <b className="num font-semibold text-ink">
                  {penPreview ? formatPenAmount(penPreview.grossPenCents) : "—"}
                </b>
                {" · "}
                {t("addBalance.youReceive")}{" "}
                <b className="num font-semibold text-ink">
                  {formatMoney(parsedAmount)}
                </b>
              </p>
              {cobranaCode ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-1"
                  onClick={() => {
                    void navigator.clipboard
                      ?.writeText(cobranaCode)
                      .then(() => {
                        setCodeCopied(true);
                        window.setTimeout(() => setCodeCopied(false), 2000);
                      })
                      .catch(() => {
                        /* ignore */
                      });
                  }}
                >
                  <PanelIcon name={codeCopied ? "check" : "copy"} />
                  {codeCopied ? t("addBalance.copied") : t("addBalance.copy")}
                </Button>
              ) : null}
            </div>

            <p
              className="flex items-center gap-2 text-[13px] font-medium text-ink-2"
              role="status"
            >
              <span
                aria-hidden
                className="size-2 shrink-0 animate-pulse rounded-full bg-accent motion-reduce:animate-none"
              />
              {t("addBalance.waitingCobrana")}
            </p>

            <div className="rounded-box border border-line bg-surface px-4 py-3">
              <p className="text-xs font-medium text-ink-2">
                {t("addBalance.searchInYape")}
              </p>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 text-lg font-semibold tracking-[-0.015em] text-ink">
                  {COBRANA_YAPE_SERVICE_COMPANY}
                </p>
                <span className="panel-badge tone-neutral">
                  {t("addBalance.payServices")}
                </span>
              </div>
              <p className="mt-1 text-xs leading-snug text-ink-3">
                {t("addBalance.yapeNotHolistic", {
                  company: COBRANA_YAPE_SERVICE_COMPANY,
                })}
              </p>
            </div>

            <div>
              <h3 className="mb-2.5 text-sm font-semibold text-ink">
                {t("addBalance.yapeHowToTitle")}
              </h3>
              <HowToSteps
                steps={[
                  t("addBalance.yapeStep1"),
                  t("addBalance.yapeStep2", {
                    company: COBRANA_YAPE_SERVICE_COMPANY,
                  }),
                  t("addBalance.yapeStep3"),
                  t("addBalance.yapeStep4", {
                    amount: formatMoney(parsedAmount),
                  }),
                ]}
              />
            </div>

            {orderedLinks.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-ink-2">
                  {t("addBalance.mobileOpen")}
                </p>
                <div className="flex flex-col gap-2">
                  {orderedLinks.map((link) => {
                    const app = resolvePaymentAppKey(link.key, link.label);
                    return (
                      <button
                        key={`${link.key}-${link.url}`}
                        type="button"
                        className={cn(
                          "inline-flex h-10 w-full items-center justify-center gap-2.5 rounded-ctl px-4 text-sm font-semibold transition-colors",
                          paymentAppButtonClass(app),
                        )}
                        onClick={() => {
                          window.open(link.url, "_blank", "noopener,noreferrer");
                        }}
                      >
                        <PaymentAppIcon app={app} size="sm" />
                        {t("addBalance.openApp", {
                          app: paymentAppLabel(app, link.label),
                        })}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {error ? <PaymentFieldError>{error}</PaymentFieldError> : null}
          </PaymentDialogBody>

          <PaymentDialogFooter>
            <Button
              variant="outline"
              onClick={handleClose}
              className="w-full sm:w-auto"
            >
              {t("addBalance.closeWait")}
            </Button>
          </PaymentDialogFooter>
        </>
      ) : step === "proof" ? (
        <>
          <PaymentModalHeader
            titleId="add-balance-title"
            title={t("addBalance.titleProof")}
            description={
              selectedGateway === "crypto"
                ? t("addBalance.proofHint")
                : t("addBalance.proofManualHint")
            }
            {...gatewayHeader}
          />

          <PaymentDialogBody className="space-y-4">
            <div className="rounded-box border border-line bg-subtle px-3 py-2.5">
              <p className="text-sm font-semibold text-ink">
                {t("addBalance.receiveAmount", {
                  amount: formatMoney(parsedAmount),
                })}
                {feePreview
                  ? ` · total ${formatMoney(feePreview.grossCents / 100)}`
                  : null}
              </p>
              <p className="mt-1 text-xs text-ink-3">
                {t("addBalance.intentId")}{" "}
                <span className="break-all font-mono">{paymentIntentId}</span>
              </p>
            </div>

            <div>
              <p
                id="topup-proof-label"
                className="mb-1.5 text-sm font-medium text-ink"
              >
                {selectedGateway === "crypto"
                  ? "Captura / TxID"
                  : "Voucher o comprobante"}
              </p>
              {/* Zona para elegir el archivo (v3 «drop»). */}
              <label className="grid cursor-pointer justify-items-center gap-1 rounded-box border border-dashed border-line-strong bg-field p-5 text-center transition-colors hover:border-accent focus-within:border-accent focus-within:ring-[3px] focus-within:ring-[var(--ui-ring)]">
                <PanelIcon name="upload" className="text-ink-2" />
                <span className="max-w-full break-all text-sm font-semibold text-ink">
                  {proofFile ? proofFile.name : t("manualModal.uploadHint")}
                </span>
                <span className="text-xs text-ink-3">
                  Formatos permitidos: JPG, PNG, WEBP o PDF. Máximo 10 MB.
                </span>
                <input
                  id="topup-proof-file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  aria-labelledby="topup-proof-label"
                  className="sr-only"
                  onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            {error ? <PaymentFieldError>{error}</PaymentFieldError> : null}
          </PaymentDialogBody>

          <PaymentDialogFooter>
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={uploadingProof}
              className="w-full sm:w-auto"
            >
              {t("addBalance.uploadLater")}
            </Button>
            <Button
              onClick={handleProofUpload}
              disabled={uploadingProof}
              className="w-full sm:w-auto"
            >
              {uploadingProof
                ? t("addBalance.processing")
                : selectedGateway === "crypto"
                  ? t("addBalance.sendProof")
                  : t("addBalance.sendVoucher")}
            </Button>
          </PaymentDialogFooter>
        </>
      ) : (
        <>
          <PaymentModalHeader
            titleId="add-balance-title"
            title={
              paidConfirmed
                ? t("addBalance.titleDone")
                : t("addBalance.titleSubmitted")
            }
            description={
              paidConfirmed
                ? "El saldo ya está disponible en tu cartera Holistic."
                : "Guardamos la solicitud y podrás continuar cuando el pago sea confirmado."
            }
            {...gatewayHeader}
          />

          <PaymentDialogBody>
            <PaymentOutcome
              tone={paidConfirmed ? "ok" : "warn"}
              icon={paidConfirmed ? "check-circle" : "clock"}
            >
              {resultMessage}
            </PaymentOutcome>
          </PaymentDialogBody>

          <PaymentDialogFooter>
            <Button onClick={handleClose} className="w-full sm:w-auto">
              {tCommon("close")}
            </Button>
          </PaymentDialogFooter>
        </>
      )}
    </PaymentDialogFrame>,
    document.body,
  );
}

/** Rótulo del desglose con una segunda línea en gris. */
function CalcLabel({ main, sub }: { main: string; sub: string }) {
  return (
    <span className="grid">
      <span>{main}</span>
      <span className="text-xs font-normal text-ink-3">{sub}</span>
    </span>
  );
}
