import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/* Tarjeta de indicador del resumen (sistema visual v3): rótulo, cifra grande
   y dos líneas de contexto. */
export function OverviewKpi({
  label,
  value,
  lead,
  detail,
  extra,
  busy = false,
  className,
}: {
  label: string;
  value: ReactNode;
  /** Primera línea, en negrita (lo que significa la cifra). */
  lead?: ReactNode;
  /** Segunda línea, en gris (de dónde sale). */
  detail?: ReactNode;
  /** Algo al costado del rótulo: una variación, una insignia. */
  extra?: ReactNode;
  busy?: boolean;
  className?: string;
}) {
  return (
    <section
      aria-label={label}
      aria-busy={busy || undefined}
      className={cn("grid min-w-0 content-start gap-1 rounded-card border border-line bg-surface p-5 shadow-card sm:p-6", className)}
    >
      <div className="flex min-h-[26px] items-center justify-between gap-2 font-medium text-ink-2">
        <span>{label}</span>
        {extra}
      </div>
      <p className="mt-2 text-[1.875rem] font-semibold leading-tight tracking-[-0.03em] text-ink tabular-nums [overflow-wrap:anywhere]">
        {value}
      </p>
      {lead ? <p className="mt-2 font-medium text-ink">{lead}</p> : null}
      {detail ? <p className="text-ink-2">{detail}</p> : null}
    </section>
  );
}

/** Variación frente al periodo anterior, en una píldora con su tono. */
export function OverviewDelta({ current, previous, goodUp }: { current: number; previous: number; goodUp?: boolean }) {
  if (!previous) return null;
  const pct = ((current - previous) / previous) * 100;
  const up = pct >= 0;
  const tone = goodUp == null ? "tone-neutral" : up === goodUp ? "tone-ok" : "tone-danger";
  return (
    <span className={cn("panel-badge num", tone)}>
      {up ? "↑" : "↓"} {Math.abs(pct).toFixed(1)} %
    </span>
  );
}
