"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { cn } from "@/lib/cn";
import type { RoundVideo } from "@/lib/radar/round-builder.server";
import { TikTokEmbed } from "./TikTokEmbed.client";

export type CardReaction = "like" | "dislike" | null;

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4 translate-x-px" fill="currentColor">
      <path d="M8 5.6v12.8a.9.9 0 0 0 1.37.77l10.2-6.4a.9.9 0 0 0 0-1.54L9.37 4.83A.9.9 0 0 0 8 5.6Z" />
    </svg>
  );
}

/** Botón de reacción o elección (v3 «btn» con aria-pressed). */
function choiceClass(on: boolean, offTone: "ink" | "muted" = "ink") {
  return cn(
    "flex h-8 items-center justify-center gap-1.5 rounded-ctl border text-[13px] font-medium shadow-ctl",
    on
      ? offTone === "muted"
        ? "border-line bg-subtle text-ink-2"
        : "border-accent-line bg-accent-soft text-accent-text"
      : cn("border-line bg-field hover:border-line-strong hover:bg-hover", offTone === "muted" ? "text-ink-2" : "text-ink"),
  );
}

/**
 * Un video de la ronda. Muestra la miniatura (oEmbed) y carga el reproductor
 * oficial solo al tocarla. En la ronda 1 se reacciona con "me gusta" o "no es
 * para mí"; en la ronda 2 se elige como referencia.
 */
export function RadarVideoCard({
  video,
  mode,
  reaction,
  picked,
  onReact,
  onTogglePick,
  onDead,
}: {
  video: RoundVideo;
  mode: "react" | "pick";
  reaction?: CardReaction;
  picked?: boolean;
  onReact?: (reaction: Exclude<CardReaction, null>) => void;
  onTogglePick?: () => void;
  onDead: () => void;
}) {
  const t = useTranslations("profit.radar.card");
  const [playing, setPlaying] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const author = video.authorName ?? (video.authorHandle ? `@${video.authorHandle}` : t("unknownAuthor"));
  const dimmed = mode === "react" && reaction === "dislike";

  return (
    <article className="flex min-w-0 flex-col gap-2">
      <div
        className={cn(
          "relative aspect-[9/16] overflow-hidden rounded-box border border-line bg-subtle transition-[opacity,filter] duration-300",
          dimmed && "opacity-45 grayscale",
          mode === "pick" && picked && "ring-2 ring-accent ring-offset-2 ring-offset-surface",
        )}
      >
        {playing ? (
          <TikTokEmbed videoId={video.videoId} title={t("play", { author })} onDead={onDead} />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group absolute inset-0 block h-full w-full text-left"
            aria-label={t("play", { author })}
          >
            {video.thumbnailUrl && !thumbFailed ? (
              // Miniatura de TikTok tal cual (CSP img-src ya permite *.tiktokcdn.com).
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={video.thumbnailUrl}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={() => setThumbFailed(true)}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              />
            ) : null}
            {/* Botón de reproducir (v3 «vid .play»): cuadro naranja abajo a la derecha. */}
            <span className="absolute bottom-3 right-3 grid size-8 place-items-center rounded-ctl bg-accent-btn text-on-accent shadow-card transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100">
              <PlayIcon />
            </span>
          </button>
        )}
      </div>

      {/* Autor y texto del video, debajo de la miniatura. */}
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-ink">{author}</p>
        {video.caption ? <p className="line-clamp-2 text-xs leading-[1.4] text-ink-2">{video.caption}</p> : null}
      </div>

      {mode === "react" ? (
        <div className="grid grid-cols-2 gap-1.5" role="group" aria-label={author}>
          <button
            type="button"
            aria-pressed={reaction === "like"}
            onClick={() => onReact?.("like")}
            className={choiceClass(reaction === "like")}
          >
            {t("like")}
          </button>
          <button
            type="button"
            aria-pressed={reaction === "dislike"}
            onClick={() => onReact?.("dislike")}
            className={choiceClass(reaction === "dislike", "muted")}
          >
            {t("dislike")}
          </button>
        </div>
      ) : (
        <button type="button" aria-pressed={Boolean(picked)} onClick={onTogglePick} className={choiceClass(Boolean(picked))}>
          {picked ? <PanelIcon name="check" /> : null}
          {picked ? t("picked") : t("pick")}
        </button>
      )}

      <a
        href={video.shareUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 self-start text-xs font-medium text-ink-3 underline-offset-[3px] hover:text-ink hover:underline"
      >
        {t("openTikTok")}
        <PanelIcon name="external" className="size-3.5" />
      </a>
    </article>
  );
}
