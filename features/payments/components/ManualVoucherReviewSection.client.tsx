"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button, buttonClass } from "@/components/ui/Button";
import { Avatar, Note, ToneBadge, type Tone } from "@/components/ui/PanelKit";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { formatMoney } from "@/lib/format-money";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import type { ManualPaymentIntentItem } from "@/services/payments.service";
import {
  formatPenAmount,
  quoteFromGrossCharge,
} from "@/lib/payments/manual-deposit.shared";
import { detectAmountEnteredWithoutFee } from "@/lib/payments/manual-amount-guard.shared";
import { ComprobanteLightbox } from "@/features/clientes/components/ComprobanteLightbox.client";
import { PaymentAmountInput, PaymentCalc, PaymentFieldError } from "./PaymentDialog";

const reviewTones: Record<ManualPaymentIntentItem["reviewStatus"], Tone> = {
  awaiting_proof: "warn",
  pending_review: "info",
  approved: "ok",
  rejected: "neutral",
  cancelled: "neutral",
};

/* Enlace de texto dentro de la tarjeta (ampliar, usar esperado). */
const LINK =
  "text-xs font-medium text-accent-text underline decoration-transparent underline-offset-2 hover:decoration-current";

function isImageMime(mime: string | null, fileName: string | null): boolean {
  if (mime?.startsWith("image/")) return true;
  const name = (fileName ?? "").toLowerCase();
  return /\.(png|jpe?g|webp|gif)$/.test(name);
}

function VoucherCard({
  intent,
  canReview,
  product = "wallet",
}: {
  intent: ManualPaymentIntentItem;
  canReview: boolean;
  product?: "wallet" | "realprofit" | "missing_cobro";
}) {
  const t = useTranslations("payments");
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const isRealProfit = product === "realprofit";
  const isMissingCobro = product === "missing_cobro";
  const isDebtPayment = intent.purpose === "lo_pagado_deuda";
  const proofIsImage = isImageMime(intent.proofMimeType, intent.proofFileName);

  const reviewLabels = {
    awaiting_proof: t("voucherReview.statusAwaiting"),
    pending_review: t("voucherReview.statusPending"),
    approved: t("voucherReview.statusApproved"),
    rejected: t("voucherReview.statusRejected"),
    cancelled: t("voucherReview.statusCancelled"),
  } as const;

  const chargeCurrency =
    intent.currency.toUpperCase() === "PEN" ? "PEN" : "USD";
  const feePercent =
    isRealProfit || isMissingCobro || isDebtPayment
      ? 0
      : (intent.feePercent ?? 10);
  const fxRate = intent.fxRateUsdPen ?? 3.48;
  // Si la IA no leyó el comprobante, el monto queda vacío: soporte escribe lo que ve.
  // Antes se ponía el monto del pedido y se aprobó $1,100 con un voucher de $1,000 (Marcelo, 09/10/2026).
  const aiReadAmount =
    intent.detectedAmount != null && intent.detectedAmount > 0;

  const [amountInput, setAmountInput] = useState(() =>
    aiReadAmount
      ? String(Math.round(intent.detectedAmount! * 100) / 100)
      : "",
  );
  const [periodoInput, setPeriodoInput] = useState(
    () => intent.periodoResumen ?? "",
  );

  const parsedAmount = Number.parseFloat(amountInput.replace(",", "."));
  const quote = useMemo(() => {
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return null;
    if (isRealProfit || isMissingCobro || isDebtPayment) {
      return {
        grossChargeCents: Math.round(parsedAmount * 100),
        creditUsdCents: 0,
        feeUsdCents: 0,
        feePercent: 0,
        fxRateUsdPen: fxRate,
        grossUsdCents: Math.round(parsedAmount * 100),
        grossPenCents: 0,
        creditPenCents: 0,
        feePenCents: 0,
      };
    }
    return quoteFromGrossCharge({
      grossChargeCents: Math.round(parsedAmount * 100),
      chargeCurrency,
      feePercent,
      fxRateUsdPen: fxRate,
    });
  }, [parsedAmount, chargeCurrency, feePercent, fxRate, isRealProfit, isMissingCobro, isDebtPayment]);

  // Monto escrito = esperado/OCR menos el fee → el fee se cobraría dos veces.
  const feeAlreadyRemovedFrom = useMemo(() => {
    if (feePercent <= 0 || !Number.isFinite(parsedAmount) || parsedAmount <= 0) return null;
    return detectAmountEnteredWithoutFee({
      enteredCents: Math.round(parsedAmount * 100),
      referenceCents: [
        Math.round(intent.amount * 100),
        intent.detectedAmount != null ? Math.round(intent.detectedAmount * 100) : null,
      ],
      feePercent,
    });
  }, [parsedAmount, feePercent, intent.amount, intent.detectedAmount]);

  const showActions =
    canReview && intent.reviewStatus === "pending_review";

  async function handleApprove() {
    if (!quote) {
      setError(t("voucherReview.errAmount"));
      return;
    }
    if (feeAlreadyRemovedFrom != null) {
      setError(
        `Ese monto ya tiene el fee descontado. Escribe lo que llegó (${(feeAlreadyRemovedFrom / 100).toFixed(2)}): el sistema descuenta el fee solo.`,
      );
      return;
    }
    if (isMissingCobro) {
      const periodo = periodoInput.trim();
      if (!/^\d{4}-\d{2}$/.test(periodo)) {
        setError(t("voucherReview.errPeriod"));
        return;
      }
    }
    setBusy("approve");
    setError(null);
    try {
      await apiClient(`/api/payments/manual/${intent.id}/approve`, {
        method: "POST",
        body: JSON.stringify({
          adjustedGrossChargeCents: quote.grossChargeCents,
          ...(isMissingCobro
            ? { adjustedPeriodoResumen: periodoInput.trim() }
            : {}),
        }),
      });
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : t("voucherReview.errApprove"),
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleReject() {
    const reason =
      rejectReason.trim() || t("voucherReview.rejectDefault");
    setBusy("reject");
    setError(null);
    try {
      await apiClient(`/api/payments/manual/${intent.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      setRejectOpen(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : t("voucherReview.errReject"),
      );
    } finally {
      setBusy(null);
    }
  }

  const clientName =
    intent.hecomClienteName?.trim() || intent.organizationName || "Cliente";
  const amountId = `voucher-amount-${intent.id}`;
  const periodId = `voucher-period-${intent.id}`;

  return (
    <article className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="relative min-h-[200px] border-b border-line bg-subtle lg:border-b-0 lg:border-r">
          {intent.proofSignedUrl ? (
            proofIsImage ? (
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="group relative flex h-full min-h-[200px] w-full cursor-zoom-in items-center justify-center"
                title="Ampliar comprobante"
                aria-label="Ampliar comprobante"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={intent.proofSignedUrl}
                  alt={intent.proofFileName ?? "Comprobante"}
                  className="h-full max-h-[320px] w-full object-contain object-center p-3 transition duration-200 group-hover:scale-[1.02]"
                />
                <span className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-ctl border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink shadow-pop">
                  <PanelIcon name="search" className="size-3.5!" />
                  Ampliar
                </span>
              </button>
            ) : (
              <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 p-6 text-center">
                <span aria-hidden className="grid size-10 place-items-center rounded-box bg-surface text-ink">
                  <PanelIcon name="file" />
                </span>
                <p className="max-w-full break-all text-sm font-medium text-ink">
                  {intent.proofFileName ?? "Archivo adjunto"}
                </p>
                <a
                  href={intent.proofSignedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonClass("outline", "sm")}
                >
                  {t("voucherReview.openProof")}
                  <PanelIcon name="external" />
                </a>
              </div>
            )
          ) : (
            <div className="flex h-full min-h-[200px] items-center justify-center p-6 text-sm text-ink-3">
              {t("voucherReview.noPreview")}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-2.5">
              <Avatar name={clientName} />
              <div className="min-w-0">
                <p className="eyebrow">
                  {isDebtPayment
                    ? "Pago de deuda · Lo pagado"
                    : isMissingCobro
                    ? "Cobro faltante · Lo pagado"
                    : isRealProfit
                      ? "Real Profit COD · $20"
                      : intent.provider === "crypto"
                        ? "Cripto"
                        : intent.payMethod === "binance"
                          ? "Binance Pay"
                          : "Transferencia BCP"}
                </p>
                <h3 className="mt-0.5 truncate text-base font-semibold text-ink">
                  {clientName}
                </h3>
                <p className="break-all text-xs text-ink-3">
                  {intent.actorEmail ?? intent.actorName ?? "—"}
                </p>
                {isDebtPayment && intent.periodoResumen ? (
                  <p className="mt-1 text-xs font-medium text-accent-text">
                    Deuda del mes: {intent.periodoResumen}
                  </p>
                ) : null}
                {isMissingCobro && intent.periodoResumen ? (
                  <p className="mt-1 text-xs font-medium text-info-fg">
                    Mes pedido: {intent.periodoResumen}
                    {intent.claimedPaymentFecha
                      ? ` · Fecha voucher: ${intent.claimedPaymentFecha}`
                      : ""}
                    {intent.claimedMetodo ? ` · ${intent.claimedMetodo}` : ""}
                  </p>
                ) : null}
                {intent.shopDomain ? (
                  <p className="mt-1 break-all font-mono text-[11px] text-ink-3">
                    Tienda: {intent.shopDomain}
                  </p>
                ) : null}
                {intent.hecomClienteName &&
                intent.organizationName &&
                intent.hecomClienteName.trim() !==
                  intent.organizationName.trim() ? (
                  <p className="mt-1 text-xs text-ink-3">
                    Org: {intent.organizationName}
                  </p>
                ) : null}
              </div>
            </div>
            <ToneBadge tone={reviewTones[intent.reviewStatus]} dot>
              {reviewLabels[intent.reviewStatus]}
            </ToneBadge>
          </div>

          <div className="rounded-box border border-line bg-field p-3">
            {showActions ? (
              <>
                <label htmlFor={amountId} className="block text-sm font-medium text-ink">
                  {t("voucherReview.realAmount", { currency: chargeCurrency })}
                </label>
                {!aiReadAmount ? (
                  <p className="mt-1 text-xs font-medium text-accent-text">
                    La IA no leyó este comprobante. Escribe el monto que ves en
                    la imagen, no el del pedido.
                  </p>
                ) : null}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <PaymentAmountInput
                    id={amountId}
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0.01"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    aria-label={t("voucherReview.realAmount", { currency: chargeCurrency })}
                    aria-invalid={feeAlreadyRemovedFrom != null || undefined}
                    prefix={chargeCurrency === "PEN" ? "S/" : "$"}
                    suffix={chargeCurrency}
                    big
                    className="w-full max-w-[15rem]"
                  />
                  <button
                    type="button"
                    className={LINK}
                    onClick={() =>
                      setAmountInput(
                        String(Math.round(intent.amount * 100) / 100),
                      )
                    }
                  >
                    Usar esperado
                  </button>
                </div>
                <p className="num mt-1.5 text-xs text-ink-3">
                  Esperado:{" "}
                  {chargeCurrency === "PEN"
                    ? formatPenAmount(Math.round(intent.amount * 100))
                    : formatMoney(intent.amount, "USD")}
                  {intent.detectedAmount != null
                    ? ` · OCR: ${
                        chargeCurrency === "PEN"
                          ? formatPenAmount(
                              Math.round(intent.detectedAmount * 100),
                            )
                          : formatMoney(intent.detectedAmount, "USD")
                      }`
                    : ""}
                </p>
                {feePercent > 0 ? (
                  <p className="mt-1 text-xs text-ink-3">
                    Escribe lo que llegó, con el fee incluido. El fee se descuenta solo.
                  </p>
                ) : null}
                {feeAlreadyRemovedFrom != null ? (
                  <PaymentFieldError className="mt-1">
                    Este monto ya tiene el fee descontado: el fee se cobraría dos veces.
                    Escribe {(feeAlreadyRemovedFrom / 100).toFixed(2)}.
                  </PaymentFieldError>
                ) : null}
                <div className="mt-3">
                  {isDebtPayment ? (
                    <p className="text-xs text-ink-2">
                      Al aceptar:{" "}
                      <span className="font-semibold text-ink">
                        registra el cobro y baja la deuda
                      </span>{" "}
                      (no acredita cartera).
                    </p>
                  ) : isMissingCobro ? (
                    <p className="text-xs text-ink-2">
                      Al aceptar:{" "}
                      <span className="font-semibold text-ink">
                        registra cobro en Hecom
                      </span>{" "}
                      (no acredita cartera).
                    </p>
                  ) : isRealProfit ? (
                    <p className="text-xs text-ink-2">
                      Al aceptar:{" "}
                      <span className="font-semibold text-ink">
                        activa Real Profit COD + vincula tienda
                      </span>
                      {" "}
                      (no acredita cartera ads).
                    </p>
                  ) : (
                    <PaymentCalc
                      live
                      rows={[
                        {
                          label: `Fee ${feePercent}%`,
                          value: quote
                            ? chargeCurrency === "PEN" &&
                              quote.feePenCents != null
                              ? formatPenAmount(quote.feePenCents)
                              : formatMoney(quote.feeUsdCents / 100, "USD")
                            : "—",
                        },
                        {
                          label: "Acredita a cartera",
                          value: quote
                            ? formatMoney(quote.creditUsdCents / 100, "USD")
                            : "—",
                          total: true,
                        },
                      ]}
                    />
                  )}
                </div>
                {isMissingCobro ? (
                  <div className="mt-3">
                    <label htmlFor={periodId} className="block text-sm font-medium text-ink">
                      Período Hecom (AAAA-MM)
                    </label>
                    <input
                      id={periodId}
                      type="month"
                      value={periodoInput}
                      onChange={(e) => setPeriodoInput(e.target.value)}
                      className="num mt-1.5 h-9 w-full max-w-[11rem] rounded-ctl border border-line bg-surface px-3 text-sm font-semibold text-ink shadow-ctl outline-none hover:border-line-strong focus-visible:border-accent focus-visible:ring-[3px] focus-visible:ring-[var(--ui-ring)]"
                    />
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <p className="text-xs text-ink-3">
                  {t("voucherReview.charged")}
                </p>
                <p className="num text-lg font-semibold text-ink">
                  {formatMoney(intent.amount, intent.currency)}
                </p>
                <div className="mt-1 space-y-0.5 text-xs text-ink-2">
                  {isDebtPayment ? (
                    <p>
                      Pago de deuda
                      {intent.periodoResumen ? ` · ${intent.periodoResumen}` : ""}
                      . No acredita cartera.
                    </p>
                  ) : intent.creditUsd != null ? (
                    <p>
                      Acredita a cartera:{" "}
                      <span className="num font-semibold text-ink">
                        {formatMoney(intent.creditUsd, "USD")}
                      </span>
                    </p>
                  ) : null}
                  {!isDebtPayment && intent.feePercent != null ? (
                    <p>
                      Fee:{" "}
                      <span className="num font-semibold text-ink">
                        {intent.feePercent}%
                      </span>
                    </p>
                  ) : null}
                </div>
              </>
            )}
          </div>

          <p className="flex flex-wrap items-center gap-x-1.5 break-words text-xs text-ink-3">
            <PanelIcon name="file" className="size-3.5!" />
            {new Date(intent.createdAt).toLocaleString("es-PE")}
            {intent.proofFileName ? ` · ${intent.proofFileName}` : ""}
            {" · "}
            <span className="font-mono text-[11px]">
              {intent.id.slice(0, 8)}
            </span>
          </p>

          {intent.analysisReason ? (
            <Note tone="warn" className="break-words">
              {intent.analysisReason}
            </Note>
          ) : null}

          {intent.failureReason && intent.reviewStatus === "rejected" ? (
            <p className="text-xs text-danger-fg">{intent.failureReason}</p>
          ) : null}

          {error ? <PaymentFieldError className="mt-0">{error}</PaymentFieldError> : null}

          {showActions ? (
            <div className="mt-auto space-y-2.5 border-t border-line pt-3">
              <p className="text-xs text-ink-3">
                {isMissingCobro
                  ? "Revisa monto y mes, ajústalos si el voucher no cuadra, y acepta. Solo crea el cobro en Hecom — no toca la cartera."
                  : isRealProfit
                    ? "Revisa el voucher y acepta para activar Real Profit COD."
                    : "Revisa el monto de la boleta, ajústalo si es necesario y luego acepta. El saldo se acredita en la cartera y el registro pasa a Lo pagado."}
              </p>
              {!rejectOpen ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy !== null || !quote}
                    onClick={() => void handleApprove()}
                  >
                    <PanelIcon name="check" />
                    {busy === "approve"
                      ? t("voucherReview.approving")
                      : t("voucherReview.approve")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy !== null}
                    onClick={() => setRejectOpen(true)}
                  >
                    Rechazar
                  </Button>
                  {intent.proofSignedUrl ? (
                    proofIsImage ? (
                      <button
                        type="button"
                        onClick={() => setLightboxOpen(true)}
                        className={`${LINK} ml-1`}
                      >
                        Ampliar foto
                      </button>
                    ) : (
                      <a
                        href={intent.proofSignedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={`${LINK} ml-1`}
                      >
                        Ver original
                      </a>
                    )
                  ) : null}
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={2}
                    placeholder="Motivo visible para el cliente…"
                    aria-label="Motivo visible para el cliente"
                    className="w-full rounded-ctl border border-line bg-surface px-3 py-2 text-sm text-ink shadow-ctl outline-none placeholder:text-ink-3 hover:border-line-strong focus-visible:border-accent focus-visible:ring-[3px] focus-visible:ring-[var(--ui-ring)]"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      disabled={busy !== null}
                      onClick={() => void handleReject()}
                    >
                      {busy === "reject" ? "Rechazando…" : "Confirmar rechazo"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy !== null}
                      onClick={() => setRejectOpen(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {intent.proofSignedUrl && proofIsImage ? (
        <ComprobanteLightbox
          open={lightboxOpen}
          url={intent.proofSignedUrl}
          title={intent.proofFileName ?? "Comprobante BCP"}
          kind="image"
          onClose={() => setLightboxOpen(false)}
        />
      ) : null}
    </article>
  );
}

interface ManualVoucherReviewSectionProps {
  pending: ManualPaymentIntentItem[];
  recent: ManualPaymentIntentItem[];
  pendingCount: number;
  canReview: boolean;
  /** Cliente: solo sus vouchers (lista plana). */
  clientItems?: ManualPaymentIntentItem[];
  mode: "staff" | "client";
  /** Cola de todos los clientes (copy de gerente). */
  globalQueue?: boolean;
  /** wallet = recarga cartera; realprofit = +$20 COD; missing_cobro = Hecom only */
  product?: "wallet" | "realprofit" | "missing_cobro";
}

export function ManualVoucherReviewSection({
  pending,
  recent,
  pendingCount,
  canReview,
  clientItems,
  mode,
  globalQueue = false,
  product = "wallet",
}: ManualVoucherReviewSectionProps) {
  const t = useTranslations("payments");

  if (mode === "client") {
    const items = clientItems ?? [];
    if (items.length === 0) return null;
    return (
      <section
        id="comprobantes"
        className="space-y-4"
        aria-label={t("voucherReview.yourAria")}
      >
        <div>
          <h2 className="text-base font-semibold tracking-[-0.01em] text-ink">
            {t("voucherReview.yourProofs")}
          </h2>
          <p className="mt-1 text-sm text-ink-3">
            {t("voucherReview.yourProofsBody")}
          </p>
        </div>
        <div className="space-y-4">
          {items.map((intent) => (
            <VoucherCard
              key={intent.id}
              intent={intent}
              canReview={false}
              product={product}
            />
          ))}
        </div>
      </section>
    );
  }

  if (pending.length === 0) return null;

  const isRealProfit = product === "realprofit";
  const isMissingCobro = product === "missing_cobro";

  return (
    <section
      id="comprobantes"
      className="space-y-4"
      aria-label={t("voucherReview.staffAria")}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold tracking-[-0.01em] text-ink">
            {isMissingCobro
              ? globalQueue
                ? "Cobros faltantes pendientes"
                : "Pendientes · cobro faltante"
              : isRealProfit
                ? globalQueue
                  ? "Pagos Profit pendientes"
                  : "Pendientes Profit"
                : globalQueue
                  ? "Pagos manuales pendientes"
                  : "Pendientes"}
          </h2>
          {pendingCount > 0 ? (
            <ToneBadge tone="warn" className="num">
              {pendingCount}
            </ToneBadge>
          ) : null}
        </div>
        <p className="mt-1 max-w-[78ch] text-sm text-ink-3">
          {isMissingCobro
            ? "Reportes desde Lo pagado: al aceptar se crea el cobro en Hecom (sin cartera)"
            : isRealProfit
              ? t("voucherReview.staffRealProfit")
              : "Solo boletas BCP por aceptar o rechazar"}
          {globalQueue ? t("voucherReview.staffGlobal") : ""}.
          {isMissingCobro
            ? " Puedes corregir monto y mes antes de aceptar."
            : isRealProfit
              ? " Al aceptar se activa COD y se vincula la tienda (sin cartera ads)."
              : " Edita el monto de la boleta si no coincide y luego acepta."}
        </p>
      </div>

      <div className="space-y-4">
        {pending.map((intent) => (
          <VoucherCard
            key={intent.id}
            intent={intent}
            canReview={canReview}
            product={product}
          />
        ))}
      </div>
    </section>
  );
}
