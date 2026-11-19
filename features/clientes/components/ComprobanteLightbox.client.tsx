"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { buttonClass } from "@/components/ui/Button";
import { PanelIcon } from "@/components/ui/PanelIcon";

interface ComprobanteLightboxProps {
  open: boolean;
  url: string;
  title: string;
  kind: "image" | "pdf" | "unknown";
  onClose: () => void;
}

const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.25;

const ZOOM_BTN =
  "inline-grid size-7 place-items-center rounded-ctl text-ink-2 hover:bg-surface hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";

export function ComprobanteLightbox({ open, ...props }: ComprobanteLightboxProps) {
  if (!open || typeof document === "undefined") return null;
  // Solo montado mientras está abierto: el zoom vuelve a 1 al cerrar (desmontaje).
  return <ComprobanteLightboxBody {...props} />;
}

function ComprobanteLightboxBody({
  url,
  title,
  kind,
  onClose,
}: Omit<ComprobanteLightboxProps, "open">) {
  const [zoom, setZoom] = useState(1);

  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) * 100) / 100));
  }, []);

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(ZOOM_MAX, Math.round((z + ZOOM_STEP) * 100) / 100));
  }, []);

  const zoomReset = useCallback(() => setZoom(1), []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        zoomIn();
      }
      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        zoomOut();
      }
      if (event.key === "0") {
        event.preventDefault();
        zoomReset();
      }
    }
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, zoomIn, zoomOut, zoomReset]);

  const isImage = kind === "image" || kind === "unknown";

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Vista ampliada: ${title}`}
    >
      <button
        type="button"
        className="absolute inset-0 bg-[var(--ui-scrim)]"
        aria-label="Cerrar vista ampliada"
        onClick={onClose}
      />

      {/* Diálogo v3: superficie clara, borde fino y la imagen sobre el lienzo. */}
      <div className="relative flex max-h-[min(94vh,calc(100dvh-1.5rem))] w-full max-w-5xl flex-col overflow-hidden rounded-card border border-line bg-surface text-ink shadow-dlg">
        <div className="flex items-center justify-between gap-3 border-b border-line py-2.5 pl-4 pr-2.5 sm:pl-5">
          <p className="min-w-0 truncate text-sm font-semibold">{title}</p>
          <div className="flex shrink-0 items-center gap-1.5">
            {isImage ? (
              <div className="flex items-center gap-0.5 rounded-box bg-subtle p-[3px]">
                <button
                  type="button"
                  onClick={zoomOut}
                  disabled={zoom <= ZOOM_MIN}
                  className={ZOOM_BTN}
                  aria-label="Alejar"
                  title="Alejar (−)"
                >
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" aria-hidden>
                    <path d="M5 12h14" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={zoomReset}
                  className="h-7 min-w-[3rem] rounded-ctl px-1 text-center font-mono text-xs font-medium text-ink-2 hover:bg-surface hover:text-ink"
                  title="Restablecer zoom (0)"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={zoomIn}
                  disabled={zoom >= ZOOM_MAX}
                  className={ZOOM_BTN}
                  aria-label="Acercar"
                  title="Acercar (+)"
                >
                  <PanelIcon name="plus" />
                </button>
              </div>
            ) : null}
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass("ghost", "sm", "hidden sm:inline-flex")}
            >
              <PanelIcon name="external" />
              Abrir archivo
            </a>
            <button
              type="button"
              onClick={onClose}
              className="inline-grid size-8 place-items-center rounded-ctl text-ink hover:bg-hover"
              aria-label="Cerrar"
            >
              <PanelIcon name="x" />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-canvas p-3 sm:p-5">
          {kind === "pdf" ? (
            <iframe
              src={url}
              title={title}
              className="h-[min(78vh,760px)] w-full rounded-box border border-line bg-surface"
            />
          ) : (
            <div className="flex min-h-full w-full items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={title}
                onDoubleClick={() =>
                  setZoom((z) => (z >= 1.5 ? 1 : Math.min(ZOOM_MAX, z + 0.5)))
                }
                style={{ transform: `scale(${zoom})` }}
                className="max-h-[min(78vh,760px)] max-w-full origin-center rounded-box object-contain shadow-card transition-transform duration-200 ease-out motion-reduce:transition-none"
              />
            </div>
          )}
        </div>

        {isImage ? (
          <p className="border-t border-line px-4 py-2 text-center text-[11px] text-ink-3">
            Clic fuera o Esc para cerrar · + / − para zoom · doble clic acerca
          </p>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
