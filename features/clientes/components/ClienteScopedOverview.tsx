import Link from "next/link";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { routes } from "@/config/routes";
import { formatHecomFecha } from "@/lib/hecom/gasto-label";
import {
  getHecomCampaignSpendRows,
  type HecomClienteDashboard,
} from "@/lib/hecom/cliente-dashboard.server";
import { getAppFormatter } from "@/lib/i18n/get-app-formatter";
import { PageHeader, PanelCard } from "@/components/ui/PageHeader";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState, KpiCard, Meter, SquareIcon, ToneBadge, type Tone } from "@/components/ui/PanelKit";
import type { HecomTiktokAccount } from "@/lib/hecom/clientes.server";
import type { PanelIconName } from "@/components/ui/PanelIcon";
import { OverviewActivity, type DailyPoint } from "./OverviewActivity.client";

/*
 * Resumen del cliente (sistema visual v3): periodo, indicadores, primeros
 * pasos, actividad diaria con estado de las cuentas y cartera al costado, y
 * abajo el gasto por cuenta y los últimos pagos. No mostramos «Deuda neta»
 * Hecom aquí: suele estar incompleta (cobros faltantes) y asusta al cliente.
 */

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

/** Fecha de Hecom (YYYY-MM-DD… o DD/MM/YYYY) a YYYY-MM-DD. */
function isoDay(value: string | null): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const dmy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return dmy ? `${dmy[3]}-${dmy[2]}-${dmy[1]}` : null;
}

/** Pagos por día, en los mismos días que la serie de gasto. */
function dailyPayments(cobros: HecomClienteDashboard["cobros"], days: string[]): DailyPoint[] {
  const byDay = new Map<string, number>();
  for (const row of cobros) {
    const day = isoDay(row.fecha);
    if (day) byDay.set(day, (byDay.get(day) ?? 0) + row.monto);
  }
  return days.map((date) => ({ date, value: Math.round((byDay.get(date) ?? 0) * 100) / 100 }));
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
  walletCard,
}: {
  data: HecomClienteDashboard;
  canChangeCliente?: boolean;
  /** Gasto por cuenta. Si viene de fuera, el overview no espera las filas de campaña. */
  accountSpend?: ReactNode;
  /** «Saldo en cartera»: llega aparte, con su propio Suspense. */
  wallet?: ReactNode;
  /** Tarjeta «Cartera» de la columna derecha, también con su Suspense. */
  walletCard?: ReactNode;
}) {
  const t = await getTranslations("overview");
  const { formatMoney } = await getAppFormatter();
  const moneyUsd = (value: number) => formatMoney(value, "USD");
  const { cliente, summary, accounts } = data;
  const activeAccounts = accounts.filter((a) => a.syncEnabled !== false).length;

  const spend: DailyPoint[] = summary.dailySeries.map((p) => ({ date: p.date, value: p.spend }));
  const payments = dailyPayments(
    data.cobros,
    spend.map((p) => p.date),
  );

  return (
    <div>
      <PageHeader
        title={t("title")}
        lede={canChangeCliente ? t("ledeStaff", { name: cliente.name }) : t("ledeCliente")}
        actions={
          <Link href={routes.payments} className={buttonClass("primary", "md", "shadow-glow")}>
            <PanelIcon name="plus" />
            {canChangeCliente ? t("ctaReloadAssign") : t("ctaReload")}
          </Link>
        }
      />

      <OverviewActivity
        spend={spend}
        payments={payments}
        walletKpi={
          wallet ?? (
            <KpiCard
              label={t("feeHolistic")}
              value={`${summary.depositFeePercent}%`}
              lead={t("feeMeta", { percent: summary.depositFeePercent })}
            />
          )
        }
        secondaryKpis={
          <>
            <KpiCard
              label={t("cobros")}
              value={moneyUsd(summary.cobroTotal)}
              lead={t("hero.cobrosHint")}
              detail={`${t("adSpend")}: ${moneyUsd(summary.gastoTotal)}`}
            />
            <KpiCard
              label={t("activeAccounts")}
              value={String(activeAccounts)}
              lead={t("activeOf", { count: accounts.length })}
              detail={t("feeMeta", { percent: summary.depositFeePercent })}
            />
          </>
        }
        steps={
          <OnboardingSteps
            t={t}
            steps={[
              { key: "s1", done: data.cobros.length > 0, href: routes.payments },
              { key: "s2", done: accounts.length > 0, href: routes.adAccounts },
              { key: "s3", done: summary.gastoTotal > 0, href: routes.payments },
            ]}
          />
        }
        aside={
          <>
            <AccountStatusCard accounts={accounts} staff={canChangeCliente} />
            {walletCard}
          </>
        }
      />

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-2">
        {accountSpend ?? (
          <AccountSpendPanel
            rows={data.campaignSpendRows}
            accounts={accounts}
            anchorDate={summary.dailyAnchorDate}
            moneyUsd={moneyUsd}
          />
        )}
        <RecentPaymentsCard cobros={data.cobros} moneyUsd={moneyUsd} />
      </div>
    </div>
  );
}

/* --- Estado de las cuentas (v3 «sttiles» + «meter») ----------------------- */

async function AccountStatusCard({ accounts, staff }: { accounts: HecomTiktokAccount[]; staff: boolean }) {
  const t = await getTranslations("overview.status");
  const active = accounts.filter((a) => a.syncEnabled !== false).length;
  const paused = accounts.length - active;
  const tiles: Array<{ label: string; count: number; tone: Tone; icon: PanelIconName }> = [
    { label: t("active"), count: active, tone: "ok", icon: "check-circle" },
    { label: t("paused"), count: paused, tone: "neutral", icon: "pause-circle" },
  ];
  return (
    <PanelCard
      aria-labelledby="ov-status"
      title={<span id="ov-status">{t("title")}</span>}
      description={staff ? t("subtitleStaff") : t("subtitleCliente")}
      action={<ToneBadge className="num">{t("total", { count: accounts.length })}</ToneBadge>}
    >
      <ul className="grid grid-cols-2 gap-2">
        {tiles.map((tile) => (
          <li key={tile.label} className="grid justify-items-center gap-1 rounded-box border border-line px-1 py-3 text-center">
            <span className="[&>.panel-sqi]:rounded-full">
              <SquareIcon icon={tile.icon} tone={tile.tone} />
            </span>
            <b className="num text-lg font-semibold">{tile.count}</b>
            <small className="text-[11px] text-ink-3">{tile.label}</small>
          </li>
        ))}
      </ul>
      <Meter label={t("rate")} value={accounts.length ? active / accounts.length : 0} />
      <Link href={routes.adAccounts} className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-accent-text hover:underline">
        {t("viewAll")}
        <PanelIcon name="arrow-right" className="size-3.5" />
      </Link>
    </PanelCard>
  );
}

/* --- Últimos pagos (v3 «Últimos movimientos») ----------------------------- */

async function RecentPaymentsCard({
  cobros,
  moneyUsd,
}: {
  cobros: HecomClienteDashboard["cobros"];
  moneyUsd: (value: number) => string;
}) {
  const t = await getTranslations("overview.recent");
  const recent = cobros.slice(0, 5);
  return (
    <PanelCard
      aria-labelledby="ov-recent"
      title={<span id="ov-recent">{t("title")}</span>}
      description={t("subtitle")}
      action={
        <Link href={routes.cobros} className="inline-flex items-center gap-1 text-[13px] font-medium text-accent-text hover:underline">
          {t("viewAll")}
          <PanelIcon name="arrow-right" className="size-3.5" />
        </Link>
      }
      bodyClassName="px-4 pb-2 pt-1 sm:px-6"
    >
      {recent.length === 0 ? (
        <EmptyState icon="ledger" title={t("empty")} className="py-8" />
      ) : (
        <ul>
          {recent.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-b-0">
              <span className="grid min-w-0 leading-snug">
                <b className="truncate font-medium text-ink">{row.metodo ?? t("defaultMethod")}</b>
                <small className="num text-xs text-ink-3">{formatHecomFecha(row.fecha) ?? "—"}</small>
              </span>
              <b className="num shrink-0 font-semibold text-ok-fg">+{moneyUsd(row.monto)}</b>
            </li>
          ))}
        </ul>
      )}
    </PanelCard>
  );
}

/* --- Gasto por cuenta (v3 «bars») ----------------------------------------- */

export function OverviewAccountSpendFallback() {
  return (
    <section
      className="animate-pulse rounded-card border border-line bg-surface px-4 py-4 shadow-card motion-reduce:animate-none sm:px-6"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="h-4 w-40 rounded-ctl bg-subtle" />
      <div className="mt-1.5 h-3 w-64 max-w-full rounded-ctl bg-subtle" />
      <div className="mt-4 space-y-3 pb-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-8 rounded-box bg-field" />
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

  return <AccountSpendPanel rows={rows} accounts={accounts} anchorDate={anchorDate} moneyUsd={moneyUsd} />;
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
        name: account
          ? `${label.title}${label.code ? ` · ${label.code}` : ""}`
          : id === "otros"
            ? t("byAccount.unknown")
            : `${t("byAccount.account")} ${shortId(id)}`,
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
            spend: Math.round(rest.reduce((sum, item) => sum + item.spend, 0) * 100) / 100,
          },
        ]
      : items;
  const top = shown[0]?.spend || 1;

  return (
    <PanelCard
      aria-labelledby="ov-by-account"
      title={<span id="ov-by-account">{t("byAccount.title")}</span>}
      description={t("byAccount.subtitle")}
      action={<ToneBadge>{t("byAccount.count", { count: items.length })}</ToneBadge>}
    >
      {items.length === 0 ? (
        <EmptyState icon="chart" title={t("byAccount.empty")} className="py-8" />
      ) : (
        <>
          <ul>
            {shown.map((item) => (
              <li key={item.id} className="grid grid-cols-[minmax(0,1.5fr)_minmax(56px,1.5fr)_7em] items-center gap-3 py-2 text-[13px]">
                <span className="truncate" title={item.name}>
                  {item.name}
                </span>
                <span aria-hidden className="h-1.5 rounded-full bg-accent-soft">
                  <i className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(2, (item.spend / top) * 100)}%` }} />
                </span>
                <b className="num text-right font-semibold">{moneyUsd(item.spend)}</b>
              </li>
            ))}
          </ul>
          <div className="mt-1 flex items-center justify-between border-t border-line pt-3 text-[13px]">
            <span className="font-medium text-ink-2">{t("byAccount.total")}</span>
            <b className="num font-semibold">{moneyUsd(total)}</b>
          </div>
        </>
      )}
    </PanelCard>
  );
}
