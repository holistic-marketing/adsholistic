"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import {
  CobrosPaymentHistory,
  type CobroHistoryRow,
} from "@/features/clientes/components/CobrosPaymentHistory.client";
import {
  VoucherAccountStatement,
  type StatementCobro,
  type StatementGasto,
} from "@/features/clientes/components/VoucherAccountStatement.client";
import { todayYmdInTz } from "@/lib/hecom/gasto-date";
import { buttonClass } from "@/components/ui/Button";
import { SquareIcon } from "@/components/ui/PanelKit";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { cn } from "@/lib/cn";
import { MONTH_STEP } from "./cobros-ui";

function limaMonthKey(): string {
  return todayYmdInTz("America/Lima").slice(0, 7);
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

function formatMonthShort(ym: string, locale: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

function ymdMonth(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();
  const iso = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso.slice(0, 7);
  const periodo = raw.match(/^(\d{4}-\d{2})/);
  return periodo ? periodo[1] : null;
}

type Props = {
  pendingByMonth?: Record<string, number> | null;
  gastos: StatementGasto[];
  cobros: StatementCobro[];
  historyCobros: CobroHistoryRow[];
  feePercent: number;
  capped: boolean;
  /** YYYY-MM del mensaje de cobranza. Vacío = mes actual Lima. */
  initialMonth?: string;
  hideStaff?: boolean;
  /** Link público: solo el mes del mensaje, sin ir a meses anteriores. */
  lockMonth?: boolean;
  /** Link público: el mes elegido va a la URL (?m=) para que pagar y reclamar usen ese mes. */
  syncMonthToUrl?: boolean;
  /** Prefijo público de comprobantes. La función se arma en el cliente. */
  proofApiBase?: string;
};

/**
 * Mes compartido: picker arriba → gráfica Cuánto debes + historial de pagos.
 */
export function ClienteCobrosMonthView({
  pendingByMonth,
  gastos,
  cobros,
  historyCobros,
  feePercent,
  capped,
  initialMonth,
  hideStaff = false,
  lockMonth = false,
  syncMonthToUrl = false,
  proofApiBase,
}: Props) {
  const t = useTranslations("cobros");
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const currentMonth = useMemo(() => limaMonthKey(), []);
  const [month, setMonth] = useState(() => {
    const now = limaMonthKey();
    return initialMonth && /^\d{4}-\d{2}$/.test(initialMonth) && initialMonth <= now
      ? initialMonth
      : now;
  });

  const oldestMonth = useMemo(() => {
    let min = currentMonth;
    for (const row of gastos) {
      const key = ymdMonth(row.fecha);
      if (key && key < min) min = key;
    }
    for (const row of cobros) {
      const key = ymdMonth(row.periodoResumen) || ymdMonth(row.fecha);
      if (key && key < min) min = key;
    }
    for (const row of historyCobros) {
      const key = ymdMonth(row.periodoResumen) || ymdMonth(row.fecha);
      if (key && key < min) min = key;
    }
    return min;
  }, [cobros, currentMonth, gastos, historyCobros]);

  const recentMonths = useMemo(() => {
    const list: string[] = [];
    let cur = currentMonth;
    for (let i = 0; i < 6; i++) {
      if (cur < oldestMonth) break;
      list.push(cur);
      cur = shiftMonthKey(cur, -1);
    }
    return list;
  }, [currentMonth, oldestMonth]);

  const selectMonth = (ym: string) => {
    setMonth(ym);
    if (syncMonthToUrl) router.replace(`${pathname}?m=${ym}`, { scroll: false });
  };

  const canPrev = shiftMonthKey(month, -1) >= oldestMonth;
  const canNext = month < currentMonth;
  const isCurrent = month === currentMonth;

  return (
    <div className="space-y-4">
      <section className="min-w-0 rounded-card border border-line bg-surface shadow-card">
        {/* Cabecera v3: meses a la izquierda, flechas a la derecha. */}
        <div className="flex flex-col gap-4 border-b border-line px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6 sm:py-5">
          <div className="min-w-0">
            <h2 className="eyebrow">{t("monthScopeEyebrow")}</h2>
            <p className="mt-0.5 text-xs text-ink-3">
              {lockMonth ? "Gastos, deuda y pagos de este mes." : t("monthScopeHint")}
            </p>
            {!lockMonth && recentMonths.length > 1 ? (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5" role="group" aria-label={t("monthScopeEyebrow")}>
                {recentMonths.map((ym) => (
                  <button
                    key={ym}
                    type="button"
                    onClick={() => selectMonth(ym)}
                    aria-pressed={ym === month}
                    className={cn(
                      "inline-flex h-8 items-center rounded-ctl border px-3 text-[13px] font-medium capitalize shadow-ctl pointer-coarse:h-9",
                      ym === month
                        ? "border-accent-line bg-accent-soft text-accent-text"
                        : "border-line bg-field text-ink hover:border-line-strong hover:bg-hover",
                    )}
                  >
                    {formatMonthShort(ym, locale)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {lockMonth ? (
            <div className="flex items-center gap-2.5">
              <SquareIcon icon="calendar" tone="accent" />
              <span className="leading-tight">
                <span className="block font-semibold text-ink first-letter:uppercase">{formatMonthTitle(month, locale)}</span>
                <span className="block text-xs text-ink-3">Solo este mes</span>
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {!isCurrent ? (
                <button type="button" onClick={() => selectMonth(currentMonth)} className={buttonClass("outline", "sm")}>
                  {t("jumpCurrentMonth")}
                </button>
              ) : null}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label={t("prevMonth")}
                  disabled={!canPrev}
                  onClick={() => selectMonth(shiftMonthKey(month, -1))}
                  className={MONTH_STEP}
                >
                  <PanelIcon name="chevron-left" />
                </button>
                <div className="min-w-[150px] text-center leading-tight" aria-live="polite">
                  <p className="font-semibold text-ink first-letter:uppercase">{formatMonthTitle(month, locale)}</p>
                  <p className="text-xs text-ink-3">{isCurrent ? t("thisMonth") : t("monthScopeSynced")}</p>
                </div>
                <button
                  type="button"
                  aria-label={t("nextMonth")}
                  disabled={!canNext}
                  onClick={() => selectMonth(shiftMonthKey(month, 1))}
                  className={MONTH_STEP}
                >
                  <PanelIcon name="chevron-right" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="px-4 pb-4 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
          <VoucherAccountStatement
            pendingUsd={pendingByMonth === null ? null : pendingByMonth ? pendingByMonth[month] ?? 0 : undefined}
            monthYm={month}
            feePercent={feePercent}
            capped={capped}
            gastos={gastos}
            cobros={cobros}
            embedded
          />
        </div>
      </section>

      <CobrosPaymentHistory
        cobros={historyCobros}
        month={month}
        onMonthChange={setMonth}
        hideMonthPicker
        hideStaff={hideStaff}
        proofEndpoint={
          proofApiBase
            ? (cobroId, index) =>
                `${proofApiBase}/comprobante/${encodeURIComponent(cobroId)}?index=${index}`
            : undefined
        }
      />
    </div>
  );
}
