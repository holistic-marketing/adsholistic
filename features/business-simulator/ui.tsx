import type { ReactNode } from "react";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { cn } from "@/lib/cn";

/* Piezas chicas del simulador (sistema visual v3). */

/** Indicador de carga en línea. */
export function Spinner({ onAccent = false }: { onAccent?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-4 shrink-0 animate-spin rounded-full border-2 motion-reduce:animate-none",
        onAccent ? "border-on-accent/40 border-t-on-accent" : "border-line border-t-accent",
      )}
    />
  );
}

/** Estado de carga con una línea de contexto. */
export function Loading({ title, detail }: { title: ReactNode; detail?: ReactNode }) {
  return (
    <div role="status" className="flex items-center gap-3 py-8 text-sm">
      <Spinner />
      <div>
        <p className="font-medium text-ink">{title}</p>
        {detail ? <p className="text-[13px] text-ink-2">{detail}</p> : null}
      </div>
    </div>
  );
}

/** Desplegable nativo con borde fino. */
export function Disclosure({ summary, children, className }: { summary: ReactNode; children: ReactNode; className?: string }) {
  return (
    <details className={cn("group rounded-box border border-line bg-surface text-[13px]", className)}>
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2 font-medium text-ink [&::-webkit-details-marker]:hidden">
        {summary}
        <PanelIcon name="chevron-down" className="size-4 shrink-0 text-ink-3 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-2.5 border-t border-line px-3.5 py-3 leading-relaxed text-ink-2">{children}</div>
    </details>
  );
}

/** Subtítulo de bloque dentro de una tarjeta, con un dato a la derecha. */
export function BlockTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h3 className="text-base font-semibold tracking-[-0.01em] text-ink">{children}</h3>
      {aside ? <span className="text-xs text-ink-3">{aside}</span> : null}
    </div>
  );
}

/** Texto de ayuda o de error bajo un campo. */
export function FieldHint({ id, error, children }: { id?: string; error?: boolean; children: ReactNode }) {
  return (
    <span id={id} className={cn("text-xs font-normal leading-snug", error ? "text-danger-fg" : "text-ink-2")}>
      {children}
    </span>
  );
}

export const fieldLabel = "grid min-w-0 content-start gap-1.5 text-sm font-medium text-ink";
export const statGrid = "grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3";
export const footnote = "text-xs leading-relaxed text-ink-3";
export const textButton =
  "inline-flex min-h-8 items-center gap-1.5 text-[13px] font-medium text-accent-text underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-50";
