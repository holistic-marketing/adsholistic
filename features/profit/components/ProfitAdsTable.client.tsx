"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
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

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-1";

function pct(value: number | null) {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}

function vsTone(vs: number | null): string {
  if (vs == null) return "";
  if (vs <= 0.85) return "bg-subtle text-ok-fg";
  if (vs >= 1.4) return "bg-field text-danger-fg";
  return "bg-subtle text-ink-2";
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
    <section className="overflow-hidden rounded-card bg-surface ring-1 ring-line" aria-busy={loading}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
        <div className="min-w-0 max-w-[62ch]">
          <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-ink">{t("title")}</h2>
          <p className="mt-0.5 text-[12px] leading-[1.5] text-ink-2">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data?.totals.costPerResult != null ? (
            <span className="rounded-full bg-subtle px-2.5 py-1 text-[11px] font-medium text-ink-2">
              {t("average", { amount: moneyUsd(data.totals.costPerResult) })}
            </span>
          ) : null}
          {data?.dataThrough ? (
            <span className="text-[11px] font-medium text-ink-3">{t("dataThrough", { date: dateLabel(data.dataThrough) })}</span>
          ) : null}
        </div>
      </div>

      {loading && !data ? (
        <div className="space-y-2 px-4 pb-5 sm:px-5" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-9 animate-pulse rounded-lg bg-subtle motion-reduce:animate-none" />
          ))}
        </div>
      ) : state.error ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 px-4 pb-5 text-[13px] text-ink-2 sm:px-5">
          {t("error")}
          <button
            type="button"
            onClick={() => setReloadToken((n) => n + 1)}
            className={`rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink hover:border-line-strong ${focusRing}`}
          >
            {t("retry")}
          </button>
        </div>
      ) : sorted.length === 0 ? (
        <p className="px-4 pb-5 text-[13px] text-ink-2 sm:px-5">{t("empty")}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-y border-line bg-field text-[11.5px] text-ink-3">
                  <th scope="col" className="py-2.5 pl-4 pr-3 font-semibold sm:pl-5">
                    {t("columns.ad")}
                  </th>
                  {columns.map((col) => {
                    const active = col.key === sortKey;
                    return (
                      <th
                        key={col.key}
                        scope="col"
                        aria-sort={active ? (sortAsc ? "ascending" : "descending") : "none"}
                        className="py-2.5 pr-3 text-right font-semibold last:pr-4 sm:last:pr-5"
                        title={col.key === "hold2s" || col.key === "hold6s" ? t("holdHint") : undefined}
                      >
                        <button
                          type="button"
                          onClick={() => sortBy(col.key, col.ascByDefault)}
                          aria-label={t("sortBy", { column: col.label })}
                          className={`inline-flex items-center gap-1 rounded ${active ? "text-ink" : "hover:text-ink"} ${focusRing}`}
                        >
                          {col.label}
                          <svg
                            viewBox="0 0 24 24"
                            aria-hidden
                            className={`h-3 w-3 transition-transform duration-200 ${active ? "opacity-100" : "opacity-0"} ${sortAsc ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2.4}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="m6 9 6 6 6-6" />
                          </svg>
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
                      <td className="max-w-[280px] py-2.5 pl-4 pr-3 sm:pl-5">
                        <p className="truncate font-semibold text-ink" title={ad.adName}>
                          {ad.adName}
                        </p>
                        {ad.campaignName ? (
                          <p className="truncate text-[11.5px] text-ink-3" title={ad.campaignName}>
                            {ad.campaignName}
                          </p>
                        ) : null}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-semibold tabular-nums text-ink">{moneyUsd(ad.spend)}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-ink-2">{ad.ctr == null ? "—" : `${ad.ctr.toFixed(2)}%`}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-ink-2">
                        {ad.results > 0 ? ad.results.toLocaleString(bcp47) : "—"}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        <span className="font-semibold text-ink">{ad.costPerResult == null ? "—" : moneyUsd(ad.costPerResult)}</span>
                        {diff != null ? (
                          <span className={`mt-1 block w-fit justify-self-end rounded-full px-2 py-0.5 text-[10.5px] font-medium ${vsTone(ad.vsAverage)} ml-auto`}>
                            {diff < 5 ? t("vs.same") : ad.vsAverage! < 1 ? t("vs.better", { pct: diff }) : t("vs.worse", { pct: diff })}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-ink-2">{pct(ad.hold2s)}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-ink-2">{pct(ad.hold6s)}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-ink-3 sm:pr-5">{ad.daysActive}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {sorted.length > TOP ? (
            <div className="border-t border-line px-4 py-2.5 sm:px-5">
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className={`rounded text-[12.5px] font-semibold text-ink-2 hover:text-ink ${focusRing}`}
              >
                {showAll ? t("showLess") : t("showAll", { count: sorted.length })}
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
