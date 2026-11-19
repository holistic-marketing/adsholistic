"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { PanelCard } from "@/components/ui/PageHeader";
import { buttonClass } from "@/components/ui/Button";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { ToneBadge, type Tone } from "@/components/ui/PanelKit";
import { cn } from "@/lib/cn";
import { moneyUsd } from "@/lib/format/money-usd";
import { useAppFormatter } from "@/lib/i18n/use-app-formatter";
import type { AdPerformance, AdPerformanceSummary } from "@/lib/radar/ad-performance";

/**
 * Rendimiento por anuncio en Profit (Fase 4 del Radar). Lee radar_ad_daily a
 * través de /api/profit/ads: los datos se guardan cada madrugada, así que
 * abrir Profit no consulta TikTok.
 */

type SortKey = "spend" | "ctr" | "results" | "costPerResult" | "hold2s" | "hold6s" | "daysActive";

const TOP = 10;

function pct(value: number | null) {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}

/** Costo por resultado frente al promedio: más barato es bueno. */
function vsTone(vs: number): Tone {
  if (vs <= 0.85) return "ok";
  if (vs >= 1.4) return "danger";
  return "neutral";
}

type LoadState = { key: string; data: (AdPerformanceSummary & { from: string; to: string }) | null; error: boolean };

export function ProfitAdsTable({ from, to }: { from: string; to: string }) {
  const t = useTranslations("profit.ads");
  const { bcp47 } = useAppFormatter();
  const [state, setState] = useState<LoadState>({ key: "", data: null, error: false });
  const [reloadToken, setReloadToken] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortAsc, setSortAsc] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const requestKey = `${from}|${to}|${reloadToken}`;
  const loading = state.key !== requestKey;

  useEffect(() => {
    if (!from || !to) return;
    let cancelled = false;
    const key = `${from}|${to}|${reloadToken}`;
    fetch(`/api/profit/ads?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        return (await res.json()) as AdPerformanceSummary & { from: string; to: string };
      })
      .then((data) => {
        if (!cancelled) setState({ key, data, error: false });
      })
      .catch(() => {
        if (!cancelled) setState({ key, data: null, error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [from, to, reloadToken]);

  const sorted = useMemo(() => {
    const ads = state.data?.ads ?? [];
    const value = (a: AdPerformance) => a[sortKey] ?? (sortAsc ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
    return [...ads].sort((a, b) => (sortAsc ? value(a) - value(b) : value(b) - value(a)));
  }, [state.data, sortKey, sortAsc]);

  const columns: Array<{ key: SortKey; label: string; ascByDefault?: boolean }> = [
    { key: "spend", label: t("columns.spend") },
    { key: "ctr", label: t("columns.ctr") },
    { key: "results", label: t("columns.results") },
    { key: "costPerResult", label: t("columns.cpr"), ascByDefault: true },
    { key: "hold2s", label: t("columns.hold2") },
    { key: "hold6s", label: t("columns.hold6") },
    { key: "daysActive", label: t("columns.days") },
  ];

  function sortBy(key: SortKey, ascByDefault = false) {
    if (key === sortKey) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(ascByDefault);
    }
  }

  const data = state.data;
  const visible = showAll ? sorted : sorted.slice(0, TOP);
  const dateLabel = (ymd: string) =>
    new Intl.DateTimeFormat(bcp47, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${ymd}T12:00:00Z`));

  return (
    <PanelCard
      aria-busy={loading}
      title={t("title")}
      description={t("subtitle")}
      action={
        data?.totals.costPerResult != null || data?.dataThrough ? (
          <div className="flex flex-col items-end gap-1">
            {data?.totals.costPerResult != null ? (
              <ToneBadge className="num">{t("average", { amount: moneyUsd(data.totals.costPerResult) })}</ToneBadge>
            ) : null}
            {data?.dataThrough ? (
              <span className="text-xs text-ink-3">{t("dataThrough", { date: dateLabel(data.dataThrough) })}</span>
            ) : null}
          </div>
        ) : null
      }
    >
      {loading && !data ? (
        <div className="space-y-2" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-ctl bg-subtle motion-reduce:animate-none" />
          ))}
        </div>
      ) : state.error ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-[13px] text-ink-2">
          {t("error")}
          <button type="button" onClick={() => setReloadToken((n) => n + 1)} className={buttonClass("outline", "sm")}>
            <PanelIcon name="refresh" />
            {t("retry")}
          </button>
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-[13px] text-ink-2">{t("empty")}</p>
      ) : (
        <>
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="h-10 whitespace-nowrap px-2 font-medium text-ink">
                    {t("columns.ad")}
                  </th>
                  {columns.map((col) => {
                    const active = col.key === sortKey;
                    return (
                      <th
                        key={col.key}
                        scope="col"
                        aria-sort={active ? (sortAsc ? "ascending" : "descending") : "none"}
                        className="h-10 whitespace-nowrap px-2 text-right font-medium text-ink"
                        title={col.key === "hold2s" || col.key === "hold6s" ? t("holdHint") : undefined}
                      >
                        <button
                          type="button"
                          onClick={() => sortBy(col.key, col.ascByDefault)}
                          aria-label={t("sortBy", { column: col.label })}
                          className="inline-flex flex-row-reverse items-center gap-1 py-1"
                        >
                          {col.label}
                          <PanelIcon
                            name="chevron-down"
                            className={cn(
                              "size-3 transition-transform",
                              active ? "text-accent-text" : "text-ink-3 opacity-0",
                              active && sortAsc && "rotate-180",
                            )}
                          />
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {visible.map((ad) => {
                  const diff = ad.vsAverage != null ? Math.round(Math.abs(1 - ad.vsAverage) * 100) : null;
                  return (
                    <tr key={`${ad.advertiserId}:${ad.adId}`} className="border-b border-line align-top last:border-0 hover:bg-field">
                      <td className="max-w-[280px] p-2">
                        <p className="truncate font-semibold text-ink" title={ad.adName}>
                          {ad.adName}
                        </p>
                        {ad.campaignName ? (
                          <p className="truncate text-xs text-ink-3" title={ad.campaignName}>
                            {ad.campaignName}
                          </p>
                        ) : null}
                      </td>
                      <td className="num p-2 text-right font-semibold text-ink">{moneyUsd(ad.spend)}</td>
                      <td className="num p-2 text-right text-ink-2">{ad.ctr == null ? "—" : `${ad.ctr.toFixed(2)}%`}</td>
                      <td className="num p-2 text-right text-ink-2">
                        {ad.results > 0 ? ad.results.toLocaleString(bcp47) : "—"}
                      </td>
                      <td className="p-2 text-right">
                        <span className="num font-semibold text-ink">{ad.costPerResult == null ? "—" : moneyUsd(ad.costPerResult)}</span>
                        {diff != null && ad.vsAverage != null ? (
                          <span className="mt-1 flex justify-end">
                            <ToneBadge tone={vsTone(ad.vsAverage)}>
                              {diff < 5 ? t("vs.same") : ad.vsAverage < 1 ? t("vs.better", { pct: diff }) : t("vs.worse", { pct: diff })}
                            </ToneBadge>
                          </span>
                        ) : null}
                      </td>
                      <td className="num p-2 text-right text-ink-2">{pct(ad.hold2s)}</td>
                      <td className="num p-2 text-right text-ink-2">{pct(ad.hold6s)}</td>
                      <td className="num p-2 text-right text-ink-3">{ad.daysActive}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {sorted.length > TOP ? (
            <div className="mt-1 border-t border-line pt-3">
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="text-[13px] font-medium text-accent-text underline-offset-[3px] hover:underline"
              >
                {showAll ? t("showLess") : t("showAll", { count: sorted.length })}
              </button>
            </div>
          ) : null}
        </>
      )}
    </PanelCard>
  );
}
