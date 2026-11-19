"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CobroComprobantePreview } from "@/features/clientes/components/CobroComprobantePreview.client";
import { moneyUsd } from "@/lib/format/money-usd";
import { SquareIcon } from "@/components/ui/PanelKit";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { cn } from "@/lib/cn";
import { MONTH_STEP, TD, TH } from "./cobros-ui";

export type CobroHistoryRow = {
  id: string;
  fecha: string | null;
  hora: string | null;
  codigo: string | null;
  periodoResumen: string | null;
  monto: number;
  metodo: string | null;
  comprobanteUrls: string[];
  registeredBy: string | null;
  registeredAt: string | null;
};

function limaMonthKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
  })
    .format(new Date())
    .slice(0, 7);
}

function shiftMonthKey(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

function formatMonthTitle(ym: string, locale: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

function cobroMonthKey(row: CobroHistoryRow): string | null {
  // Igual que Hecom Club / Ajustar: manda periodo_resumen sobre fecha de pago.
  const periodo = row.periodoResumen?.trim() ?? "";
  const fromPeriodo = periodo.match(/^(\d{4}-\d{2})/);
  if (fromPeriodo) return fromPeriodo[1];
  const fecha = row.fecha?.trim().slice(0, 10) ?? "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha.slice(0, 7);
  return null;
}

function formatHecomFecha(value: string | null, locale: string): string {
  if (!value) return "—";
  const iso = value.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return value;
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

function formatPeriodoResumen(value: string | null, locale: string): string {
  if (!value) return "—";
  const match = value.match(/^(\d{4})-(\d{2})/);
  if (!match) return value;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || month < 1 || month > 12) return value;
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function formatHora(value: string | null): string {
  if (!value) return "—";
  return value.slice(0, 5);
}

function limaYmdFromIso(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatRegisteredAt(
  registeredAt: string | null,
  paymentFecha: string | null,
  locale: string,
): { label: string; title: string } {
  if (!registeredAt) return { label: "—", title: "" };
  const date = new Date(registeredAt);
  if (Number.isNaN(date.getTime())) {
    return { label: registeredAt, title: "" };
  }
  const payYmd = paymentFecha?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
  const regYmd = limaYmdFromIso(registeredAt);
  const sameDay = Boolean(payYmd && regYmd && payYmd === regYmd);
  if (sameDay) {
    return {
      label: new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/Lima",
      }).format(date),
      title: "",
    };
  }
  return {
    label: new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "America/Lima",
    }).format(date),
    title: "",
  };
}

function maskEmail(email: string | null): string {
  if (!email) return "—";
  const [user, domain] = email.split("@");
  if (!domain) return email;
  if (user.length <= 2) return `${user}@${domain}`;
  return `${user.slice(0, 2)}…@${domain}`;
}

export function CobrosPaymentHistory({
  cobros,
  month: monthProp,
  onMonthChange,
  hideMonthPicker = false,
  hideStaff = false,
  proofEndpoint,
}: {
  cobros: CobroHistoryRow[];
  /** Mes controlado desde afuera (`YYYY-MM`). */
  month?: string;
  onMonthChange?: (ym: string) => void;
  /** Oculta el selector (cuando ya hay uno arriba). */
  hideMonthPicker?: boolean;
  /** Link público: oculta quién registró el cobro. */
  hideStaff?: boolean;
  /** GET del comprobante. En el link público reemplaza la ruta de staff. */
  proofEndpoint?: (cobroId: string, index: number) => string;
}) {
  const t = useTranslations("cobros");
  const locale = useLocale();
  const currentMonth = useMemo(() => limaMonthKey(), []);
  const [internalMonth, setInternalMonth] = useState(currentMonth);
  const controlled = typeof monthProp === "string" && /^\d{4}-\d{2}$/.test(monthProp);
  const month = controlled ? monthProp : internalMonth;
  const setMonth = (next: string | ((prev: string) => string)) => {
    const value = typeof next === "function" ? next(month) : next;
    if (!controlled) setInternalMonth(value);
    onMonthChange?.(value);
  };

  const oldestMonth = useMemo(() => {
    let min: string | null = null;
    for (const row of cobros) {
      const key = cobroMonthKey(row);
      if (!key) continue;
      if (!min || key < min) min = key;
    }
    return min;
  }, [cobros]);

  const filtered = useMemo(
    () =>
      cobros.filter((row) => {
        const key = cobroMonthKey(row);
        return key === month;
      }),
    [cobros, month],
  );

  const monthTotal = useMemo(
    () =>
      Math.round(filtered.reduce((sum, row) => sum + Number(row.monto || 0), 0) * 100) /
      100,
    [filtered],
  );

  const canPrev = Boolean(oldestMonth && shiftMonthKey(month, -1) >= oldestMonth);
  const canNext = month < currentMonth;
  const showProofs = !hideStaff || Boolean(proofEndpoint);

  return (
    <section
      aria-labelledby="cobros-history-title"
      className="min-w-0 overflow-hidden rounded-card border border-line bg-surface shadow-card"
    >
      <div className="flex flex-col gap-3 px-4 pb-3 pt-4 sm:flex-row sm:items-start sm:justify-between sm:px-6 sm:pt-5">
        <div className="min-w-0">
          <h2 id="cobros-history-title" className="text-base font-semibold leading-6 tracking-[-0.01em] text-ink">
            {t("historyTitle")}
          </h2>
          <p className="mt-0.5 text-xs text-ink-2">
            {t("historyMonthHint", {
              count: filtered.length,
              total: moneyUsd(monthTotal),
            })}
          </p>
          {hideMonthPicker ? (
            <p className="mt-0.5 text-xs text-ink-3">
              {t("historySyncedMonth", {
                month: formatMonthTitle(month, locale),
              })}
            </p>
          ) : null}
        </div>

        {hideMonthPicker ? null : (
          <div className="flex items-center gap-1.5 self-start">
            <button
              type="button"
              aria-label={t("prevMonth")}
              disabled={!canPrev}
              onClick={() => setMonth((m) => shiftMonthKey(m, -1))}
              className={MONTH_STEP}
            >
              <PanelIcon name="chevron-left" />
            </button>
            <div className="min-w-[150px] text-center leading-tight">
              <p className="font-semibold text-ink first-letter:uppercase">{formatMonthTitle(month, locale)}</p>
              {month === currentMonth ? <p className="text-xs text-ink-3">{t("thisMonth")}</p> : null}
            </div>
            <button
              type="button"
              aria-label={t("nextMonth")}
              disabled={!canNext}
              onClick={() => setMonth((m) => shiftMonthKey(m, 1))}
              className={MONTH_STEP}
            >
              <PanelIcon name="chevron-right" />
            </button>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="px-4 pb-5 sm:px-6">
          <p className="rounded-box bg-field px-4 py-8 text-center text-[13px] text-ink-2">{t("emptyMonth")}</p>
        </div>
      ) : (
        <>
          {/* Celular: lista (v3 «rows»). */}
          <ul className="border-t border-line px-4 md:hidden">
            {filtered.map((row) => (
              <li key={row.id} className="flex items-start justify-between gap-3 border-b border-line py-3 last:border-0">
                <div className="flex min-w-0 items-start gap-3">
                  <SquareIcon icon="check" tone="ok" />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-ink">{row.metodo ?? "—"}</p>
                    <p className="num text-[11px] text-ink-3">
                      {formatHecomFecha(row.fecha, locale)}
                      {row.hora ? ` · ${formatHora(row.hora)}` : ""}
                    </p>
                    {row.codigo ? <p className="truncate font-mono text-[11px] text-ink-2">{row.codigo}</p> : null}
                    {showProofs && row.comprobanteUrls.length > 0 ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {row.comprobanteUrls.map((_, index) => (
                          <CobroComprobantePreview
                            key={`${row.id}-m-${index}`}
                            cobroId={row.id}
                            index={index}
                            endpoint={proofEndpoint?.(row.id, index)}
                            label={row.comprobanteUrls.length > 1 ? t("proofN", { n: index + 1 }) : t("proof")}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="num text-[13px] font-semibold text-ok-fg">+{moneyUsd(row.monto)}</p>
                  <p className="mt-0.5 text-[11px] capitalize text-ink-3">
                    {formatPeriodoResumen(row.periodoResumen, locale)}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          {/* Desde tablet: tabla (v3 «grid»). */}
          <div className="hidden overflow-x-auto px-2 pb-2 md:block">
            <table className="w-full min-w-[920px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className={cn(TH, "text-left")}>{t("colDate")}</th>
                  <th className={cn(TH, "text-left")}>{t("colTime")}</th>
                  <th className={cn(TH, "text-left")}>{t("colCode")}</th>
                  <th className={cn(TH, "text-left")}>{t("colPeriod")}</th>
                  <th className={cn(TH, "text-right")}>{t("colAmount")}</th>
                  <th className={cn(TH, "text-left")}>{t("colMethod")}</th>
                  {showProofs ? <th className={cn(TH, "text-left")}>{t("colProofs")}</th> : null}
                  {hideStaff ? null : <th className={cn(TH, "text-left")}>{t("colRegisteredBy")}</th>}
                  <th className={cn(TH, "text-left")}>{t("colCrmIn")}</th>
                </tr>
              </thead>
              <tbody className="[&>tr:last-child>td]:border-b-0">
                {filtered.map((row) => {
                  const registered = formatRegisteredAt(row.registeredAt, row.fecha, locale);
                  return (
                    <tr key={row.id} className="hover:bg-field">
                      <td className={cn(TD, "font-medium text-ink")}>{formatHecomFecha(row.fecha, locale)}</td>
                      <td className={cn(TD, "num text-ink-2")}>{formatHora(row.hora)}</td>
                      <td className={cn(TD, "font-mono text-xs text-ink-2")}>{row.codigo ?? "—"}</td>
                      <td className={cn(TD, "capitalize text-ink")}>
                        {formatPeriodoResumen(row.periodoResumen, locale)}
                      </td>
                      <td className={cn(TD, "num text-right font-semibold text-ok-fg")}>+{moneyUsd(row.monto)}</td>
                      <td className={cn(TD, "text-ink")}>{row.metodo ?? "—"}</td>
                      {showProofs ? (
                        <td className={TD}>
                          {row.comprobanteUrls.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-2">
                              {row.comprobanteUrls.map((_, index) => (
                                <CobroComprobantePreview
                                  key={`${row.id}-${index}`}
                                  cobroId={row.id}
                                  index={index}
                                  endpoint={proofEndpoint?.(row.id, index)}
                                  label={row.comprobanteUrls.length > 1 ? t("proofN", { n: index + 1 }) : t("proof")}
                                />
                              ))}
                            </div>
                          ) : (
                            <span className="text-ink-3">—</span>
                          )}
                        </td>
                      ) : null}
                      {hideStaff ? null : <td className={cn(TD, "text-ink-2")}>{maskEmail(row.registeredBy)}</td>}
                      <td className={cn(TD, "num text-[13px] text-ink-2")} title={registered.title || undefined}>
                        {registered.label}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
