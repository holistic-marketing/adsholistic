"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";

import { useTranslations } from "next-intl";
import { buttonClass } from "@/components/ui/Button";
import { PanelIcon } from "@/components/ui/PanelIcon";
import type { EducationLessonView } from "../lib/types";

const noopSubscribe = () => () => {};

export function EducationPlayerDialog({
  lesson,
  canManage,
  onClose,
}: {
  lesson: EducationLessonView | null;
  canManage: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("education");
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  // iPhone Safari no permite fullscreen en un <div>: el botón no haría nada.
  const canFullscreen = useSyncExternalStore(
    noopSubscribe,
    () => Boolean(document.fullscreenEnabled),
    () => false,
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (lesson && !dialog.open) dialog.showModal();
    if (!lesson && dialog.open) dialog.close();
  }, [lesson]);

  useEffect(() => {
    function onChange() {
      setFullscreen(document.fullscreenElement === playerRef.current);
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  async function toggleFullscreen() {
    const player = playerRef.current;
    if (!player) return;
    try {
      if (document.fullscreenElement === player) {
        await document.exitFullscreen();
        return;
      }
      await player.requestFullscreen();
    } catch {
      // El navegador rechazó el cambio; el reproductor sigue igual.
    }
  }

  const ready = Boolean(lesson?.videoUrl || lesson?.embedUrl);
  // Loom y Drive no aceptan portada propia: se muestra encima hasta que le dan play.
  const [startedSlug, setStartedSlug] = useState<string | null>(null);
  // Sin portada propia se usa la imagen de referencia, como en el MP4.
  const coverUrl = lesson?.videoPosterUrl ?? lesson?.posterUrl ?? null;
  const showCover = Boolean(coverUrl) && !lesson?.videoUrl && startedSlug !== lesson?.slug;
  // El MP4 puede ser vertical o cuadrado; Loom y Drive no dicen su proporción y quedan en 16:9.
  const [measured, setMeasured] = useState<{ src: string; ratio: number } | null>(null);
  const ratio =
    lesson?.videoUrl && measured?.src === lesson.videoUrl ? measured.ratio : 16 / 9;

  return (
    <dialog
      ref={dialogRef}
      className="education-dialog"
      style={{ "--education-ratio": String(ratio) } as CSSProperties}
      aria-labelledby={titleId}
      onClose={() => {
        setStartedSlug(null);
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      {lesson ? (
        <div className="overflow-hidden rounded-card border border-line bg-surface text-ink shadow-dlg">
          <div className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <p className="eyebrow">
                {t("lessonNumber", { number: lesson.number })}
              </p>
              <h2 id={titleId} className="truncate text-base font-semibold tracking-[-0.01em] text-ink">
                {lesson.title}
              </h2>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {ready && !lesson.videoUrl && canFullscreen ? (
                <button
                  type="button"
                  onClick={() => void toggleFullscreen()}
                  className={buttonClass("outline", "sm")}
                >
                  {fullscreen ? t("exitFullscreen") : t("fullscreen")}
                </button>
              ) : null}
              <button type="button" onClick={onClose} className={buttonClass("ghost", "sm")}>
                <PanelIcon name="x" />
                {t("close")}
              </button>
            </div>
          </div>

          {ready ? (
            <div ref={playerRef} className="education-player flex flex-col bg-black">
              <div className="education-player-frame relative bg-black">
                {lesson.videoUrl ? (
                  <video
                    key={lesson.videoUrl}
                    src={lesson.videoUrl}
                    poster={lesson.videoPosterUrl ?? lesson.posterUrl ?? undefined}
                    controls
                    playsInline
                    onLoadedMetadata={(event) => {
                      const { videoWidth, videoHeight, currentSrc } = event.currentTarget;
                      if (!videoWidth || !videoHeight) return;
                      setMeasured({ src: lesson.videoUrl ?? currentSrc, ratio: videoWidth / videoHeight });
                    }}
                    className="h-full w-full"
                  />
                ) : showCover ? (
                  <button
                    type="button"
                    onClick={() => setStartedSlug(lesson.slug)}
                    aria-label={t("openLesson", { title: lesson.title })}
                    className="group relative block h-full w-full"
                  >
                    <img
                      src={coverUrl ?? undefined}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute inset-0 grid place-items-center">
                      <span className="grid size-14 place-items-center rounded-box bg-accent-btn text-on-accent shadow-pop group-hover:bg-accent-btn-hover">
                        <svg viewBox="0 0 24 24" className="ml-0.5 size-6" fill="currentColor" aria-hidden>
                          <path d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86a1 1 0 00-1.5.86z" />
                        </svg>
                      </span>
                    </span>
                  </button>
                ) : (
                  <iframe
                    key={lesson.slug}
                    src={coverUrl ? withAutoplay(lesson.embedUrl) : lesson.embedUrl ?? undefined}
                    title={lesson.title}
                    className="h-full w-full"
                    allow="fullscreen; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="mx-4 mb-4 grid justify-items-center gap-1 rounded-box border border-line bg-field px-5 py-8 text-center sm:mx-5">
              <span aria-hidden className="mb-2 grid size-10 place-items-center rounded-box bg-subtle text-ink">
                <PanelIcon name="video" className="size-[18px]" />
              </span>
              <p className="text-lg font-semibold tracking-[-0.015em] text-ink">
                {t("unavailableTitle")}
              </p>
              <p className="max-w-md text-ink-2">
                {t("unavailableBody")}
              </p>
              {canManage ? (
                <p className="mt-1 max-w-md text-[13px] font-medium text-accent-text">
                  {t("unavailableManage")}
                </p>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </dialog>
  );
}

/** Tras pulsar la portada, Loom arranca solo; Drive ignora el parámetro. */
function withAutoplay(url: string | null): string | undefined {
  if (!url) return undefined;
  if (!url.startsWith("https://www.loom.com/embed/")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}autoplay=1`;
}
