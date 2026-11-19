import { getTranslations } from "next-intl/server";
import { PanelCard } from "@/components/ui/PageHeader";
import { EmptyState, ToneBadge, type Tone } from "@/components/ui/PanelKit";
import { CreativeMediaTile } from "@/features/creative-analyzer/components/CreativeMediaTile";
import { loadClienteVideoGallery, VIDEO_GALLERY_DAYS } from "@/lib/radar/video-gallery.server";
import type { VideoVerdict } from "@/lib/radar/video-gallery";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const int = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const VERDICT_TONE: Record<VideoVerdict, Tone> = {
  winner: "ok",
  noResults: "danger",
  tired: "warn",
  expensive: "accent",
  steady: "neutral",
};

/** Dato chico (v3 «mini»): rótulo en mayúsculas y cifra en monoespaciada. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-3">{label}</dt>
      <dd className="num truncate text-[13px] font-semibold text-ink">{value}</dd>
    </div>
  );
}

/** Videos del cliente que están corriendo en TikTok, con gasto y resultado. */
export async function TikTokVideoGallery({
  clienteId,
  organizationId,
}: {
  clienteId: string;
  organizationId?: string;
}) {
  const t = await getTranslations("creatives.videoGallery");

  let data: Awaited<ReturnType<typeof loadClienteVideoGallery>> | null = null;
  try {
    data = await loadClienteVideoGallery({ hecomClienteId: clienteId, organizationId });
  } catch (error) {
    console.warn("[creative-analyzer] video_gallery", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }

  const subtitle = data
    ? t("subtitle", {
        days: VIDEO_GALLERY_DAYS,
        videos: data.totals.videos,
        spend: usd.format(data.totals.spend),
        cpr: data.totals.costPerResult != null ? usd.format(data.totals.costPerResult) : "—",
      })
    : t("subtitleEmpty", { days: VIDEO_GALLERY_DAYS });

  return (
    <PanelCard title={t("title")} description={subtitle} ruled>
      {!data || data.videos.length === 0 ? (
        <EmptyState
          icon="video"
          title={data ? t("emptyTitle") : t("errorTitle")}
          description={data ? t("emptyBody") : t("errorBody")}
        />
      ) : (
        <>
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
                    size="card"
                  />
                  <div className="min-w-0 flex-1">
                    <ToneBadge tone={VERDICT_TONE[video.verdict]} dot>
                      {t(`verdict.${video.verdict}`)}
                    </ToneBadge>
                    <p className="mt-1.5 truncate text-sm font-semibold text-ink" title={video.name}>
                      {video.name}
                    </p>
                    <p className="text-xs text-ink-3">
                      {t("adsCount", { count: video.adsCount })}
                      {preview?.postUrl ? (
                        <>
                          {" · "}
                          <a
                            href={preview.postUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-accent-text underline-offset-[3px] hover:underline"
                          >
                            {t("openPost")}
                          </a>
                        </>
                      ) : null}
                    </p>
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                      <Stat label={t("spend")} value={usd.format(video.spend)} />
                      <Stat label={t("results")} value={int.format(video.results)} />
                      <Stat
                        label={t("cpr")}
                        value={video.costPerResult != null ? usd.format(video.costPerResult) : "—"}
                      />
                      <Stat
                        label={t("hold6s")}
                        value={video.hold6s != null ? `${Math.round(video.hold6s * 100)}%` : "—"}
                      />
                    </dl>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-ink-3">{t("footnote", { through: data.dataThrough ?? data.to })}</p>
        </>
      )}
    </PanelCard>
  );
}
