"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { PanelIcon, type PanelIconName } from "./PanelIcon";

/* Capa flotante anclada a un botón (menús, notificaciones, creación rápida).
   Se cierra con Esc, al hacer clic fuera, al cambiar el tamaño de la ventana
   o al sacar el foco; al cerrar con Esc devuelve el foco al botón. */

export function usePopover<T extends HTMLElement = HTMLButtonElement>() {
  const anchorRef = useRef<T | null>(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((value) => !value), []);
  return { anchorRef, open, setOpen, close, toggle };
}

type Align = "start" | "end" | "fit";

export function PanelPopover({
  anchorRef,
  open,
  onClose,
  label,
  align = "start",
  minWidth = 200,
  className,
  children,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  label: string;
  align?: Align;
  minWidth?: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  // Se posiciona antes de pintar: debajo del botón, o encima si no cabe.
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const el = ref.current;
    if (!open || !anchor || !el) return;
    const r = anchor.getBoundingClientRect();
    el.style.minWidth = `${Math.max(minWidth, align === "fit" ? r.width : 0)}px`;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = document.documentElement.clientWidth;
    let left = align === "end" ? r.right - w : r.left;
    left = Math.min(Math.max(left, 8), vw - w - 8);
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - 8 && r.top - h - 6 > 8) top = r.top - h - 6;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.visibility = "visible";
  }, [open, anchorRef, align, minWidth]);

  useEffect(() => {
    if (!open) return;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>(
      "[data-autofocus], input, button:not([disabled]), a[href], [tabindex='0']",
    );
    first?.focus({ preventScroll: true });

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (ref.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
      anchorRef.current?.focus({ preventScroll: true });
    }
    function onResize() {
      onClose();
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [open, onClose, anchorRef]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      onBlur={(event) => {
        const next = event.relatedTarget as Node | null;
        if (next && !ref.current?.contains(next) && next !== anchorRef.current) onClose();
      }}
      style={{ left: -9999, top: 0, minWidth, visibility: "hidden" }}
      className={cn(
        "fixed z-[70] max-w-[min(420px,calc(100vw-16px))] overflow-hidden rounded-box border border-line bg-surface text-[13px] text-ink shadow-pop",
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
}

/* --- Menú de opciones dentro de una capa ------------------------------------ */

export interface PanelMenuItem {
  label: string;
  hint?: string;
  icon?: PanelIconName;
  checked?: boolean;
  disabled?: boolean;
  /** Deja el hueco del ícono para alinear opciones sin ícono. */
  inset?: boolean;
  tone?: "danger";
  onSelect: () => void;
}

export type PanelMenuEntry = PanelMenuItem | "separator";

export function PanelMenu({ items, label }: { items: PanelMenuEntry[]; label: string }) {
  const ref = useRef<HTMLDivElement | null>(null);

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const buttons = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? []);
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = {
      ArrowDown: (index + 1) % buttons.length,
      ArrowUp: (index - 1 + buttons.length) % buttons.length,
      Home: 0,
      End: buttons.length - 1,
    }[event.key];
    if (next != null && buttons[next]) {
      event.preventDefault();
      buttons[next].focus();
    }
  }

  return (
    <div ref={ref} role="menu" aria-label={label} className="p-1" onKeyDown={onKeyDown}>
      {items.map((entry, index) =>
        entry === "separator" ? (
          <hr key={`sep-${index}`} className="-mx-1 my-1 border-0 border-t border-line" />
        ) : (
          <button
            key={entry.label}
            type="button"
            role="menuitem"
            disabled={entry.disabled}
            aria-current={entry.checked ? "true" : undefined}
            onClick={entry.onSelect}
            className={cn(
              "flex min-h-8 w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[13px] outline-none hover:bg-hover focus-visible:bg-hover disabled:cursor-not-allowed disabled:opacity-50",
              entry.tone === "danger" && "text-danger-fg",
            )}
          >
            {entry.icon ? <PanelIcon name={entry.icon} /> : entry.inset ? <span className="size-4 shrink-0" /> : null}
            <span className="grid min-w-0 flex-1">
              {entry.hint ? (
                <>
                  <b className="font-semibold">{entry.label}</b>
                  <small className="text-xs leading-snug text-ink-3">{entry.hint}</small>
                </>
              ) : (
                entry.label
              )}
            </span>
            {entry.checked ? <PanelIcon name="check" className="text-accent-text" /> : null}
          </button>
        ),
      )}
    </div>
  );
}
