import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/* Encabezado de página (sistema visual v3): título de 24 px, bajada en gris,
   un dato al costado si hace falta y las acciones a la derecha. */
export function PageHeader({
  title,
  lede,
  eyebrow,
  aside,
  actions,
  className,
}: {
  title: ReactNode;
  lede?: ReactNode;
  eyebrow?: ReactNode;
  /** Dato destacado al costado del título (por ejemplo, un saldo). */
  aside?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex flex-wrap items-start justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0 flex-[1_1_320px]">
        {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
        <h1 tabIndex={-1} className="text-2xl font-semibold leading-8 tracking-[-0.025em] text-ink outline-none">
          {title}
        </h1>
        {lede ? <p className="mt-1 max-w-[78ch] text-ink-2">{lede}</p> : null}
      </div>
      {aside ? (
        <div className="grid border-line leading-tight max-lg:pl-0 lg:border-l lg:pl-6">{aside}</div>
      ) : null}
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/* Tarjeta (sistema visual v3) con cabecera opcional: título, subtítulo y acción. */
export function PanelCard({
  title,
  description,
  action,
  ruled = false,
  bodyClassName,
  className,
  children,
  ...rest
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /** Línea bajo la cabecera. */
  ruled?: boolean;
  bodyClassName?: string;
  className?: string;
  children?: ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, "title">) {
  return (
    <section className={cn("min-w-0 rounded-card border border-line bg-surface shadow-card", className)} {...rest}>
      {title ? (
        <div
          className={cn(
            "flex items-start justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-5",
            ruled && "border-b border-line pb-4",
          )}
        >
          <div className="min-w-0">
            <h2 className="text-base font-semibold leading-6 tracking-[-0.01em] text-ink">{title}</h2>
            {description ? <p className="mt-0.5 text-xs text-ink-2">{description}</p> : null}
          </div>
          {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
        </div>
      ) : null}
      <div className={cn("px-4 pb-4 pt-3 sm:px-6 sm:pb-6 sm:pt-4", bodyClassName)}>{children}</div>
    </section>
  );
}
