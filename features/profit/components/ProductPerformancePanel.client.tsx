"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { PanelCard } from "@/components/ui/PageHeader";
import { ToneBadge, type Tone } from "@/components/ui/PanelKit";
import { cn } from "@/lib/cn";
import { moneyUsd } from "@/lib/format/money-usd";
import {
  buildProductPerformance,
  MIN_SPEND_FOR_VERDICT,
  type ProductCampaignInput,
  type ProductVerdict,
} from "@/lib/realprofit/product-performance";

/* Tono de cada veredicto: la insignia y la barra de gasto usan el mismo. */
const VERDICT_TONE: Record<ProductVerdict, Tone> = {
  scale: "ok",
  keep: "accent",
  review: "warn",
  stop: "danger",
  low_data: "neutral",
  no_data: "neutral",
};

const TOP = 8;

export function ProductPerformancePanel({ campaigns }: { campaigns: ProductCampaignInput[] }) {
  const t = useTranslations("profit.products");
  const [showAll, setShowAll] = useState(false);
  const { rows, averageCostPerResult, hasConversions } = useMemo(
    () => buildProductPerformance(campaigns),
    [campaigns],
  );
  if (rows.length === 0) return null;

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.verdict] = (acc[r.verdict] ?? 0) + 1;
    return acc;
  }, {});
  const visible = showAll ? rows : rows.slice(0, TOP);

  const reason = (r: (typeof rows)[number]) => {
    if (r.verdict === "no_data") return t("reason.no_data");
    if (r.verdict === "low_data") return t("reason.low_data", { min: moneyUsd(MIN_SPEND_FOR_VERDICT) });
    if (r.verdict === "stop") return t("reason.stop", { spend: moneyUsd(r.spend) });
    const pct = r.vsAverage != null ? Math.round(Math.abs(1 - r.vsAverage) * 100) : 0;
    if (r.verdict === "scale") return t("reason.scale", { pct });
    if (r.verdict === "review") return t("reason.review", { pct });
    return t("reason.keep");
  };

  return (
    <PanelCard
      title={t("title")}
      description={t("subtitle")}
      action={
        hasConversions && averageCostPerResult != null ? (
          <ToneBadge className="num">{t("average", { amount: moneyUsd(averageCostPerResult) })}</ToneBadge>
        ) : null
      }
    >
      {hasConversions ? (
        <div className="flex flex-wrap gap-1.5 pb-3">
          {(["scale", "keep", "review", "stop"] as const).map((v) =>
            counts[v] ? (
              <ToneBadge key={v} tone={VERDICT_TONE[v]} dot>
                {t(`verdict.${v}`)} · <span className="num">{counts[v]}</span>
              </ToneBadge>
            ) : null,
          )}
        </div>
      ) : (
        <p className="mb-3 rounded-box bg-field px-3 py-2 text-xs text-ink-2">{t("noConversions")}</p>
      )}

      <ul>
        {visible.map((r) => {
          const tone = VERDICT_TONE[r.verdict];
          return (
            <li key={r.product} className="border-t border-line py-3">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-0 max-w-full truncate text-sm font-semibold text-ink" title={r.campaigns.join("\n")}>
                      {r.product}
                    </p>
                    <ToneBadge tone={tone} dot>
                      {t(`verdict.${r.verdict}`)}
                    </ToneBadge>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-3">
                    {t("campaignsCount", { count: r.campaigns.length })} · {reason(r)}
                  </p>
                </div>
                <dl className="grid shrink-0 grid-cols-3 gap-x-5 text-right">
                  <div>
                    <dt className="text-xs text-ink-3">{t("spend")}</dt>
                    <dd className="num text-[13px] font-semibold text-ink">{moneyUsd(r.spend)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-3">{t("results")}</dt>
                    <dd className="num text-[13px] font-semibold text-ink">{r.conversions ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-3">{t("costPerResult")}</dt>
                    <dd className="num text-[13px] font-semibold text-ink">
                      {r.costPerResult != null ? moneyUsd(r.costPerResult) : "—"}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-subtle" aria-hidden>
                <div
                  className={cn("h-full rounded-full bg-[var(--t-solid)]", `tone-${tone}`)}
                  style={{ width: `${Math.max(2, r.spendShare * 100)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <p className="text-xs text-ink-3">{t("footnote")}</p>
        {rows.length > TOP ? (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-[13px] font-medium text-accent-text underline-offset-[3px] hover:underline"
          >
            {showAll ? t("showLess") : t("showAll", { count: rows.length })}
          </button>
        ) : null}
      </div>
    </PanelCard>
  );
}
