import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { PageHeader, PanelCard } from "@/components/ui/PageHeader";
import { EmptyState, KpiCard, ToneBadge, type Tone } from "@/components/ui/PanelKit";
import { CreativeMediaTile } from "@/features/creative-analyzer/components/CreativeMediaTile";
import { CreativeVideosFilters } from "@/features/creative-analyzer/components/CreativeVideosFilters.client";
import type { CreativeVideosRange } from "@/features/creative-analyzer/lib/videos-range";
import { loadClienteVideoGallery } from "@/lib/radar/video-gallery.server";
import type { VideoVerdict } from "@/lib/radar/video-gallery";
import { getAppFormatter } from "@/lib/i18n/get-app-formatter";

/** Videos que se muestran como máximo (los totales cuentan todos). */
const VIDEOS_SHOWN = 24;

const VERDICT_TONE: Record<VideoVerdict, Tone> = {
  winner: "ok",
  noResults: "danger",
  tired: "warn",
  expensive: "accent",
  steady: "neutral",
};

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const int = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** Dato chico: rótulo en mayúsculas y cifra en monoespaciada. */
function Stat({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-3">{label}</dt>
      <dd className={strong ? "num truncate text-[15px] font-semibold text-ink" : "num truncate text-[13px] font-semibold text-ink"}>
        {value}
      </dd>
    </div>
  );
}

export async function CreativeVideosView({
  clienteId,
  clienteName,
  organizationId,
  range,
}: {
  clienteId: string;
  clienteName: string;
  organizationId?: string;
  range: CreativeVideosRange;
}) {
  const t = await getTranslations("creatives.videos");
  return (
    <>
      <PageHeader title={t("title")} lede={t("lede", { cliente: clienteName })} />
      <CreativeVideosFilters range={range} />
      <Suspense key={`${range.from}:${range.to}:${range.sort}`} fallback={<VideosSkeleton />}>
        <VideosResults clienteId={clienteId} organizationId={organizationId} range={range} />
      </Suspense>
    </>
  );
}

function VideosSkeleton() {
  return (
    <div className="animate-pulse" aria-busy="true">
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 rounded-box bg-subtle" />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-44 rounded-box bg-subtle" />
        ))}
      </div>
    </div>
  );
}

async function VideosResults({
  clienteId,
  organizationId,
  range,
}: {
  clienteId: string;
  organizationId?: string;
  range: CreativeVideosRange;
}) {
  const t = await getTranslations("creatives.videos");
  const { bcp47 } = await getAppFormatter();
  const dayFmt = new Intl.DateTimeFormat(bcp47, { day: "numeric", month: "short", timeZone: "UTC" });
  const day = (ymd: string) => dayFmt.format(new Date(`${ymd}T12:00:00Z`));

  let data: Awaited<ReturnType<typeof loadClienteVideoGallery>> | null = null;
  try {
    data = await loadClienteVideoGallery({
      hecomClienteId: clienteId,
      organizationId,
      from: range.from,
      to: range.to,
      sort: range.sort,
      limit: VIDEOS_SHOWN,
    });
  } catch (error) {
    console.warn("[creative-analyzer] videos", { error: error instanceof Error ? error.message : "unknown" });
  }

  if (!data) {
    return (
      <PanelCard>
        <EmptyState icon="video" title={t("errorTitle")} description={t("errorBody")} />
      </PanelCard>
    );
  }

  const { totals } = data;
  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t("kpi.videos")} value={int.format(totals.videos)} detail={t("kpi.videosDetail")} />
        <KpiCard label={t("kpi.spend")} value={usd.format(totals.spend)} detail={t("kpi.spendDetail")} />
        <KpiCard label={t("kpi.results")} value={int.format(totals.results)} detail={t("kpi.resultsDetail")} />
        <KpiCard
          label={t("kpi.cpr")}
          value={totals.costPerResult != null ? usd.format(totals.costPerResult) : "—"}
          detail={t("kpi.cprDetail")}
        />
      </div>

      <PanelCard
        title={range.sort === "recent" ? t("listRecent") : t("listSpend")}
        description={t("listMeta", {
          shown: data.videos.length,
          total: totals.videos,
          from: day(data.from),
          to: day(data.to),
        })}
        ruled
      >
        {data.videos.length === 0 ? (
          <EmptyState icon="video" title={t("emptyTitle")} description={t("emptyBody")} />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.videos.map((video) => {
              const preview = data.previews[video.videoId ?? video.key];
              return (
                <li key={video.key} className="flex gap-3 rounded-box border border-line bg-surface p-3">
                  <CreativeMediaTile
                    previewUrl={preview?.previewUrl ?? null}
                    posterUrl={preview?.posterUrl ?? null}
                    mediaKind={video.videoId || preview?.previewUrl ? "video" : preview?.posterUrl ? "image" : null}
                    label={video.name}
                    playLabel={t("play")}
                    closeLabel={t("close")}
                    size="poster"
                  />
                  <div className="min-w-0 flex-1">
                    <ToneBadge tone={VERDICT_TONE[video.verdict]} dot>
                      {t(`verdict.${video.verdict}`)}
                    </ToneBadge>
                    <p className="mt-1.5 truncate text-sm font-semibold text-ink" title={video.name}>
                      {video.name}
                    </p>
                    <p className="text-xs text-ink-3">
                      {video.firstDate === video.lastDate
                        ? t("activeOn", { date: day(video.firstDate) })
                        : t("activeRange", { from: day(video.firstDate), to: day(video.lastDate) })}
                      {" · "}
                      {t("adsCount", { count: video.adsCount })}
                    </p>
                    {preview?.postUrl ? (
                      <a
                        href={preview.postUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-accent-text underline-offset-[3px] hover:underline"
                      >
                        {t("openPost")}
                      </a>
                    ) : null}
                    <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2">
                      <Stat label={t("spend")} value={usd.format(video.spend)} strong />
                      <Stat label={t("results")} value={int.format(video.results)} strong />
                      <Stat label={t("cpr")} value={video.costPerResult != null ? usd.format(video.costPerResult) : "—"} />
                      <Stat label={t("ctr")} value={video.ctr != null ? `${video.ctr.toFixed(2)}%` : "—"} />
                      <Stat label={t("impressions")} value={int.format(video.impressions)} />
                      <Stat label={t("clicks")} value={int.format(video.clicks)} />
                      <Stat label={t("hold6s")} value={video.hold6s != null ? `${Math.round(video.hold6s * 100)}%` : "—"} />
                    </dl>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-xs text-ink-3">{t("footnote", { through: data.dataThrough ? day(data.dataThrough) : "—" })}</p>
      </PanelCard>
    </>
  );
}
