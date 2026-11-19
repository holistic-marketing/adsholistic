import Link from "next/link";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { routes } from "@/config/routes";
import {
  formatHecomFecha,
  formatHecomGastoDisplay,
  resolveBmForGasto,
} from "@/lib/hecom/gasto-label";
import { formatBmBucketLabel } from "@/lib/hecom/bm-bucket.shared";
import {
  getHecomCampaignSpendRows,
  type HecomClienteDashboard,
  type HecomGastoRow,
} from "@/lib/hecom/cliente-dashboard.server";
import { getAppFormatter } from "@/lib/i18n/get-app-formatter";
import { PageHeader, PanelCard } from "@/components/ui/PageHeader";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { buttonClass } from "@/components/ui/Button";
import { OverviewKpi } from "./OverviewKpi";
import type { HecomTiktokAccount } from "@/lib/hecom/clientes.server";

/*
 * Resumen del cliente (sistema visual v3): encabezado, cuatro indicadores,
 * primeros pasos, gasto diario, gasto por cuenta, cuentas y últimos gastos.
 * No mostramos «Deuda neta» Hecom aquí: suele estar incompleta (cobros
 * faltantes) y asusta al cliente.
 */

const CARD = "rounded-card bg-surface ring-1 ring-line";
const INK = "text-ink";
const SOFT = "text-ink-2";
const MUTED = "text-ink-3";

/** «Jesus Fuentes 201.0 USD - Agencia» → nombre + número de cuenta (no es saldo). */
function parseAdvertiserLabel(raw: string | null) {
  if (!raw?.trim()) return { title: "TikTok Ads", code: null as string | null };
  const match = raw.match(/^(.*?)\s+(\d+(?:\.\d+)?)\s*(?:USD)?\s*(?:[-–]\s*.+)?$/i);
  if (match && match[1].trim()) return { title: match[1].trim(), code: match[2].replace(/\.0+$/, "") };
  return { title: raw.trim(), code: null };
}

function shortId(id: string) {
  return id.length <= 10 ? id : `…${id.slice(-6)}`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "HC";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function shortDayLabel(dateYmd: string) {
  const iso = dateYmd.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return dateYmd;
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/**
 * «Empieza en 3 pasos» (recarga → cuenta → campaña). Se oculta sola cuando
 * ya hizo los 3. Sistema visual v3: el paso actual con borde naranja.
 */
function OnboardingSteps({
  t,
  steps,
}: {
  t: Awaited<ReturnType<typeof getTranslations<"overview">>>;
  steps: Array<{ key: "s1" | "s2" | "s3"; done: boolean; href: string }>;
}) {
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  const next = steps.find((s) => !s.done)?.key;
  return (
    <PanelCard
      aria-labelledby="ov-steps"
      title={<span id="ov-steps">{t("onboarding.title")}</span>}
      description={t("onboarding.sub")}
      action={<span className="panel-badge">{t("onboarding.progress", { done })}</span>}
    >
      <ol className="grid gap-2.5 md:grid-cols-3">
        {steps.map((s, i) => {
          const current = s.key === next;
          return (
            <li
              key={s.key}
              className={`rounded-box border px-4 py-3.5 ${current ? "border-accent bg-surface" : "border-line bg-field"}`}
            >
              <h3 className="flex items-center gap-2.5 text-sm font-semibold text-ink">
                <span
                  aria-hidden
                  className={`grid size-[22px] shrink-0 place-items-center rounded-[6px] font-mono text-[11px] font-semibold ${
                    s.done ? "bg-ok-bg text-ok-fg" : "bg-subtle text-ink"
                  }`}
                >
                  {s.done ? <PanelIcon name="check" className="size-3" /> : i + 1}
                </span>
                {t(`onboarding.${s.key}`)}
              </h3>
              <p className="mt-1.5 text-[13px] text-ink-2">{t(`onboarding.${s.key}b`)}</p>
              {s.done ? (
                <p className="mt-2.5 text-[13px] font-medium text-ok-fg">{t("onboarding.done")}</p>
              ) : (
                <Link href={s.href} className={buttonClass(current ? "primary" : "outline", "sm", "mt-2.5")}>
                  {t(`onboarding.${s.key}c`)}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </PanelCard>
  );
}

export async function ClienteScopedOverview({
  data,
  canChangeCliente = false,
  accountSpend,
  wallet,
}: {
  data: HecomClienteDashboard;
  canChangeCliente?: boolean;
  /** Gasto por cuenta. Si viene de fuera, el overview no espera las filas de campaña. */
  accountSpend?: ReactNode;
  /** «Saldo en cartera»: llega aparte, con su propio Suspense. */
  wallet?: ReactNode;
}) {
  const t = await getTranslations("overview");
  const { formatMoney } = await getAppFormatter();
  const moneyUsd = (value: number) => formatMoney(value, "USD");
  const { cliente, summary, accounts, gastos } = data;
  const recentGastos = gastos.slice(0, 8);
  const activeAccounts = accounts.filter((a) => a.syncEnabled !== false).length;
  const pausedAccounts = Math.max(0, accounts.length - activeAccounts);
  const todayHint =
    summary.dailySource === "none"
      ? t("noDaySync")
      : summary.gastoHoy > 0
        ? t("timezoneLima")
        : t("noActivityToday");

  return (
    <div>
      <PageHeader
        title={t("title")}
        lede={canChangeCliente ? t("ledeStaff", { name: cliente.name }) : t("ledeCliente")}
        actions={
          <>
            <Link href={routes.adAccounts} className={buttonClass("outline")}>
              <PanelIcon name="layers" />
              {t("ctaAccounts")}
            </Link>
            <Link href={routes.payments} className={buttonClass("primary")}>
              <PanelIcon name="plus" />
              {canChangeCliente ? t("ctaReloadAssign") : t("ctaReload")}
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <OverviewKpi
          label={t("hero.badge")}
          value={moneyUsd(summary.gasto30d)}
          lead={t("hero.caption")}
          detail={`${t("spend7d")}: ${moneyUsd(summary.gasto7d)} · ${t("spendToday")}: ${moneyUsd(summary.gastoHoy)}`}
        />
        {wallet ?? (
          <OverviewKpi label={t("feeHolistic")} value={`${summary.depositFeePercent}%`} lead={t("feeMeta", { percent: summary.depositFeePercent })} />
        )}
        <OverviewKpi
          label={t("cobros")}
          value={moneyUsd(summary.cobroTotal)}
          lead={t("hero.cobrosHint")}
          detail={`${t("adSpend")}: ${moneyUsd(summary.gastoTotal)}`}
        />
        <OverviewKpi
          label={t("tiktokAccounts")}
          value={String(summary.accountCount)}
          lead={summary.accountCount > 0 ? t("accountsHint", { active: activeAccounts, paused: pausedAccounts }) : undefined}
          detail={todayHint}
        />
      </div>

      <div className="mt-4 space-y-4">
        <OnboardingSteps
          t={t}
          steps={[
            { key: "s1", done: data.cobros.length > 0, href: routes.payments },
            { key: "s2", done: accounts.length > 0, href: routes.adAccounts },
            { key: "s3", done: summary.gastoTotal > 0, href: routes.payments },
          ]}
        />

        <DailySpendPanel
          series={summary.dailySeries}
          gastoHoy={summary.gastoHoy}
          gasto7d={summary.gasto7d}
          gasto30d={summary.gasto30d}
          source={summary.dailySource}
          moneyUsd={moneyUsd}
        />

        {accountSpend ?? (
          <AccountSpendPanel
            rows={data.campaignSpendRows}
            accounts={accounts}
            anchorDate={summary.dailyAnchorDate}
            moneyUsd={moneyUsd}
          />
        )}

        <div className="grid gap-4 xl:grid-cols-2">
          <AccountsPanel accounts={accounts} />
          <GastosPanel gastos={recentGastos} accounts={accounts} source={data.source} moneyUsd={moneyUsd} />
        </div>
      </div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  count,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${CARD} flex flex-col overflow-hidden ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
        <div className="min-w-0">
          <h2 className={`text-[15px] font-semibold tracking-[-0.02em] ${INK}`}>{title}</h2>
          {subtitle ? <p className={`mt-0.5 text-[12px] ${SOFT}`}>{subtitle}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {count != null ? (
            <span className={`rounded-full bg-subtle px-2 py-0.5 text-[11px] font-semibold tabular-nums ${SOFT}`}>{count}</span>
          ) : null}
          {action}
        </div>
      </div>
      {children}
    </section>
  );
}

async function DailySpendPanel({
  series,
  gastoHoy,
  gasto7d,
  gasto30d,
  source,
  moneyUsd,
}: {
  series: HecomClienteDashboard["summary"]["dailySeries"];
  gastoHoy: number;
  gasto7d: number;
  gasto30d: number;
  source: HecomClienteDashboard["summary"]["dailySource"];
  moneyUsd: (value: number) => string;
}) {
  const t = await getTranslations("overview");
  const max = Math.max(...series.map((p) => p.spend), 0);
  const peak = max > 0 ? max : 1;
  const hasAny = series.some((p) => p.spend > 0);
  const peakPoint = hasAny ? series.reduce((best, p) => (p.spend > best.spend ? p : best), series[0]) : null;
  const sourceLabel =
    source === "snapshots"
      ? t("dailySpend.sourceTiktok")
      : source === "gastos"
        ? t("dailySpend.sourceGastos")
        : t("dailySpend.sourceNone");
  const mobileSeries = series.slice(-7);

  const bars = (points: typeof series, height: number) => (
    <div className="flex items-end gap-1.5 sm:gap-2" style={{ height: height + 34 }}>
      {points.map((point, index) => {
        const isToday = index === points.length - 1;
        const isPeak = peakPoint?.date === point.date;
        const barPx = point.spend > 0 ? Math.max(6, Math.round((point.spend / peak) * height)) : 3;
        return (
          <div
            key={point.date}
            className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
            title={`${shortDayLabel(point.date)}: ${moneyUsd(point.spend)}`}
          >
            <span
              className={`max-w-full truncate text-[9.5px] font-semibold tabular-nums transition-opacity ${
                isPeak || isToday ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              } ${isPeak ? "text-accent-text" : MUTED}`}
            >
              {point.spend > 0 ? moneyUsd(point.spend) : " "}
            </span>
            <div
              className={`w-full max-w-[1.6rem] rounded-t-[5px] transition-colors ${
                isToday || isPeak ? "bg-accent" : point.spend > 0 ? "bg-accent group-hover:bg-accent-btn-hover" : "bg-subtle"
              }`}
              style={{ height: barPx }}
            />
            <span className={`text-[9.5px] font-semibold tabular-nums ${isToday ? "text-accent-text" : MUTED}`}>
              {shortDayLabel(point.date)}
            </span>
            {isToday ? <span className="h-0.5 w-3 rounded-full bg-accent" aria-hidden /> : <span className="h-0.5" aria-hidden />}
          </div>
        );
      })}
    </div>
  );

  return (
    <Panel
      title={t("dailySpend.title")}
      subtitle={t("dailySpend.subtitle", { days: series.length })}
      action={
        <span className={`rounded-full bg-subtle px-2.5 py-1 text-[11px] font-medium ${SOFT}`}>
          {t("dailySpend.source")} <span className={INK}>{sourceLabel}</span>
        </span>
      }
    >
      <div className="grid grid-cols-3 gap-2 px-4 sm:px-5">
        <DayMetric label={t("dailySpend.today")} value={moneyUsd(gastoHoy)} accent />
        <DayMetric label={t("spend7d")} value={moneyUsd(gasto7d)} />
        <DayMetric label={t("hero.last30")} value={moneyUsd(gasto30d)} />
      </div>
      {!hasAny ? (
        <p className={`px-4 py-10 text-center text-[13px] font-medium sm:px-5 ${SOFT}`}>{t("dailySpend.empty")}</p>
      ) : (
        <>
          <div className="px-3 pb-2 pt-5 sm:hidden">{bars(mobileSeries, 110)}</div>
          <div className="hidden px-5 pb-2 pt-5 sm:block">{bars(series, 130)}</div>
          {peakPoint ? (
            <p className={`border-t border-line px-4 py-3 text-[11.5px] sm:px-5 ${MUTED}`}>
              {t("hero.peakDay", { date: shortDayLabel(peakPoint.date), amount: moneyUsd(peakPoint.spend) })}
            </p>
          ) : null}
        </>
      )}
    </Panel>
  );
}

export function OverviewAccountSpendFallback() {
  return (
    <section
      className={`${CARD} animate-pulse motion-reduce:animate-none px-4 py-4 sm:px-5`}
      aria-busy="true"
      aria-live="polite"
    >
      <div className="h-4 w-40 rounded-full bg-subtle" />
      <div className="mt-1.5 h-3 w-64 max-w-full rounded-full bg-subtle" />
      <div className="mt-4 space-y-3 pb-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-12 rounded-box bg-field" />
        ))}
      </div>
    </section>
  );
}

/** Mismas filas que el overview completo, sin bloquear los KPIs. */
export async function OverviewAccountSpend({
  clienteId,
  accounts,
  gastos,
  anchorDate,
}: {
  clienteId: string;
  accounts: HecomClienteDashboard["accounts"];
  gastos: HecomClienteDashboard["gastos"];
  anchorDate: string;
}) {
  const { formatMoney } = await getAppFormatter();
  const moneyUsd = (value: number) => formatMoney(value, "USD");
  let rows: HecomClienteDashboard["campaignSpendRows"] = [];
  try {
    rows = await getHecomCampaignSpendRows({ clienteId, accounts, gastos });
  } catch (error) {
    console.error("[overview] campaign spend failed", {
      clienteId,
      error: error instanceof Error ? error.message : "unknown",
    });
  }

  return (
    <AccountSpendPanel
      rows={rows}
      accounts={accounts}
      anchorDate={anchorDate}
      moneyUsd={moneyUsd}
    />
  );
}

/** Gasto de cada cuenta en los últimos 30 días (snapshots TikTok o gastos Hecom). */
async function AccountSpendPanel({
  rows,
  accounts,
  anchorDate,
  moneyUsd,
}: {
  rows: HecomClienteDashboard["campaignSpendRows"];
  accounts: HecomTiktokAccount[];
  anchorDate: string;
  moneyUsd: (value: number) => string;
}) {
  const t = await getTranslations("overview");
  const end = anchorDate.slice(0, 10);
  const startMs = Date.parse(`${end}T00:00:00Z`) - 29 * 86_400_000;
  const start = Number.isFinite(startMs) ? new Date(startMs).toISOString().slice(0, 10) : "";
  const byAccount = new Map<string, number>();
  for (const row of rows) {
    if (!row.date || row.date < start || row.date > end) continue;
    const key = row.advertiserId ?? "otros";
    byAccount.set(key, (byAccount.get(key) ?? 0) + row.spend);
  }
  const accountById = new Map(accounts.map((a) => [a.advertiserId, a]));
  const items = [...byAccount.entries()]
    .map(([id, spend]) => {
      const account = accountById.get(id);
      const label = parseAdvertiserLabel(account?.advertiserName ?? null);
      return {
        id,
        spend: Math.round(spend * 100) / 100,
        name: account ? `${label.title}${label.code ? ` · ${label.code}` : ""}` : id === "otros" ? t("byAccount.unknown") : `${t("byAccount.account")} ${shortId(id)}`,
        meta: [account?.bmBucket ? `BM ${account.bmBucket}` : null, id !== "otros" ? `ID ${shortId(id)}` : null].filter(Boolean).join(" · "),
      };
    })
    .filter((item) => item.spend > 0.004)
    .sort((a, b) => b.spend - a.spend);
  const total = items.reduce((sum, item) => sum + item.spend, 0);
  const TOP = 6;
  const rest = items.slice(TOP);
  const shown =
    rest.length > 1
      ? [
          ...items.slice(0, TOP),
          {
            id: "resto",
            name: t("byAccount.others", { count: rest.length }),
            meta: "",
            spend: Math.round(rest.reduce((sum, item) => sum + item.spend, 0) * 100) / 100,
          },
        ]
      : items;

  return (
    <Panel
      title={t("byAccount.title")}
      subtitle={t("byAccount.subtitle")}
      action={
        <span className={`rounded-full bg-subtle px-2.5 py-1 text-[11px] font-semibold ${SOFT}`}>
          {t("byAccount.count", { count: items.length })}
        </span>
      }
    >
      {items.length === 0 ? (
        <p className={`px-4 pb-8 pt-2 text-[13px] font-medium sm:px-5 ${SOFT}`}>{t("byAccount.empty")}</p>
      ) : (
        <div className="px-4 pb-4 sm:px-5">
          <ul>
            {shown.map((item) => {
              const share = total > 0 ? item.spend / total : 0;
              return (
                <li key={item.id} className="border-t border-line py-3 first:border-t-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`truncate text-[13.5px] font-semibold ${INK}`}>{item.name}</p>
                      {item.meta ? <p className={`mt-0.5 truncate text-[11.5px] ${MUTED}`}>{item.meta}</p> : null}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-[13.5px] font-semibold tabular-nums ${INK}`}>{moneyUsd(item.spend)}</p>
                      <p className={`text-[11px] tabular-nums ${MUTED}`}>{Math.round(share * 100)}%</p>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-subtle">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(2, share * 100)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-1 flex items-center justify-between border-t border-line pt-3">
            <span className={`text-[12.5px] font-semibold ${SOFT}`}>{t("byAccount.total")}</span>
            <span className={`text-[14px] font-semibold tabular-nums ${INK}`}>{moneyUsd(total)}</span>
          </div>
        </div>
      )}
    </Panel>
  );
}

function DayMetric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-0 rounded-box bg-field px-3 py-2.5">
      <p className={`flex items-center gap-1.5 text-[11px] font-medium ${SOFT}`}>
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${accent ? "bg-accent" : "bg-active"}`} aria-hidden />
        {label}
      </p>
      <p className={`mt-0.5 text-[15px] font-semibold tabular-nums tracking-[-0.02em] [overflow-wrap:anywhere] sm:text-[17px] ${INK}`}>{value}</p>
    </div>
  );
}

async function AccountsPanel({ accounts }: { accounts: HecomTiktokAccount[] }) {
  const t = await getTranslations("overview");

  return (
    <Panel
      title={t("tiktokAccounts")}
      subtitle={t("accountsPanel.hecomReadonly")}
      action={
        <Link href={routes.adAccounts} className={`text-[12px] font-semibold underline-offset-4 hover:underline ${INK}`}>
          {t("accountsPanel.viewAll", { count: accounts.length })}
        </Link>
      }
      className="h-full"
    >
      {accounts.length === 0 ? (
        <p className={`px-4 pb-8 pt-4 text-[13px] font-medium sm:px-5 ${SOFT}`}>{t("accountsPanel.empty")}</p>
      ) : (
        <ul className="max-h-[26rem] flex-1 overflow-y-auto px-4 pb-3 sm:px-5">
          {accounts.map((account) => {
            const label = parseAdvertiserLabel(account.advertiserName);
            const active = account.syncEnabled !== false;
            return (
              <li key={account.advertiserId} className="flex items-center gap-3 border-t border-line py-3 first:border-t-0">
                <span
                  className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] text-[11px] font-bold ${
                    active ? "bg-subtle text-ok-fg" : "bg-subtle text-ink-3"
                  }`}
                  aria-hidden
                >
                  {label.code ?? initials(label.title)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[13.5px] font-semibold ${INK}`}>
                    {label.title}
                    {label.code ? <span className={`font-medium ${MUTED}`}> · {label.code}</span> : null}
                  </p>
                  <p className={`mt-0.5 truncate text-[11.5px] ${MUTED}`}>
                    {[account.bmBucket ? `BM ${account.bmBucket}` : null, `ID ${shortId(account.advertiserId)}`, account.fee != null ? `Fee ${account.fee}%` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                    active ? "bg-subtle text-ok-fg" : "bg-subtle text-ink-3"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-ok-solid" : "bg-line-strong"}`} aria-hidden />
                  {active ? t("accountsPanel.inCampaign") : t("accountsPanel.paused")}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function bmMapFromAccounts(accounts: HecomTiktokAccount[]) {
  const map = new Map<string, string | null>();
  for (const account of accounts) map.set(account.advertiserId, formatBmBucketLabel(account.bmBucket));
  return map;
}

async function GastosPanel({
  gastos,
  accounts,
  source,
  moneyUsd,
}: {
  gastos: HecomGastoRow[];
  accounts: HecomTiktokAccount[];
  source: HecomClienteDashboard["source"];
  moneyUsd: (value: number) => string;
}) {
  const t = await getTranslations("overview");
  const bmByAdvertiser = bmMapFromAccounts(accounts);
  const live = source === "hecom_live";

  return (
    <Panel
      title={t("gastosPanel.title")}
      subtitle={t("gastosPanel.subtitle")}
      action={
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${SOFT}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-ok-solid" : "bg-line-strong"}`} aria-hidden />
            {live ? t("live") : t("backup")}
          </span>
          <Link href={routes.profit} className={`text-[12px] font-semibold underline-offset-4 hover:underline ${INK}`}>
            {t("gastosPanel.viewProfit")}
          </Link>
        </div>
      }
      className="h-full"
    >
      {gastos.length === 0 ? (
        <p className={`px-4 pb-8 pt-4 text-[13px] font-medium sm:px-5 ${SOFT}`}>{t("gastosPanel.empty")}</p>
      ) : (
        <ul className="max-h-[26rem] flex-1 overflow-y-auto px-4 pb-3 sm:px-5">
          {gastos.map((row) => {
            const fecha = formatHecomFecha(row.fecha ?? row.mes);
            const bm = resolveBmForGasto(row, bmByAdvertiser);
            const label = formatHecomGastoDisplay(row.camp, { notas: row.notas, fee: row.fee, fecha: null });
            return (
              <li key={row.id} className="flex items-center gap-3 border-t border-line py-3 first:border-t-0">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-box bg-accent-soft text-accent-text" aria-hidden>
                  <TrendIcon />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[13.5px] font-semibold ${INK}`}>{label.title}</p>
                  <p className={`mt-0.5 truncate text-[11.5px] ${MUTED}`}>
                    {[fecha, bm, row.fee != null ? `Fee ${row.fee}%` : null].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <p className={`shrink-0 text-[13.5px] font-semibold tabular-nums ${INK}`}>{moneyUsd(row.gasto)}</p>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function TrendIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m4 16 5-5 4 4 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 8h5v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
