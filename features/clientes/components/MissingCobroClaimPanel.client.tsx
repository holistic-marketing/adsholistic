"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { PanelCard } from "@/components/ui/PageHeader";
import { Note, SquareIcon, ToneBadge, type Tone } from "@/components/ui/PanelKit";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { cn } from "@/lib/cn";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import type { ManualPaymentIntentItem } from "@/services/payments.service";
import { listRecentPeriodos } from "@/lib/payments/missing-cobro.shared";

type ClaimForm = {
  amountUsd: string;
  periodoResumen: string;
  paymentFecha: string;
  metodo: string;
  operationCode: string;
  amountPen: string;
  notes: string;
};

const METODOS = ["Interbank", "BCP", "Yape", "Plin", "Otro"] as const;

/** Campos más altos en pantallas táctiles (el link público se abre en el celular). */
const TOUCH = "pointer-coarse:h-11";

const REVIEW_TONE: Partial<Record<ManualPaymentIntentItem["reviewStatus"], Tone>> = {
  approved: "ok",
  rejected: "neutral",
  pending_review: "info",
};

function todayLimaYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function reviewLabel(
  status: ManualPaymentIntentItem["reviewStatus"],
  t: ReturnType<typeof useTranslations>,
): string {
  switch (status) {
    case "awaiting_proof":
      return t("missingCobro.statusAwaiting");
    case "pending_review":
      return t("missingCobro.statusPending");
    case "approved":
      return t("missingCobro.statusApproved");
    case "rejected":
      return t("missingCobro.statusRejected");
    default:
      return status;
  }
}

export function MissingCobroClaimPanel({
  periodos: periodosProp,
  initialClaims,
  endpoints,
  fromDate,
}: {
  periodos?: string[];
  initialClaims?: ManualPaymentIntentItem[];
  /** YYYY-MM-DD: oculta reclamos anteriores (vista cliente de «Lo pagado»). */
  fromDate?: string;
  /** Link público: listar, crear y subir sin sesión. */
  endpoints?: {
    claims: string;
    proof: (paymentIntentId: string) => string;
  };
}) {
  const t = useTranslations("cobros");
  const router = useRouter();
  const uid = useId();
  const periodos = useMemo(
    () => (periodosProp?.length ? periodosProp : listRecentPeriodos(6)),
    [periodosProp],
  );

  const [open, setOpen] = useState(false);
  const [claims, setClaims] = useState<ManualPaymentIntentItem[]>(
    initialClaims ?? [],
  );
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingIntentId, setPendingIntentId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<ClaimForm>(() => ({
    amountUsd: "",
    periodoResumen: periodos[0] ?? "",
    paymentFecha: todayLimaYmd(),
    metodo: "Interbank",
    operationCode: "",
    amountPen: "",
    notes: "",
  }));

  const claimsEndpoint = endpoints?.claims ?? "/api/payments/missing-cobro";
  const refreshClaims = useCallback(
    () => apiClient<{
        ok: boolean;
        claims: ManualPaymentIntentItem[];
      }>(claimsEndpoint)
        .then((res) =>
          setClaims(
            (res.claims ?? []).filter(
              (claim) => !fromDate || String(claim.createdAt).slice(0, 10) >= fromDate,
            ),
          ),
        )
        .catch(() => { /* keep existing */ }),
    [claimsEndpoint, fromDate],
  );

  useEffect(() => {
    if (!initialClaims) void refreshClaims();
  }, [initialClaims, refreshClaims]);

  async function handleCreateAndUpload() {
    setError(null);
    setSuccess(null);
    const amountUsd = Number.parseFloat(form.amountUsd.replace(",", "."));
    if (!Number.isFinite(amountUsd) || amountUsd < 1) {
      setError(t("missingCobro.errAmount"));
      return;
    }
    if (!form.periodoResumen || !form.paymentFecha) {
      setError(t("missingCobro.errPeriod"));
      return;
    }
    if (!file) {
      setError(t("missingCobro.errFile"));
      return;
    }

    setBusy(true);
    try {
      const created = await apiClient<{
        ok: boolean;
        paymentIntentId: string;
        message?: string;
      }> (endpoints?.claims ?? "/api/payments/missing-cobro", {
        method: "POST",
        body: JSON.stringify({
          amountUsd,
          periodoResumen: form.periodoResumen,
          paymentFecha: form.paymentFecha,
          metodo: form.metodo,
          operationCode: form.operationCode || undefined,
          notes: form.notes || undefined,
          amountPen: form.amountPen
            ? Number.parseFloat(form.amountPen.replace(",", "."))
            : undefined,
        }),
      });

      setPendingIntentId(created.paymentIntentId);
      setUploading(true);

      const fd = new FormData();
      fd.append("proof", file);
      await apiClient(
        endpoints?.proof(created.paymentIntentId) ??
          `/api/payments/intents/${created.paymentIntentId}/proof`,
        {
        method: "POST",
        body: fd,
      });

      setSuccess(t("missingCobro.success"));
      setOpen(false);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setForm((f) => ({
        ...f,
        amountUsd: "",
        operationCode: "",
        amountPen: "",
        notes: "",
        paymentFecha: todayLimaYmd(),
      }));
      await refreshClaims();
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : t("missingCobro.errGeneric"),
      );
    } finally {
      setBusy(false);
      setUploading(false);
      setPendingIntentId(null);
    }
  }

  return (
    <section aria-labelledby={`${uid}-title`} className="space-y-4">
      {/* v3 «card soft»: fondo de campo, sin sombra. */}
      <div className="rounded-card border border-line bg-field p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 max-w-2xl">
            <p className="eyebrow">{t("missingCobro.eyebrow")}</p>
            <h2 id={`${uid}-title`} className="mt-1 text-base font-semibold leading-6 tracking-[-0.01em] text-ink">
              {t("missingCobro.title")}
            </h2>
            <p className="mt-1.5 text-ink-2">{t("missingCobro.body")}</p>
            <p className="mt-1.5 text-xs text-ink-3">{t("missingCobro.noWalletHint")}</p>
          </div>
          <Button
            variant={open ? "ghost" : "outline"}
            className="shrink-0 self-start pointer-coarse:h-11"
            aria-expanded={open}
            onClick={() => {
              setOpen((v) => !v);
              setError(null);
              setSuccess(null);
            }}
          >
            <PanelIcon name={open ? "x" : "upload"} />
            {open ? t("missingCobro.cancel") : t("missingCobro.cta")}
          </Button>
        </div>

        {success ? (
          <Note tone="ok" icon="check-circle" className="mt-4">
            {success}
          </Note>
        ) : null}

        {open ? (
          <div className="mt-4 space-y-4 rounded-box border border-line bg-surface p-4 shadow-ctl sm:p-5">
            <div className="grid gap-x-3 gap-y-4 sm:grid-cols-2">
              <Field id={`${uid}-period`} label={t("missingCobro.period")}>
                <Select
                  id={`${uid}-period`}
                  className={TOUCH}
                  value={form.periodoResumen}
                  onChange={(e) => setForm((f) => ({ ...f, periodoResumen: e.target.value }))}
                >
                  {periodos.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id={`${uid}-date`} label={t("missingCobro.paymentDate")}>
                <Input
                  id={`${uid}-date`}
                  type="date"
                  className={TOUCH}
                  value={form.paymentFecha}
                  onChange={(e) => setForm((f) => ({ ...f, paymentFecha: e.target.value }))}
                />
              </Field>
              <Field id={`${uid}-usd`} label={t("missingCobro.amountUsd")}>
                <Input
                  id={`${uid}-usd`}
                  type="number"
                  min="1"
                  step="0.01"
                  inputMode="decimal"
                  className={cn(TOUCH, "tabular-nums")}
                  value={form.amountUsd}
                  onChange={(e) => setForm((f) => ({ ...f, amountUsd: e.target.value }))}
                  placeholder="188.73"
                />
              </Field>
              <Field id={`${uid}-pen`} label={t("missingCobro.amountPenOptional")}>
                <Input
                  id={`${uid}-pen`}
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  className={cn(TOUCH, "tabular-nums")}
                  value={form.amountPen}
                  onChange={(e) => setForm((f) => ({ ...f, amountPen: e.target.value }))}
                  placeholder="636.38"
                />
              </Field>
              <Field id={`${uid}-method`} label={t("missingCobro.method")}>
                <Select
                  id={`${uid}-method`}
                  className={TOUCH}
                  value={form.metodo}
                  onChange={(e) => setForm((f) => ({ ...f, metodo: e.target.value }))}
                >
                  {METODOS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id={`${uid}-op`} label={t("missingCobro.opCode")}>
                <Input
                  id={`${uid}-op`}
                  type="text"
                  className={TOUCH}
                  value={form.operationCode}
                  onChange={(e) => setForm((f) => ({ ...f, operationCode: e.target.value }))}
                  placeholder="01048566"
                />
              </Field>
            </div>
            <Field id={`${uid}-notes`} label={t("missingCobro.notes")}>
              <Textarea
                id={`${uid}-notes`}
                rows={2}
                className="min-h-0"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </Field>
            <div className="grid min-w-0 gap-1.5">
              <span className="text-sm font-medium text-ink">{t("missingCobro.voucher")}</span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "flex w-full items-center gap-3 rounded-box border border-dashed px-3 py-3.5 text-left",
                  file
                    ? "border-ok-line bg-ok-bg"
                    : "border-line-strong bg-field hover:border-accent hover:bg-accent-soft",
                )}
              >
                <SquareIcon icon={file ? "check" : "upload"} tone={file ? "ok" : "accent"} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-ink">
                    {file ? file.name : t("missingCobro.voucherPick")}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-2">
                    {file ? t("missingCobro.voucherReady") : t("missingCobro.voucherHint")}
                  </span>
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>

            {error ? (
              <p className="flex items-start gap-1.5 text-xs text-danger-fg" role="alert">
                <PanelIcon name="alert" className="mt-px size-3.5" />
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button className="pointer-coarse:h-11" disabled={busy} onClick={() => void handleCreateAndUpload()}>
                {busy
                  ? uploading
                    ? t("missingCobro.uploading")
                    : t("missingCobro.creating")
                  : t("missingCobro.submit")}
              </Button>
              {pendingIntentId ? (
                <span className="font-mono text-[11px] text-ink-3">{pendingIntentId.slice(0, 8)}</span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {claims.length > 0 ? (
        <PanelCard title={t("missingCobro.myReports")} bodyClassName="pt-1 sm:pt-2">
          <ul>
            {claims.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2.5 last:border-0"
              >
                <div className="min-w-0">
                  <p className="num text-[13px] font-semibold text-ink">
                    ${c.amount.toFixed(2)} USD
                    {c.periodoResumen ? ` · ${c.periodoResumen}` : ""}
                  </p>
                  <p className="text-xs text-ink-3">
                    {c.claimedPaymentFecha ?? new Date(c.createdAt).toLocaleDateString("es-PE")}
                    {c.claimedMetodo ? ` · ${c.claimedMetodo}` : ""}
                    {c.failureReason && c.reviewStatus === "rejected" ? ` · ${c.failureReason}` : ""}
                  </p>
                </div>
                <ToneBadge tone={REVIEW_TONE[c.reviewStatus] ?? "warn"}>{reviewLabel(c.reviewStatus, t)}</ToneBadge>
              </li>
            ))}
          </ul>
        </PanelCard>
      ) : null}
    </section>
  );
}

/** Campo con su rótulo (v3 «field»). */
function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
    </div>
  );
}
