import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/* Datos pegados en una sola caja (v3 «stats flush»): celdas separadas por
   una línea fina, sirve igual en 2 o 4 columnas y al apilarse en móvil. */

export function FlushStats({
  label,
  busy,
  className,
  children,
}: {
  label?: string;
  busy?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <dl
      aria-label={label}
      aria-busy={busy || undefined}
      className={cn("grid gap-px overflow-hidden rounded-box border border-line bg-line", className)}
    >
      {children}
    </dl>
  );
}

export function FlushStat({
  label,
  value,
  sub,
  live = false,
  valueClassName,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  /** Anuncia cambios de la cifra (saldo que llega en vivo). */
  live?: boolean;
  valueClassName?: string;
}) {
  return (
    <div className="min-w-0 bg-surface px-4 py-3.5">
      <dt className="truncate text-sm font-medium text-ink-2">{label}</dt>
      <dd
        aria-live={live ? "polite" : undefined}
        className={cn(
          "mt-1.5 truncate text-xl font-semibold leading-tight tracking-[-0.03em] tabular-nums sm:text-[1.75rem]",
          valueClassName ?? "text-ink",
        )}
      >
        {value}
      </dd>
      {sub ? <dd className="mt-1.5 text-[13px] leading-snug text-ink-2">{sub}</dd> : null}
    </div>
  );
}
