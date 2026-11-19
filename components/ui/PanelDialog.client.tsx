"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { PanelIcon } from "./PanelIcon";

/* Diálogo del panel sobre <dialog> nativo: el navegador atrapa el foco,
   cierra con Esc y pinta el fondo. Al cerrar, el foco vuelve a quien lo abrió. */

export function PanelDialog({
  open,
  onClose,
  title,
  description,
  size = "md",
  closeLabel,
  footer,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: "md" | "wide" | "drawer" | "command";
  closeLabel: string;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    function handleClose() {
      onClose();
      const back = opener.current;
      if (back?.isConnected) back.focus({ preventScroll: true });
    }
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === ref.current) ref.current?.close();
      }}
      className={cn(
        "m-auto max-h-[calc(100dvh-32px)] overflow-hidden rounded-card border border-line p-0 text-ink shadow-dlg backdrop:bg-[var(--ui-scrim)]",
        size === "command" ? "mt-[12vh] w-[min(560px,calc(100vw-24px))] bg-surface" : "bg-canvas",
        size === "md" && "w-[min(512px,calc(100vw-24px))]",
        size === "wide" && "w-[min(640px,calc(100vw-24px))]",
        size === "drawer" && "mr-2 h-[calc(100dvh-16px)] max-h-none w-[min(480px,calc(100vw-16px))]",
        className,
      )}
    >
      {open ? (
        size === "command" ? (
          <>
            <h2 id={titleId} className="sr-only">
              {title}
            </h2>
            {children}
          </>
        ) : (
          <div className="grid max-h-[calc(100dvh-34px)] grid-rows-[auto_minmax(0,1fr)_auto]">
            <header className="flex items-start justify-between gap-3 pb-1 pl-6 pr-4 pt-6">
              <div className="min-w-0">
                <h2 id={titleId} className="text-lg font-semibold leading-6 tracking-[-0.015em] [overflow-wrap:anywhere]">
                  {title}
                </h2>
                {description ? <p className="mt-0.5 text-sm text-ink-2">{description}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => ref.current?.close()}
                aria-label={closeLabel}
                className="-mt-2 inline-grid size-8 shrink-0 place-items-center rounded-ctl text-ink hover:bg-hover"
              >
                <PanelIcon name="x" />
              </button>
            </header>
            <div className="overflow-y-auto px-6 pb-6 pt-4">{children}</div>
            {footer ? <footer className="flex items-center justify-end gap-2 px-6 pb-6">{footer}</footer> : <span />}
          </div>
        )
      ) : null}
    </dialog>
  );
}
