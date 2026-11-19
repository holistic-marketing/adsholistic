"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { PanelCard } from "@/components/ui/PageHeader";
import { Delta, FilterBar, KpiCard, KpiGrid, Segmented } from "@/components/ui/PanelKit";
import { Select } from "@/components/ui/Input";
import { useAppFormatter } from "@/lib/i18n/use-app-formatter";

export type DailyPoint = { date: string; value: number };

const PERIODS = [7, 14, 30] as const;
type Period = (typeof PERIODS)[number];
type Serie = "spend" | "payments";
const PERIOD_KEY = "ah-ui-overview-days";

function sum(points: DailyPoint[]) {
  return Math.round(points.reduce((total, point) => total + point.value, 0) * 100) / 100;
}

/**
 * Parte de arriba del resumen (sistema visual v3): periodo, indicadores y
 * «Actividad diaria» con el gráfico de gasto o de pagos. Lo demás llega
 * ya pintado desde el servidor por las ranuras.
 */
export function OverviewActivity({
  spend,
  payments,
  walletKpi,
  secondaryKpis,
  steps,
  aside,
}: {
  /** Gasto por día, del más viejo al más nuevo (hasta 60 días). */
  spend: DailyPoint[];
  /** Pagos recibidos por día, alineados con `spend`. */
  payments: DailyPoint[];
  walletKpi: ReactNode;
  secondaryKpis: ReactNode;
  steps?: ReactNode;
  aside: ReactNode;
}) {
  const t = useTranslations("overview");
  const { formatMoney } = useAppFormatter();
  const [days, setDays] = useState<Period>(14);
  const [serie, setSerie] = useState<Serie>("spend");

  // El periodo elegido se recuerda en este navegador.
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(PERIOD_KEY));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage solo existe en el cliente
      if ((PERIODS as readonly number[]).includes(saved)) setDays(saved as Period);
    } catch {
      // sin almacenamiento: queda el periodo por defecto
    }
  }, []);

  function changeDays(value: Period) {
    setDays(value);
    try {
      localStorage.setItem(PERIOD_KEY, String(value));
    } catch {
      // sin almacenamiento: el cambio vale solo en esta visita
    }
  }

  const current = spend.slice(-days);
  const previousPoints = spend.slice(-days * 2, -days);
  const now = sum(current);
  const previous = previousPoints.length === days ? sum(previousPoints) : 0;
  const money = (value: number) => formatMoney(value, "USD");

  const chartPoints = (serie === "spend" ? spend : payments).slice(-days);

  return (
    <>
      <FilterBar>
        <label className="sr-only" htmlFor="ov-days">
          {t("activity.period")}
        </label>
        <Select
          id="ov-days"
          value={days}
          onChange={(event) => changeDays(Number(event.target.value) as Period)}
          className="h-9 w-auto text-[13px]"
        >
          {PERIODS.map((value) => (
            <option key={value} value={value}>
              {t("activity.lastDays", { days: value })}
            </option>
          ))}
        </Select>
      </FilterBar>

      <KpiGrid className="mt-4">
        <KpiCard
          label={t("activity.spendPeriod")}
          value={money(now)}
          extra={previous ? <Delta current={now} previous={previous} /> : null}
          lead={previous ? (now >= previous ? t("activity.spendUp") : t("activity.spendDown")) : now > 0 ? t("activity.spendNoPrevious") : undefined}
          detail={previous ? t("activity.spendPrevious", { amount: money(previous), days }) : undefined}
        />
        {walletKpi}
        {secondaryKpis}
      </KpiGrid>

      {steps ? <div className="mt-4">{steps}</div> : null}

      <div className="mt-4 grid items-stretch gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <PanelCard
          aria-labelledby="ov-activity"
          title={<span id="ov-activity">{t("activity.title")}</span>}
          description={t("activity.subtitle", { days })}
          action={
            <Segmented
              label={t("activity.show")}
              value={serie}
              onChange={setSerie}
              options={[
                { value: "spend", label: t("activity.spend") },
                { value: "payments", label: t("activity.payments") },
              ]}
            />
          }
        >
          <p className="mb-1 flex items-center gap-1.5 text-xs text-ink-2">
            <span aria-hidden className="size-2 rounded-full bg-accent" />
            {serie === "spend" ? t("activity.legendSpend") : t("activity.legendPayments")}
          </p>
          <LineChart
            points={chartPoints}
            name={serie === "spend" ? t("activity.chartSpend") : t("activity.chartPayments")}
            emptyLabel={serie === "spend" ? t("activity.emptySpend") : t("activity.emptyPayments")}
            dayLabel={t("activity.day")}
            format={money}
          />
        </PanelCard>
        <div className="grid content-start gap-4">{aside}</div>
      </div>
    </>
  );
}

/* --- Gráfico de línea (v3 «lineChart») ------------------------------------- */

const MARGIN = { top: 12, right: 12, bottom: 26, left: 54 };

function niceMax(raw: number) {
  // Sin datos: una escala de 0 a 100 en vez de repetir $0 y $1 en el eje.
  if (raw <= 0) return 100;
  const value = Math.max(1, raw);
  const pow = 10 ** Math.floor(Math.log10(value));
  return [1, 2, 4, 6, 8, 10].map((k) => k * pow).find((k) => k >= value) ?? value;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

function LineChart({
  points,
  name,
  emptyLabel,
  dayLabel,
  format,
}: {
  points: DailyPoint[];
  name: string;
  emptyLabel: string;
  dayLabel: string;
  format: (value: number) => string;
}) {
  const { bcp47 } = useAppFormatter();
  const [hostRef, hostWidth] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const W = Math.max(300, hostWidth);
  const H = hostWidth > 600 ? 300 : 240;
  const n = points.length;
  const values = points.map((p) => p.value);
  const raw = Math.max(0, ...values);
  const max = niceMax(raw);
  const innerW = W - MARGIN.left - MARGIN.right;
  const innerH = H - MARGIN.top - MARGIN.bottom;
  const x = (i: number) => MARGIN.left + (n <= 1 ? innerW / 2 : (innerW * i) / (n - 1));
  const y = (v: number) => MARGIN.top + innerH * (1 - v / max);
  const step = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / 64))));
  const axisMoney = new Intl.NumberFormat(bcp47, {
    style: "currency",
    currency: "USD",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  });
  const dayFormat = new Intl.DateTimeFormat(bcp47, { day: "numeric", month: "short", timeZone: "UTC" });
  const label = (iso: string) => dayFormat.format(new Date(`${iso}T12:00:00Z`));
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const empty = raw <= 0;

  function onPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const i = Math.round(((event.clientX - rect.left - MARGIN.left) / innerW) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  }

  return (
    <div ref={hostRef} className="relative min-h-[232px] pt-2">
      {hostWidth > 0 && n > 0 ? (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          role="img"
          aria-label={name}
          className="block overflow-visible font-mono text-[11px]"
          onPointerMove={onPointerMove}
          onPointerLeave={() => setHover(null)}
        >
          {[0, 1, 2, 3, 4].map((k) => {
            const v = (max * k) / 4;
            return (
              <g key={k}>
                <line x1={MARGIN.left} x2={W - MARGIN.right} y1={y(v)} y2={y(v)} className="stroke-line" />
                <text x={MARGIN.left - 8} y={y(v) + 4} textAnchor="end" className="fill-ink-3">
                  {axisMoney.format(v)}
                </text>
              </g>
            );
          })}
          <path d={`M${x(0)},${y(0)} L${line.replaceAll(" ", " L")} L${x(n - 1)},${y(0)} Z`} className="fill-accent opacity-10" />
          <polyline points={line} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className="stroke-accent" />
          {points.map((p, i) =>
            (n - 1 - i) % step === 0 ? (
              <text
                key={p.date}
                x={x(i)}
                y={H - 6}
                textAnchor={i === n - 1 ? "end" : i === 0 ? "start" : "middle"}
                className="fill-ink-3"
              >
                {label(p.date)}
              </text>
            ) : null,
          )}
          {hover != null ? (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={MARGIN.top} y2={MARGIN.top + innerH} strokeDasharray="3 3" className="stroke-ink-3" />
              <circle cx={x(hover)} cy={y(points[hover].value)} r={4} strokeWidth={2} className="fill-surface stroke-accent" />
            </g>
          ) : null}
        </svg>
      ) : null}
      {hover != null && points[hover] ? (
        <div
          aria-hidden
          className="pointer-events-none absolute top-1 z-[2] -translate-x-1/2 whitespace-nowrap rounded-ctl border border-line bg-surface px-2.5 py-1.5 text-xs text-ink-2 shadow-pop"
          style={{ left: Math.min(Math.max(x(hover) + 4, 70), W - 60) }}
        >
          {label(points[hover].date)}
          <b className="num block text-[13px] font-semibold text-ink">{format(points[hover].value)}</b>
        </div>
      ) : null}
      {empty && hostWidth > 0 ? (
        <p className="pointer-events-none absolute inset-x-0 top-[42%] text-center text-[13px] text-ink-3">{emptyLabel}</p>
      ) : null}
      <table className="sr-only">
        <caption>{name}</caption>
        <thead>
          <tr>
            <th scope="col">{dayLabel}</th>
            <th scope="col">{name}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.date}>
              <td>{label(p.date)}</td>
              <td>{format(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
