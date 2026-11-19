"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useIsClient } from "@/hooks/useIsClient";
import { buttonClass } from "@/components/ui/Button";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { cn } from "@/lib/cn";
import {
  isLikelyImageUrl,
  isLikelyVideoUrl,
} from "@/lib/creatives/tiktok-media-preview";

function toHttps(url: string | null | undefined): string | null {
  const text = String(url ?? "").trim();
  if (!text) return null;
  if (text.startsWith("http://")) return `https://${text.slice(7)}`;
  return text;
}

export function CreativeMediaTile({
  previewUrl,
  posterUrl,
  mediaKind,
  label,
  playLabel,
  emptyLabel,
  closeLabel = "Cerrar",
  size = "card",
}: {
  previewUrl: string | null;
  posterUrl: string | null;
  mediaKind: "video" | "image" | null;
  label: string;
  playLabel: string;
  emptyLabel?: string;
  closeLabel?: string;
  size?: "card" | "row" | "poster";
}) {
  const [videoFailed, setVideoFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const mounted = useIsClient();

  useEffect(() => {
    if (!zoomOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setZoomOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [zoomOpen]);

  const rawPreview = toHttps(previewUrl);
  const rawPoster = toHttps(posterUrl);

  const playable =
    rawPreview &&
    !videoFailed &&
    !isLikelyImageUrl(rawPreview) &&
    (mediaKind === "video" || isLikelyVideoUrl(rawPreview) || mediaKind == null)
      ? rawPreview
      : null;

  const still =
    (!imageFailed && rawPoster) ||
    (!imageFailed && mediaKind === "image" ? rawPreview : null) ||
    (!imageFailed && rawPreview && isLikelyImageUrl(rawPreview)
      ? rawPreview
      : null) ||
    null;

  const canPlay = Boolean(playable);
  const canOpen = Boolean(still || playable);

  return (
    <>
      <div
        className={cn(
          "relative shrink-0 overflow-hidden border border-line bg-subtle",
          size === "poster"
            ? "h-44 w-28 rounded-box"
            : size === "card"
              ? "h-[7.25rem] w-[4.6rem] rounded-box"
              : "size-14 rounded-ctl",
        )}
      >
        {still || playable ? (
          <button
            type="button"
            className="group relative h-full w-full"
            aria-label={canPlay ? playLabel : label}
            onClick={() => {
              if (canOpen) setZoomOpen(true);
            }}
          >
            {still ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={still}
                alt=""
                className="h-full w-full object-cover"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-ink-3">
                <PanelIcon name="video" />
              </span>
            )}
            {canPlay ? (
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="grid size-8 place-items-center rounded-full bg-surface/95 text-ink shadow-card transition-transform group-hover:scale-110">
                  <svg aria-hidden viewBox="0 0 24 24" className="ml-0.5 size-3.5" fill="currentColor">
                    <path d="M8 5.5v13l10.5-6.5L8 5.5z" />
                  </svg>
                </span>
              </span>
            ) : null}
          </button>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-2 text-center text-ink-3">
            {mediaKind === "video" || size === "poster" ? <PanelIcon name="video" /> : <span aria-hidden>—</span>}
            {emptyLabel ? <span className="text-[10px] leading-3">{emptyLabel}</span> : null}
          </div>
        )}
      </div>

      {mounted &&
        zoomOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-[var(--ui-scrim)] p-4"
            role="dialog"
            aria-modal="true"
            aria-label={label}
            onClick={() => setZoomOpen(false)}
          >
            <div
              className="relative w-full max-w-md overflow-hidden rounded-card border border-line bg-surface shadow-dlg"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className={buttonClass("outline", "sm", "absolute right-3 top-3 z-10")}
                onClick={() => setZoomOpen(false)}
              >
                <PanelIcon name="x" />
                {closeLabel}
              </button>
              {playable ? (
                <video
                  key={playable}
                  src={playable}
                  poster={still ?? undefined}
                  className="max-h-[80vh] w-full bg-subtle object-contain"
                  controls
                  autoPlay
                  playsInline
                  preload="auto"
                  onError={() => setVideoFailed(true)}
                />
              ) : still ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={still}
                  alt={label}
                  className="max-h-[80vh] w-full bg-subtle object-contain"
                />
              ) : null}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
