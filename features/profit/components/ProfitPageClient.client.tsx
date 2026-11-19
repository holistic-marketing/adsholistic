"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { PageHeader, PanelCard } from "@/components/ui/PageHeader";
import { buttonClass } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { PanelIcon } from "@/components/ui/PanelIcon";
import {
  EmptyState,
  FilterBar,
  KpiGrid,
  Note,
  StatCard,
  ToneBadge,
  type Tone,
} from "@/components/ui/PanelKit";
import { useAdAccountLiveMetrics } from "@/features/ad-accounts/hooks/useAdAccountLiveMetrics";
import { ProfitAdvisorHeader } from "@/features/profit/components/ProfitAdvisorHeader";
import { ProfitDateRangeField } from "@/features/profit/components/ProfitDateRangeField.client";
import { ProfitSectionSwitch } from "@/features/profit/radar/components/ProfitSectionSwitch";
import { RadarInviteCard } from "@/features/profit/radar/components/RadarInviteCard";
import {
  RealProfitConnect,
  type RpConnections,
} from "@/features/profit/components/RealProfitConnect.client";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format-money";
import { moneyUsd } from "@/lib/format/money-usd";
import { useAppFormatter } from "@/lib/i18n/use-app-formatter";
import type { ClienteScore } from "@/lib/realprofit/client-score";

const ProfitAdvisorBot = dynamic(
  () =>
    import("@/features/profit/components/ProfitAdvisorBot.client").then(
      (m) => m.ProfitAdvisorBot,
    ),
  { ssr: false, loading: () => <ProfitAdvisorBotFallback /> },
);

const ProductPerformancePanel = dynamic(
  () =>
    import("@/features/profit/components/ProductPerformancePanel.client").then(
      (m) => m.ProductPerformancePanel,
    ),
  // Vacío si no hay productos: un esqueleto aparecería y se iría.
  { ssr: false, loading: () => null },
);

const ProfitPilotPanel = dynamic(
  () => import("@/features/profit/components/ProfitPilotPanel.client").then((m) => m.ProfitPilotPanel),
  { ssr: false, loading: () => null },
);

const ProfitAdsTable = dynamic(
  () => import("@/features/profit/components/ProfitAdsTable.client").then((m) => m.ProfitAdsTable),
  { ssr: false, loading: () => null },
);

function ProfitAdvisorBotFallback() {
  const t = useTranslations("profit");
  return (
    <section
      id="profit-advisor"
      aria-busy="true"
      aria-label={t("advisorTitle")}
      className="overflow-hidden rounded-card border border-line bg-surface shadow-card"
    >
      <ProfitAdvisorHeader eyebrow={t("advisorEyebrow")} title={t("advisorTitle")} />
      <div className="min-h-[220px] animate-pulse bg-field motion-reduce:animate-none" />
      <div className="border-t border-line px-4 py-3 sm:px-6">
        <div className="h-9 rounded-ctl bg-field" />
      </div>
    </section>
  );
}

function limaTodayYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Último día con jale Hecom (gasto ads cierra hasta ayer). */
function limaSpendMaxYmd(): string {
  const today = limaTodayYmd();
  const base = new Date(`${today}T12:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() - 1);
  return base.toISOString().slice(0, 10);
}

type StoreSummary = {
  id: string;
  name: string;
  shopDomain: string | null;
  currency: string;
  isActive?: boolean;
};

type CampaignRow = {
  campaignExternalId: string;
  campaignName: string;
  platform: string;
  spend: number;
  spendShare: number;
  collectedEstimated: number;
  roasEstimated: number | null;
  bm: string | null;
  advertiserId: string | null;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  conversions: number | null;
  costPerConversion: number | null;
  hasTikTokPerf: boolean;
  lastStatDate: string | null;
};

type DailyPoint = { date: string; spend: number };

type ProfitSignal = {
  kind: string;
  severity: "info" | "warn" | "critical";
  title: string;
  detail: string;
};

type StaffOps = {
  walletAvailableUsd: number | null;
  adLedgerAvailableUsd: number;
  accountsWithLedgerBalance: number;
  lastAllocation: {
    accountLabel: string;
    amountUsd: number;
    hoursAgo: number;
    at: string;
  } | null;
  burn: {
    critical: number;
    warn: number;
    info: number;
    status: "critical" | "warn" | "info" | "none";
  };
  creditHint: string;
  score: ClienteScore | null;
};

type Analysis = {
  from: string;
  to: string;
  spendToday: number;
  spendYesterday: number;
  spendTodayDeltaPct: number | null;
  spend7d: number;
  spendPrev7d: number;
  spend7dDeltaPct: number | null;
  spend30d: number;
  spendInRange: number;
  spendPrevRange: number;
  spendRangeDeltaPct: number | null;
  pacingRatio: number | null;
  pacingLabel: "acelerando" | "normal" | "bajo" | "parado" | "sin_base";
  daysWithActivity: number;
  dailySeries: DailyPoint[];
  campaigns: CampaignRow[];
  collectedRevenue: number;
  roasCollected: number | null;
  hasCodLink: boolean;
  ordersCollected?: number;
  cpaCollected?: number | null;
  avgOrderCollected?: number | null;
  feePercent?: number;
  effectiveAdSpend?: number;
  roasEffective?: number | null;
  breakEvenRoas?: number;
  aboveBreakEven?: boolean | null;
  cogsTotal?: number;
  courierTotal?: number;
  netProfit?: number | null;
  hasProductCosts?: boolean;
  dataThroughDate: string | null;
  signals: ProfitSignal[];
  perf?: {
    available: boolean;
    impressions: number;
    clicks: number;
    conversions: number;
    avgCtr: number | null;
    avgCpc: number | null;
    avgCpm: number | null;
    advertisersQueried: number;
    advertisersOk: number;
    fetchedAt: string | null;
    error: string | null;
  };
};

type Snapshot = {
  store: StoreSummary;
  from: string;
  to: string;
  collectedRevenue: number;
  adSpend: number;
  roasCollected: number | null;
  ordersCollected: number;
  netProfit?: number;
  spendSource?: "realprofit" | "holistic_tiktok" | "mixed" | "none";
};

type ProfitT = ReturnType<typeof useTranslations<"profit">>;

function formatDelta(pct: number | null, noBaselineLabel: string): string {
  if (pct == null) return noBaselineLabel;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(0)}%`;
}

const PACING_TONE: Record<Analysis["pacingLabel"], Tone> = {
  acelerando: "accent",
  bajo: "warn",
  parado: "neutral",
  normal: "ok",
  sin_base: "neutral",
};

function formatSyncTime(iso: string | null, bcp47: string): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat(bcp47, {
      timeZone: "America/Lima",
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Campañas visibles antes de "Ver todas". */
const CAMPAIGNS_PREVIEW = 10;

type SortKey = "spend" | "share" | "name" | "roas" | "ctr" | "cpc";

function formatDayShort(ymd: string, bcp47: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat(bcp47, {
    day: "numeric",
    month: "short",
  }).format(dt);
}

function formatRangeLabel(from: string, to: string, bcp47: string): string {
  if (!from || !to) return "—";
  if (from === to) return formatDayShort(from, bcp47);
  return `${formatDayShort(from, bcp47)} → ${formatDayShort(to, bcp47)}`;
}

/** Evita mostrar solo el ID numérico como “nombre” de campaña. */
function displayCampaignTitle(name: string, externalId: string): string {
  const id = externalId.replace(/^name:/, "").trim();
  const n = String(name ?? "").trim();
  if (!n || n === id || /^\d{10,}$/.test(n)) {
    return id ? `Campaña · …${id.slice(-6)}` : "Campaña sin nombre";
  }
  return n;
}

/* --- Semáforo de riesgo (solo gerencia) ------------------------------------ */

const VERDICT_TONE: Record<ClienteScore["verdict"], Tone> = {
  green: "ok",
  yellow: "warn",
  orange: "accent",
  red: "danger",
  no_base: "neutral",
};

const SCORE_BANDS = [
  ["green", "scoreBandGreen"],
  ["yellow", "scoreBandYellow"],
  ["orange", "scoreBandOrange"],
  ["red", "scoreBandRed"],
] as const;

function scoreVerdictLabel(verdict: ClienteScore["verdict"], t: ProfitT): string {
  switch (verdict) {
    case "green":
      return t("scoreVerdictGreen");
    case "yellow":
      return t("scoreVerdictYellow");
    case "orange":
      return t("scoreVerdictOrange");
    case "red":
      return t("scoreVerdictRed");
    default:
      return t("scoreVerdictNoBase");
  }
}

function scoreHint(verdict: ClienteScore["verdict"], t: ProfitT): string {
  switch (verdict) {
    case "green":
      return t("scoreHintGreen");
    case "yellow":
      return t("scoreHintYellow");
    case "orange":
      return t("scoreHintOrange");
    case "red":
      return t("scoreHintRed");
    default:
      return t("scoreHintNoBase");
  }
}

function scoreActionLabel(verdict: ClienteScore["verdict"], t: ProfitT): string {
  switch (verdict) {
    case "green":
      return t("scoreActionGreen");
    case "yellow":
      return t("scoreActionYellow");
    case "orange":
      return t("scoreActionOrange");
    case "red":
      return t("scoreActionRed");
    default:
      return t("scoreActionNoBase");
  }
}

function scoreFactorLabel(id: ClienteScore["factors"][number]["id"], t: ProfitT): string {
  switch (id) {
    case "ads":
      return t("scoreFactorAds");
    case "credit":
      return t("scoreFactorCredit");
    case "collections":
      return t("scoreFactorCollections");
    default:
      return t("scoreFactorTickets");
  }
}

function scoreNoteLabel(note: ClienteScore["factors"][number]["note"], t: ProfitT): string {
  switch (note) {
    case "ads_none":
      return t("scoreNoteAdsNone");
    case "ads_strong":
      return t("scoreNoteAdsStrong");
    case "ads_mid":
      return t("scoreNoteAdsMid");
    case "ads_weak":
      return t("scoreNoteAdsWeak");
    case "credit_ok":
      return t("scoreNoteCreditOk");
    case "credit_watch":
      return t("scoreNoteCreditWatch");
    case "credit_burn_fast":
      return t("scoreNoteCreditBurnFast");
    case "credit_risk":
      return t("scoreNoteCreditRisk");
    case "credit_agency":
      return t("scoreNoteCreditAgency");
    case "collections_unknown":
      return t("scoreNoteCollectionsUnknown");
    case "collections_none":
      return t("scoreNoteCollectionsNone");
    case "collections_clean":
      return t("scoreNoteCollectionsClean");
    case "collections_one":
      return t("scoreNoteCollectionsOne");
    case "collections_many":
      return t("scoreNoteCollectionsMany");
    case "tickets_unknown":
      return t("scoreNoteTicketsUnknown");
    case "tickets_clear":
      return t("scoreNoteTicketsClear");
    default:
      return t("scoreNoteTicketsOpen");
  }
}

/** Dato chico con rótulo en mayúsculas (v3 «mini»). `text` para valores en palabras. */
function MiniStat({
  label,
  value,
  sub,
  text = false,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  text?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-box border border-line bg-field px-3 py-2.5">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-3">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 font-semibold text-ink [overflow-wrap:anywhere]",
          text ? "text-sm" : "num text-[15px]",
        )}
      >
        {value}
      </dd>
      {sub ? <dd className="text-xs text-ink-3">{sub}</dd> : null}
    </div>
  );
}

/** Las cuatro franjas del semáforo, con la actual marcada (v3 «sem»). */
function ScoreBands({ score, t }: { score: ClienteScore; t: ProfitT }) {
  const current = SCORE_BANDS.find(([band]) => band === score.verdict);
  return (
    <div
      role="img"
      aria-label={`${t("scoreTitle")}: ${score.score ?? "—"} ${t("scoreOf")} · ${scoreVerdictLabel(score.verdict, t)}${current ? ` ${t(current[1])}` : ""}`}
      className="grid grid-cols-2 gap-1 sm:grid-cols-4"
    >
      {SCORE_BANDS.map(([band, rangeKey]) => (
        <span
          key={band}
          className={cn(
            "rounded-[6px] border px-2 py-1.5 text-center text-xs font-medium",
            score.verdict === band
              ? cn("border-[var(--t-solid)] bg-[var(--t-bg)] text-[var(--t-fg)]", `tone-${VERDICT_TONE[band]}`)
              : "border-line bg-field text-ink-3",
          )}
        >
          {scoreVerdictLabel(band, t)} {t(rangeKey)}
        </span>
      ))}
    </div>
  );
}

function factorTone(points: number | null): Tone {
  if (points == null) return "neutral";
  if (points >= 70) return "ok";
  if (points >= 45) return "warn";
  return "danger";
}

function StaffOpsPanel({
  ops,
  spendTodayUsd,
  spend7dUsd,
  pacingLabel,
  pacingRatio,
  fromLiveFallback,
  t,
}: {
  ops: StaffOps;
  spendTodayUsd: number;
  spend7dUsd: number;
  pacingLabel: string;
  pacingRatio: number | null;
  fromLiveFallback: boolean;
  t: ProfitT;
}) {
  const score = ops.score;
  const advisorLink = (
    <a href="#profit-advisor" className={buttonClass("secondary", "sm", "mt-3")}>
      <PanelIcon name="sparkle" />
      {t("advisorOpen")}
    </a>
  );
  return (
    <section aria-labelledby="profit-score-title" className="rounded-card border border-line bg-surface shadow-card">
      <div className="flex items-start justify-between gap-4 px-4 pt-4 sm:px-6 sm:pt-5">
        <div className="min-w-0">
          <p className="eyebrow">{t("staffOpsLabel")}</p>
          <h2 id="profit-score-title" className="text-base font-semibold leading-6 tracking-[-0.01em] text-ink">
            {t("scoreTitle")}
          </h2>
          <p className="mt-0.5 text-xs text-ink-2">{t("scoreSubtitle")}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-ink-3 first-letter:uppercase">{t("scoreDialLabel")}</p>
          <p className="num text-[2rem] font-bold leading-tight tracking-[-0.04em] text-ink">
            {score?.score ?? "—"}
            <span className="ml-1 font-sans text-[13px] font-medium tracking-normal text-ink-3">{t("scoreOf")}</span>
          </p>
        </div>
      </div>

      <div className="px-4 pb-4 pt-3 sm:px-6 sm:pb-6 sm:pt-4">
        {score ? (
          <>
            <ScoreBands score={score} t={t} />
            <Note tone={VERDICT_TONE[score.verdict]} title={scoreActionLabel(score.verdict, t)} className="mt-3.5">
              {scoreHint(score.verdict, t)}
            </Note>
            {advisorLink}
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {score.factors.map((factor) => (
                <li key={factor.id} className="rounded-box border border-line bg-field px-3.5 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-3">
                      {scoreFactorLabel(factor.id, t)}
                    </p>
                    <p className="num text-[13px] font-semibold text-ink">{factor.points ?? "—"}</p>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-subtle" aria-hidden>
                    <div
                      className={cn("h-full rounded-full bg-[var(--t-solid)]", `tone-${factorTone(factor.points)}`)}
                      style={{ width: `${factor.points ?? 8}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs leading-4 text-ink-2">{scoreNoteLabel(factor.note, t)}</p>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <p className="text-[13px] text-ink-2">{t("scorePending")}</p>
            {advisorLink}
          </>
        )}

        <h3 className="mt-6 text-sm font-semibold text-ink">{t("staffOpsTitle")}</h3>
        <p className="mt-1 max-w-2xl text-[13px] leading-5 text-ink-2">{ops.creditHint}</p>
        {fromLiveFallback ? (
          <p className="mt-1 text-xs font-medium text-accent-text">{t("staffOpsLiveFallback")}</p>
        ) : null}
        <dl className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
          <MiniStat
            label={t("staffOpsWallet")}
            value={ops.walletAvailableUsd != null ? moneyUsd(ops.walletAvailableUsd) : "—"}
          />
          <MiniStat
            label={t("staffOpsAdLedger")}
            value={moneyUsd(ops.adLedgerAvailableUsd)}
            sub={t("staffOpsAccountsWithBal", { count: ops.accountsWithLedgerBalance })}
          />
          <MiniStat
            label={t("staffOpsLastAlloc")}
            text={!ops.lastAllocation}
            value={ops.lastAllocation ? moneyUsd(ops.lastAllocation.amountUsd) : t("staffOpsNoAlloc")}
            sub={
              ops.lastAllocation
                ? `${ops.lastAllocation.accountLabel} · ${t("staffOpsHoursAgo", { hours: ops.lastAllocation.hoursAgo })}`
                : undefined
            }
          />
          <MiniStat
            label={t("staffOpsBurn")}
            text
            value={
              ops.burn.status === "none"
                ? t("staffOpsBurnNone")
                : ops.burn.status === "critical"
                  ? t("severityCritical")
                  : ops.burn.status === "warn"
                    ? t("severityWarn")
                    : t("severityInfo")
            }
            sub={t("staffOpsBurnCounts", {
              critical: ops.burn.critical,
              warn: ops.burn.warn,
              info: ops.burn.info,
            })}
          />
          <MiniStat label={t("staffOpsSpendToday")} value={moneyUsd(spendTodayUsd)} />
          <MiniStat label={t("staffOpsSpend7d")} value={moneyUsd(spend7dUsd)} />
          <MiniStat
            label={t("staffOpsPacing")}
            text
            value={`${pacingLabel}${pacingRatio != null ? ` · ${pacingRatio.toFixed(2)}×` : ""}`}
          />
        </dl>
      </div>
    </section>
  );
}

/* --- Análisis de TikTok ------------------------------------------------------ */

const SEVERITY_TONE: Record<ProfitSignal["severity"], Tone> = {
  critical: "danger",
  warn: "warn",
  info: "neutral",
};

function SignalsCard({
  signals,
  isStaff,
  warnCount,
  t,
}: {
  signals: ProfitSignal[];
  isStaff: boolean;
  warnCount: number;
  t: ProfitT;
}) {
  return (
    <PanelCard
      title={t("signalsTitle")}
      description={isStaff ? t("signalsStaffHint") : t("signalsClientHint")}
      action={
        isStaff ? (
          <ToneBadge tone="accent">
            {t("signalsStaffBadge", { warn: warnCount, total: signals.length })}
          </ToneBadge>
        ) : null
      }
    >
      <ul>
        {signals.map((signal, idx) => (
          <li
            key={`${signal.kind}-${idx}-${signal.title}`}
            className="flex gap-3 border-t border-line py-3 first:border-t-0 first:pt-0 last:pb-0"
          >
            <span className="shrink-0 pt-px">
              <ToneBadge tone={SEVERITY_TONE[signal.severity]} dot>
                {signal.severity === "critical"
                  ? t("severityCritical")
                  : signal.severity === "warn"
                    ? t("severityWarn")
                    : t("severityInfo")}
              </ToneBadge>
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{signal.title}</p>
              <p className="mt-0.5 text-[13px] leading-5 text-ink-2">{signal.detail}</p>
              {isStaff ? <p className="num mt-1 text-[11px] text-ink-3">{signal.kind}</p> : null}
            </div>
          </li>
        ))}
      </ul>
    </PanelCard>
  );
}

function CampaignsCard({
  analysis,
  campaigns,
  sortKey,
  sortAsc,
  onSort,
  showAll,
  onToggleShowAll,
  isStaff,
  bcp47,
  t,
}: {
  analysis: Analysis;
  campaigns: CampaignRow[];
  sortKey: SortKey;
  sortAsc: boolean;
  onSort: (key: SortKey) => void;
  showAll: boolean;
  onToggleShowAll: () => void;
  isStaff: boolean;
  bcp47: string;
  t: ProfitT;
}) {
  const th = "h-10 whitespace-nowrap border-b border-line bg-surface px-2 font-medium text-ink";
  const td = "border-b border-line p-2";

  /** Encabezado ordenable (v3 «th-btn»): la flecha marca el orden actual. */
  const sortTh = (col: SortKey, label: string, numeric = true, extra?: string) => {
    const active = sortKey === col;
    return (
      <th
        scope="col"
        aria-sort={active ? (sortAsc ? "ascending" : "descending") : "none"}
        className={cn(th, numeric && "text-right", extra)}
      >
        <button
          type="button"
          onClick={() => onSort(col)}
          className={cn("inline-flex items-center gap-1 py-1", numeric && "flex-row-reverse")}
        >
          {label}
          <PanelIcon
            name="chevron-down"
            className={cn(
              "size-3 transition-transform",
              active ? "text-accent-text" : "text-ink-3 opacity-50",
              active && sortAsc && "rotate-180",
            )}
          />
        </button>
      </th>
    );
  };

  return (
    <PanelCard
      title={t("campaigns")}
      description={
        <>
          {t("campaignsSubtitle")} · {t("rangeMeta", { range: formatRangeLabel(analysis.from, analysis.to, bcp47) })}
          {analysis.daysWithActivity ? ` · ${t("daysWithSpend", { count: analysis.daysWithActivity })}` : ""}
          {analysis.perf?.fetchedAt
            ? ` · ${t("perfUpdated", { time: formatSyncTime(analysis.perf.fetchedAt, bcp47) ?? "—" })}`
            : ""}
          {` · ${t("inRangeSpend")} `}
          <span className="num font-semibold text-ink">{moneyUsd(analysis.spendInRange)}</span>
        </>
      }
    >
      {campaigns.length === 0 ? (
        <EmptyState icon="chart" title={t("emptyCampaigns")} description={t("emptyTryRange")} className="py-8" />
      ) : (
        <>
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-left text-[13px]">
              <thead>
                <tr>
                  {sortTh("name", t("colCampaign"), false, "sticky left-0 z-[2]")}
                  <th scope="col" className={th}>{t("colDelivery")}</th>
                  <th scope="col" className={th}>{t("colBm")}</th>
                  {sortTh("spend", t("colSpend"))}
                  {sortTh("share", t("colPct"))}
                  <th scope="col" className={cn(th, "text-right")}>{t("colImp")}</th>
                  <th scope="col" className={cn(th, "text-right")}>{t("colClicks")}</th>
                  {sortTh("ctr", t("colCtr"))}
                  {sortTh("cpc", t("colCpc"))}
                  <th scope="col" className={cn(th, "text-right")}>{t("colCpm")}</th>
                  <th scope="col" className={cn(th, "text-right")}>{t("colConv")}</th>
                  <th scope="col" className={cn(th, "text-right")}>{t("colCpa")}</th>
                  {analysis.hasCodLink ? (
                    <>
                      <th scope="col" className={cn(th, "text-right")}>{t("colCharged")}</th>
                      {sortTh("roas", t("colRoas"))}
                    </>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {(showAll ? campaigns : campaigns.slice(0, CAMPAIGNS_PREVIEW)).map((c) => {
                  const idShown = c.campaignExternalId.startsWith("name:") ? null : c.campaignExternalId;
                  const deliveryDate = c.lastStatDate
                    ? formatDayShort(c.lastStatDate, bcp47)
                    : formatRangeLabel(analysis.from, analysis.to, bcp47);
                  const deliveryTime = c.hasTikTokPerf
                    ? formatSyncTime(analysis.perf?.fetchedAt ?? null, bcp47)
                    : null;
                  return (
                    <tr
                      key={`${c.platform}-${c.campaignExternalId}-${c.advertiserId ?? ""}`}
                      className="group hover:bg-field [&:last-child>td]:border-b-0"
                    >
                      <td className={cn(td, "sticky left-0 z-[1] max-w-[160px] bg-surface group-hover:bg-field sm:max-w-[260px]")}>
                        <p className="truncate font-semibold text-ink">
                          {displayCampaignTitle(c.campaignName, c.campaignExternalId)}
                        </p>
                        {isStaff ? (
                          <p className="num mt-0.5 truncate text-[11px] text-ink-3">
                            {idShown ?? t("noId")}
                            {c.advertiserId ? ` · ${c.advertiserId}` : ""}
                          </p>
                        ) : null}
                      </td>
                      <td className={cn(td, "whitespace-nowrap")}>
                        <p className="num text-ink">{deliveryDate}</p>
                        {isStaff && deliveryTime ? (
                          <p className="mt-0.5 text-[11px] text-ink-3">{t("updatedShort", { time: deliveryTime })}</p>
                        ) : null}
                      </td>
                      <td className={cn(td, "num text-ink-2")}>{c.bm ?? "—"}</td>
                      <td className={cn(td, "num text-right font-semibold text-ink")}>{moneyUsd(c.spend)}</td>
                      <td className={cn(td, "num text-right text-ink-2")}>{(c.spendShare * 100).toFixed(1)}%</td>
                      <td className={cn(td, "num text-right")}>
                        {c.impressions != null ? c.impressions.toLocaleString(bcp47) : "—"}
                      </td>
                      <td className={cn(td, "num text-right")}>
                        {c.clicks != null ? c.clicks.toLocaleString(bcp47) : "—"}
                      </td>
                      <td className={cn(td, "num text-right")}>{c.ctr != null ? `${c.ctr.toFixed(2)}%` : "—"}</td>
                      <td className={cn(td, "num text-right")}>{c.cpc != null ? moneyUsd(c.cpc) : "—"}</td>
                      <td className={cn(td, "num text-right")}>{c.cpm != null ? moneyUsd(c.cpm) : "—"}</td>
                      <td className={cn(td, "num text-right")}>
                        {c.conversions != null ? c.conversions.toLocaleString(bcp47) : "—"}
                      </td>
                      <td className={cn(td, "num text-right")}>
                        {c.costPerConversion != null ? moneyUsd(c.costPerConversion) : "—"}
                      </td>
                      {analysis.hasCodLink ? (
                        <>
                          <td className={cn(td, "num text-right")}>
                            {formatMoney(c.collectedEstimated, "PEN")}
                          </td>
                          <td className={cn(td, "num text-right font-semibold text-ink")}>
                            {c.roasEstimated != null ? `${c.roasEstimated.toFixed(2)}x` : "—"}
                          </td>
                        </>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {campaigns.length > CAMPAIGNS_PREVIEW ? (
            <div className="mt-1 border-t border-line pt-3">
              <button
                type="button"
                onClick={onToggleShowAll}
                className="text-[13px] font-medium text-accent-text underline-offset-[3px] hover:underline"
              >
                {showAll ? t("campaignsShowLess") : t("campaignsShowAll", { count: campaigns.length })}
              </button>
            </div>
          ) : null}
        </>
      )}
    </PanelCard>
  );
}

export function ProfitPageClient({
  clienteName,
  isStaff,
  initialFrom,
  initialTo,
  radarEnabled = false,
  radarInvite = false,
}: {
  clienteName: string;
  isStaff: boolean;
  initialFrom?: string;
  initialTo?: string;
  /** Muestra el selector Análisis · Radar (PROFIT_RADAR_ENABLED). */
  radarEnabled?: boolean;
  /** Muestra la invitación al Radar (el cliente aún no armó su perfil). */
  radarInvite?: boolean;
}) {
  const t = useTranslations("profit");
  const tCommon = useTranslations("common");
  const { bcp47 } = useAppFormatter();
  const [loading, setLoading] = useState(true);
  const firstLoadRef = useRef(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState(initialFrom ?? "");
  const [to, setTo] = useState(initialTo ?? "");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [staffOps, setStaffOps] = useState<StaffOps | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortAsc, setSortAsc] = useState(false);
  const [bmFilter, setBmFilter] = useState<string>("all");
  const [showAllCampaigns, setShowAllCampaigns] = useState(false);
  /** El cliente toca «Conectar TikTok Ads» para ver sus métricas (se recuerda en este navegador). */
  const tiktokKey = `profit.tiktokLinked.${clienteName}`;
  const [tiktokLinked, setTikTokLinked] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage solo existe en el cliente
      setTikTokLinked(window.localStorage.getItem(tiktokKey) === "1");
    } catch {
      /* sin storage: queda desconectado */
    }
  }, [tiktokKey]);
  function setTikTokLinkedPersist(on: boolean) {
    setTikTokLinked(on);
    try {
      window.localStorage.setItem(tiktokKey, on ? "1" : "0");
    } catch {
      /* sin storage */
    }
  }
  const [connections, setConnections] = useState<RpConnections | null>(null);
  const [realProfitUrl, setRealProfitUrl] = useState("https://realprofitcod.com");
  /** Link firmado con el cliente: instalar = vincular. */
  const [installUrl, setInstallUrl] = useState<string | null>(null);
  /** Botón «Conectar con Facebook» (OAuth) habilitado para este usuario. */
  const [metaOAuth, setMetaOAuth] = useState(false);
  const [metaBusinessId, setMetaBusinessId] = useState("");

  const live = useAdAccountLiveMetrics(true);
  const liveAccounts = useMemo(() => {
    return Object.values(live.metricsByAdvertiser)
      .filter(
        (a) =>
          (a.balanceUsd != null && a.balanceUsd > 0) ||
          (a.spendTodayUsd != null && a.spendTodayUsd > 0),
      )
      .sort(
        (a, b) => (b.spendTodayUsd ?? 0) - (a.spendTodayUsd ?? 0),
      );
  }, [live.metricsByAdvertiser]);
  const liveBalanceTotal = useMemo(
    () =>
      Object.values(live.metricsByAdvertiser).reduce(
        (s, a) => s + (a.balanceUsd ?? 0),
        0,
      ),
    [live.metricsByAdvertiser],
  );
  const liveSpendTotal = Object.values(live.metricsByAdvertiser).reduce(
    (s, a) => s + (a.spendTodayUsd ?? 0),
    0,
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q =
        from && to
          ? `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
          : "";
      const res = await fetch(`/api/profit${q}`, { cache: "no-store" });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        from?: string;
        to?: string;
        snapshots?: Snapshot[];
        analysis?: Analysis;
        staffOps?: StaffOps;
        connections?: RpConnections;
        installUrl?: string;
        realProfitUrl?: string;
        metaOAuth?: boolean;
        metaBusinessId?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || t("loadError"));
      }
      setInstallUrl(json.installUrl ?? null);
      setMetaOAuth(Boolean(json.metaOAuth));
      setMetaBusinessId(json.metaBusinessId ?? "");
      setAnalysis(json.analysis ?? null);
      setStaffOps(json.staffOps ?? null);
      setSnapshots(
        (json.snapshots ?? []).filter((s) => s.store.id !== "__holistic_tiktok__"),
      );
      setConnections(json.connections ?? null);
      if (json.realProfitUrl) setRealProfitUrl(json.realProfitUrl);
      const max = limaSpendMaxYmd();
      if (!from && json.from) {
        setFrom(json.from > max ? max : json.from);
      }
      if (!to && json.to) {
        setTo(json.to > max ? max : json.to);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("genericError"));
    } finally {
      setLoading(false);
    }
  }, [from, to, t]);

  // Rango invertido: se valida al renderizar y no se dispara la carga.
  const dateOrderError = from && to && from > to ? t("dateOrderError") : null;
  const displayError = dateOrderError ?? error;

  useEffect(() => {
    if (from && to && from > to) return;
    // Primera carga al toque; los cambios de fecha sí esperan un poco.
    const delay = firstLoadRef.current ? 0 : 280;
    firstLoadRef.current = false;
    const timer = window.setTimeout(() => {
      void refresh();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [from, to, refresh, t]);

  const bmOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of analysis?.campaigns ?? []) {
      if (c.bm?.trim()) set.add(c.bm.trim());
    }
    return [...set].sort();
  }, [analysis]);

  const sortedCampaigns = useMemo(() => {
    let rows = analysis?.campaigns ?? [];
    if (bmFilter !== "all") {
      rows = rows.filter((c) => (c.bm ?? "") === bmFilter);
    }
    const mul = sortAsc ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sortKey === "name") {
        return mul * a.campaignName.localeCompare(b.campaignName);
      }
      if (sortKey === "share") return mul * (a.spendShare - b.spendShare);
      if (sortKey === "roas") {
        const ar = a.roasEstimated ?? -1;
        const br = b.roasEstimated ?? -1;
        return mul * (ar - br);
      }
      if (sortKey === "ctr") {
        const ar = a.ctr ?? -1;
        const br = b.ctr ?? -1;
        return mul * (ar - br);
      }
      if (sortKey === "cpc") {
        const ar = a.cpc ?? Number.POSITIVE_INFINITY;
        const br = b.cpc ?? Number.POSITIVE_INFINITY;
        return mul * (ar - br);
      }
      return mul * (a.spend - b.spend);
    });
  }, [analysis, bmFilter, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(key === "name");
    }
  }

  const useLiveForToday = Boolean(live.lastUpdatedAt) && !live.error;
  const spendTodayDisplay = useLiveForToday
    ? liveSpendTotal
    : (analysis?.spendToday ?? 0);
  const syncLabel = formatSyncTime(live.lastUpdatedAt, bcp47);
  const todayYmd = limaTodayYmd();
  const syncPart = syncLabel
    ? t("liveHintSync", { time: syncLabel })
    : "";
  const hoyHint = useLiveForToday
    ? liveBalanceTotal > 0
      ? t("liveHintWithBalance", {
          balance: moneyUsd(liveBalanceTotal),
          sync: syncPart,
        })
      : t("liveHintNoBalance", { sync: syncPart })
    : analysis
      ? t("snapshotsVsYesterday", {
          delta: formatDelta(analysis.spendTodayDeltaPct, t("noBaseline")),
        })
      : t("loadingLive");

  const displayPacing = useMemo(() => {
    if (!analysis) {
      return { pacingRatio: null as number | null, pacingLabel: "sin_base" as const };
    }
    const spendToday = useLiveForToday ? liveSpendTotal : analysis.spendToday;
    const spend7d = analysis.spend7d;
    if (spendToday <= 0 && spend7d <= 0) {
      return { pacingRatio: null, pacingLabel: "sin_base" as const };
    }
    if (spendToday <= 0) {
      return { pacingRatio: 0, pacingLabel: "parado" as const };
    }
    const avg = spend7d / 7;
    if (avg <= 0) {
      return { pacingRatio: null, pacingLabel: "sin_base" as const };
    }
    const ratio = Math.round((spendToday / avg) * 100) / 100;
    if (ratio >= 1.35) return { pacingRatio: ratio, pacingLabel: "acelerando" as const };
    if (ratio <= 0.5) return { pacingRatio: ratio, pacingLabel: "bajo" as const };
    return { pacingRatio: ratio, pacingLabel: "normal" as const };
  }, [analysis, useLiveForToday, liveSpendTotal]);

  const displaySignals = useMemo(() => {
    const raw = analysis?.signals ?? [];
    // Si hay gasto live, no mostrar "Sin gasto hoy" (snapshots pueden ir atrasados).
    if (spendTodayDisplay > 0.05) {
      return raw.filter((s) => s.kind !== "silent");
    }
    return raw;
  }, [analysis?.signals, spendTodayDisplay]);

  const staffOpsResolved = useMemo(() => {
    if (!isStaff) return null;
    if (staffOps) return { ops: staffOps, fromLiveFallback: false };
    return {
      ops: {
        walletAvailableUsd: null,
        adLedgerAvailableUsd: liveBalanceTotal,
        accountsWithLedgerBalance: liveAccounts.length,
        lastAllocation: null,
        burn: { critical: 0, warn: 0, info: 0, status: "none" as const },
        creditHint:
          spendTodayDisplay > 0
            ? `Gasto live hoy ${moneyUsd(spendTodayDisplay)} · saldo TikTok ~${moneyUsd(liveBalanceTotal)}. Ledger Holistic aún no cargó detalle de asignación.`
            : "Sin gasto live hoy. Cuando asigne y gaste, aquí verás quema y crédito.",
        score: null,
      },
      fromLiveFallback: true,
    };
  }, [
    isStaff,
    staffOps,
    liveBalanceTotal,
    liveAccounts.length,
    spendTodayDisplay,
  ]);

  const warnSignalCount = displaySignals.filter(
    (s) => s.severity === "warn" || s.severity === "critical",
  ).length;

  const breakEvenHint = analysis
    ? analysis.aboveBreakEven == null
      ? t("kpiBeFee", {
          be: analysis.breakEvenRoas?.toFixed(2) ?? "—",
          fee: analysis.feePercent ?? "—",
        })
      : analysis.aboveBreakEven
        ? t("kpiAboveBe", {
            be: analysis.breakEvenRoas?.toFixed(2) ?? "—",
            fee: analysis.feePercent ?? "—",
          })
        : t("kpiBelowBe", {
            be: analysis.breakEvenRoas?.toFixed(2) ?? "—",
            fee: analysis.feePercent ?? "—",
          })
    : "";

  return (
    <div className="space-y-4 lg:space-y-5">
      <PageHeader
        className="mb-1"
        eyebrow={clienteName}
        title={
          <span className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <a
              href={realProfitUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-accent-text"
            >
              Real Profit COD
              <PanelIcon name="external" className="text-ink-3" />
            </a>
            <ToneBadge tone="ok">{t("rp.free")}</ToneBadge>
          </span>
        }
        lede={t("rp.subtitle")}
        actions={radarEnabled ? <ProfitSectionSwitch active="analysis" /> : null}
      />

      {displayError ? (
        <div role="alert">
          <Note tone="warn">{displayError}</Note>
        </div>
      ) : null}

      <RealProfitConnect
        connections={connections}
        installUrl={installUrl}
        metaOAuth={metaOAuth}
        metaBusinessId={metaBusinessId}
        onChanged={refresh}
        tiktokLinked={tiktokLinked}
        onTikTokLinkedChange={setTikTokLinkedPersist}
      />

      {radarInvite ? <RadarInviteCard /> : null}

      {/* Métricas TikTok: solo cuando el cliente conectó TikTok Ads en el panel. */}
      {tiktokLinked ? (
        <section aria-labelledby="profit-tiktok-title" className="space-y-4 pt-2 lg:space-y-5">
          <div>
            <h2 id="profit-tiktok-title" className="text-lg font-semibold tracking-[-0.015em] text-ink">
              {t("rp.tiktokTitle")}
            </h2>
            <p className="mt-0.5 max-w-[78ch] text-[13px] text-ink-2">{t("heroSubtitle")}</p>
          </div>

          {/* Gasto de hoy en vivo (v3 «hero»). */}
          <section
            aria-labelledby="profit-today-title"
            className="rounded-card border border-line bg-surface px-5 py-5 shadow-card sm:px-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 id="profit-today-title" className="text-base font-semibold leading-6 text-ink">
                  {t("spendTodayTitle")}
                </h3>
                <p className="text-xs text-ink-2">{t("spendTodaySubtitle")}</p>
                <p
                  className="mt-2 text-[2.25rem] font-semibold leading-[1.1] tracking-[-0.035em] text-ink tabular-nums"
                  aria-label={t("spendTodayLiveLabel", { date: formatDayShort(todayYmd, bcp47) })}
                >
                  {live.loading && !live.lastUpdatedAt ? "…" : moneyUsd(spendTodayDisplay)}
                </p>
                <p className="mt-1.5 text-[13px] text-ink-2">{hoyHint}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ToneBadge tone={PACING_TONE[displayPacing.pacingLabel]} dot>
                  {t(`pacing.${displayPacing.pacingLabel}`)}
                  {displayPacing.pacingRatio != null
                    ? ` · ${displayPacing.pacingRatio.toFixed(2)}×`
                    : ""}
                </ToneBadge>
                <button
                  type="button"
                  onClick={() => void live.refresh({ force: true })}
                  disabled={live.loading}
                  className={buttonClass("outline", "sm")}
                >
                  <PanelIcon name="refresh" />
                  {live.loading ? tCommon("loading") : t("refreshLive")}
                </button>
              </div>
            </div>

            {liveAccounts.length > 0 ? (
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {liveAccounts.slice(0, 6).map((acc) => (
                  <li
                    key={acc.advertiserId}
                    className="flex items-center justify-between gap-3 rounded-box border border-line bg-field px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-ink">{acc.accountName}</p>
                      <p className="num truncate text-[11px] text-ink-3">
                        {acc.bmBucket ? `${t("bmLabel")} ${acc.bmBucket} · ` : ""}
                        {acc.advertiserId}
                      </p>
                    </div>
                    <p className="num shrink-0 text-sm font-semibold text-ink">
                      {moneyUsd(acc.spendTodayUsd ?? 0)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}

            {live.error ? (
              <div role="alert" className="mt-4">
                <Note tone="warn">
                  {analysis
                    ? t("liveFallback", {
                        error: live.error,
                        amount: moneyUsd(analysis.spendToday),
                      })
                    : t("liveErrorOnly", { error: live.error })}
                </Note>
              </div>
            ) : null}
          </section>

          {/* Rango del análisis y filtro de BM (v3 «fbar»). */}
          <FilterBar
            tools={
              loading ? (
                <span role="status" className="text-xs font-medium text-ink-3">
                  {tCommon("loading")}
                </span>
              ) : null
            }
          >
            <ProfitDateRangeField
              from={from}
              to={to}
              max={limaSpendMaxYmd()}
              onChange={({ from: nextFrom, to: nextTo }) => {
                const max = limaSpendMaxYmd();
                let f = nextFrom;
                let t = nextTo;
                if (t && t > max) t = max;
                if (f && f > max) f = max;
                if (f && t && f > t) f = t;
                setFrom(f);
                setTo(t);
              }}
            />
            {bmOptions.length > 0 ? (
              <label className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
                {t("colBm")}
                <span className="w-40">
                  <Select value={bmFilter} onChange={(e) => setBmFilter(e.target.value)}>
                    <option value="all">{t("allBm")}</option>
                    {bmOptions.map((bm) => (
                      <option key={bm} value={bm}>
                        {bm}
                      </option>
                    ))}
                  </Select>
                </span>
              </label>
            ) : null}
          </FilterBar>

          {loading && !analysis ? (
            <div className="space-y-4" role="status" aria-live="polite">
              <span className="sr-only">{t("loadingAnalysis")}</span>
              <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-28 animate-pulse rounded-card border border-line bg-surface motion-reduce:animate-none"
                  />
                ))}
              </div>
              <div className="h-64 animate-pulse rounded-card border border-line bg-surface motion-reduce:animate-none" />
            </div>
          ) : analysis ? (
            <>
              {displaySignals.length > 0 ? (
                <SignalsCard signals={displaySignals} isStaff={isStaff} warnCount={warnSignalCount} t={t} />
              ) : null}

              {analysis.perf ? (
                <KpiGrid>
                  <StatCard
                    label={t("kpiImpressions")}
                    value={analysis.perf.available ? analysis.perf.impressions.toLocaleString(bcp47) : "—"}
                    sub={
                      analysis.perf.error
                        ? analysis.perf.error
                        : t("kpiAccountsOk", {
                            ok: analysis.perf.advertisersOk,
                            total: analysis.perf.advertisersQueried,
                          })
                    }
                  />
                  <StatCard
                    label={t("kpiClicks")}
                    value={analysis.perf.available ? analysis.perf.clicks.toLocaleString(bcp47) : "—"}
                    sub={
                      analysis.perf.conversions > 0
                        ? t("kpiConv", { count: analysis.perf.conversions.toLocaleString(bcp47) })
                        : t("kpiReportTikTok")
                    }
                  />
                  <StatCard
                    label={t("kpiAvgCtr")}
                    value={analysis.perf.avgCtr != null ? `${analysis.perf.avgCtr.toFixed(2)}%` : "—"}
                    sub={t("kpiCtrHint")}
                  />
                  <StatCard
                    label={t("kpiAvgCpc")}
                    value={analysis.perf.avgCpc != null ? moneyUsd(analysis.perf.avgCpc) : "—"}
                    sub={
                      analysis.perf.avgCpm != null
                        ? t("kpiCpmPrefix", { amount: moneyUsd(analysis.perf.avgCpm) })
                        : t("kpiSpendClicks")
                    }
                  />
                </KpiGrid>
              ) : null}

              {analysis.hasCodLink ? (
                <KpiGrid>
                  <StatCard
                    label={t("kpiCollectedCod")}
                    value={formatMoney(analysis.collectedRevenue, "PEN")}
                    sub={t("kpiOrdersCollected", { count: analysis.ordersCollected ?? 0 })}
                  />
                  <StatCard
                    label={t("kpiCpaCollected")}
                    value={analysis.cpaCollected != null ? moneyUsd(analysis.cpaCollected) : "—"}
                    sub={t("kpiCpaHint")}
                  />
                  <StatCard
                    label={t("kpiRoasCollected")}
                    value={analysis.roasCollected != null ? `${analysis.roasCollected.toFixed(2)}x` : "—"}
                    sub={t("kpiRoasHint")}
                  />
                  <StatCard
                    label={t("kpiRoasEffective")}
                    value={analysis.roasEffective != null ? `${analysis.roasEffective.toFixed(2)}x` : "—"}
                    sub={breakEvenHint}
                  />
                </KpiGrid>
              ) : analysis.feePercent != null ? (
                <Note>
                  {t("feeHolisticLine", {
                    fee: analysis.feePercent,
                    spend: moneyUsd(analysis.effectiveAdSpend ?? analysis.spendInRange),
                    be: analysis.breakEvenRoas?.toFixed(2) ?? "—",
                  })}{" "}
                  {t("emptyConnectStore")}
                </Note>
              ) : null}

              {analysis.hasCodLink && analysis.netProfit != null ? (
                <StatCard
                  label={t("netProfitLabel")}
                  value={
                    <span className={analysis.netProfit >= 0 ? "text-ok-fg" : "text-danger-fg"}>
                      {formatMoney(analysis.netProfit, "PEN")}
                    </span>
                  }
                  sub={
                    <>
                      {t("netProfitBreakdown", {
                        collected: formatMoney(analysis.collectedRevenue, "PEN"),
                        product: formatMoney(analysis.cogsTotal ?? 0, "PEN"),
                        courier: formatMoney(analysis.courierTotal ?? 0, "PEN"),
                        ads: moneyUsd(analysis.effectiveAdSpend ?? analysis.spendInRange),
                      })}
                      {analysis.hasProductCosts === false ? (
                        <span className="mt-1 block font-medium text-accent-text">{t("netProfitNoCosts")}</span>
                      ) : null}
                    </>
                  }
                />
              ) : null}

              <CampaignsCard
                analysis={analysis}
                campaigns={sortedCampaigns}
                sortKey={sortKey}
                sortAsc={sortAsc}
                onSort={toggleSort}
                showAll={showAllCampaigns}
                onToggleShowAll={() => setShowAllCampaigns((v) => !v)}
                isStaff={isStaff}
                bcp47={bcp47}
                t={t}
              />
            </>
          ) : null}
        </section>
      ) : null}

      {snapshots.length > 0 ? (
        <PanelCard title={t("snapshotCodTitle")} description={t("snapshotOrdersHint")}>
          <div className="space-y-5">
            {snapshots.map((snap) => (
              <div key={snap.store.id}>
                <h3 className="mb-2 text-sm font-semibold text-ink">{snap.store.name}</h3>
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                  <StatCard
                    flat
                    label={t("snapshotCollected")}
                    value={formatMoney(snap.collectedRevenue, snap.store.currency)}
                    sub={t("snapshotOrders", { count: snap.ordersCollected })}
                  />
                  <StatCard
                    flat
                    label={t("snapshotSpend")}
                    value={formatMoney(snap.adSpend, snap.store.currency)}
                    sub={t("snapSpendHint")}
                  />
                  <StatCard
                    flat
                    label={t("snapshotRoas")}
                    value={snap.roasCollected != null ? `${snap.roasCollected.toFixed(2)}x` : "—"}
                    sub={t("snapRoasHint")}
                  />
                  <StatCard
                    flat
                    label={t("netProfitLabel")}
                    value={snap.netProfit != null ? formatMoney(snap.netProfit, snap.store.currency) : "—"}
                    sub={t("snapNetHint")}
                  />
                </div>
              </div>
            ))}
          </div>
        </PanelCard>
      ) : null}

      {isStaff ? (
        <section
          aria-labelledby="profit-staff-zone"
          className="space-y-4 border-t border-line pt-6 lg:space-y-5"
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="profit-staff-zone" className="text-lg font-semibold tracking-[-0.015em] text-ink">
                {t("staffZoneTitle")}
              </h2>
              <ToneBadge tone="accent">{t("staffZoneEyebrow")}</ToneBadge>
            </div>
            <p className="mt-0.5 max-w-xl text-[13px] text-ink-2">{t("staffZoneHint")}</p>
          </div>
          {staffOpsResolved ? (
            <StaffOpsPanel
              ops={staffOpsResolved.ops}
              spendTodayUsd={spendTodayDisplay}
              spend7dUsd={analysis?.spend7d ?? 0}
              pacingLabel={displayPacing.pacingLabel}
              pacingRatio={displayPacing.pacingRatio}
              fromLiveFallback={staffOpsResolved.fromLiveFallback}
              t={t}
            />
          ) : null}
          {/* Rendimiento por producto y por anuncio: solo gerencia, el cliente no lo ve. */}
          {analysis ? <ProductPerformancePanel campaigns={analysis.campaigns} /> : null}
          {radarEnabled ? <ProfitPilotPanel /> : null}
          {radarEnabled && from && to ? <ProfitAdsTable from={from} to={to} /> : null}
          <ProfitAdvisorBot clienteName={clienteName} from={from} to={to} />
        </section>
      ) : null}
    </div>
  );
}
