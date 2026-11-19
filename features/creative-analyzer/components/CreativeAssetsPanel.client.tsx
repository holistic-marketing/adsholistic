"use client";

import { useTranslations } from "next-intl";
import type { CreativeAssetListItem } from "@/lib/creatives/types";
import { PanelCard } from "@/components/ui/PageHeader";
import { EmptyState, Meter, ToneBadge, type Tone } from "@/components/ui/PanelKit";
import { CreativeMediaTile } from "@/features/creative-analyzer/components/CreativeMediaTile";

/** Puntaje en anillo: pista gris y avance naranja. */
function ScoreRing({ score, scoreLabel }: { score: number; scoreLabel: string }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score)) / 100;
  const offset = c * (1 - pct);
  return (
    <div className="relative size-16 shrink-0">
      <svg viewBox="0 0 56 56" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="28" cy="28" r={r} fill="none" stroke="var(--ui-muted)" strokeWidth="5" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke="var(--ui-accent)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="num text-[15px] font-semibold leading-none text-ink">{score}</span>
        <span className="text-[9px] font-medium uppercase tracking-[0.06em] text-ink-3">{scoreLabel}</span>
      </div>
    </div>
  );
}

export function CreativeAssetsPanel({ assets }: { assets: CreativeAssetListItem[] }) {
  const t = useTranslations("creatives.assets");

  function jobLabel(status: string | null) {
    if (!status) return t("jobNone");
    if (status === "queued" || status === "pending") return t("jobQueued");
    if (status === "processing") return t("jobProcessing");
    if (status === "completed") return t("jobCompleted");
    if (status === "failed") return t("jobFailed");
    return status;
  }

  function verdictFromScore(score: number, policyRisks: string[]): { label: string; tone: Tone } {
    if (policyRisks.length > 0 && score < 70) return { label: t("verdictPolicy"), tone: "warn" };
    if (score >= 80) return { label: t("verdictReady"), tone: "ok" };
    if (score >= 60) return { label: t("verdictImprove"), tone: "accent" };
    return { label: t("verdictRedo"), tone: "danger" };
  }

  return (
    <PanelCard title={t("title")} description={t("subtitle")} ruled>
      {assets.length === 0 ? (
        <EmptyState icon="video" title={t("emptyTitle")} description={t("emptyBody")} />
      ) : (
        <ul className="max-h-[32rem] divide-y divide-line overflow-y-auto">
          {assets.map((asset) => {
            const insight = asset.insight;
            const verdict = insight ? verdictFromScore(insight.overallScore, insight.policyRisks) : null;
            return (
              <li key={asset.id} className="flex gap-3.5 py-4 first:pt-1 last:pb-1">
                {asset.previewUrl || asset.posterUrl ? (
                  <CreativeMediaTile
                    previewUrl={asset.previewUrl}
                    posterUrl={asset.posterUrl}
                    mediaKind={asset.mediaKind}
                    label={asset.name}
                    playLabel={t("playVideo")}
                  />
                ) : null}
                {insight ? (
                  <ScoreRing score={insight.overallScore} scoreLabel={t("score")} />
                ) : (
                  <div aria-hidden className="grid size-16 shrink-0 place-items-center rounded-full bg-subtle text-xs font-semibold text-ink-3">
                    …
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{asset.name}</p>
                      <p className="mt-0.5 text-xs text-ink-3">
                        {[asset.assetType, asset.accountName, jobLabel(asset.jobStatus)].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {verdict ? <ToneBadge tone={verdict.tone}>{verdict.label}</ToneBadge> : null}
                  </div>

                  {insight ? (
                    <>
                      <p className="mt-2.5 text-[13px] leading-5 text-ink">{insight.summary}</p>
                      <div className="grid gap-x-4 sm:grid-cols-3">
                        <Meter label={t("clarity")} value={insight.clarityScore / 100} display={insight.clarityScore} />
                        <Meter label={t("brand")} value={insight.brandScore / 100} display={insight.brandScore} />
                        <Meter label={t("policy")} value={insight.complianceScore / 100} display={insight.complianceScore} />
                      </div>
                      {insight.hooks.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {insight.hooks.slice(0, 4).map((hook) => (
                            <ToneBadge key={hook}>{hook}</ToneBadge>
                          ))}
                        </div>
                      ) : null}
                      {insight.whyItMayPerform ? (
                        <p className="mt-2.5 text-xs leading-5 text-ink-2">
                          <span className="font-semibold text-ink">{t("whyItMayPerform")}</span>
                          {insight.whyItMayPerform}
                        </p>
                      ) : null}
                      {insight.policyRisks.length > 0 ? (
                        <p className="mt-2 text-xs leading-5 text-warn-fg">
                          <span className="font-semibold">{t("policyRisk")}</span>
                          {insight.policyRisks.join(" · ")}
                        </p>
                      ) : null}
                    </>
                  ) : asset.jobStatus === "failed" ? (
                    <p className="mt-2 text-xs text-danger-fg">{t("analysisFailed")}</p>
                  ) : (
                    <p className="mt-2 text-xs text-ink-3">{t("analyzing")}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </PanelCard>
  );
}
