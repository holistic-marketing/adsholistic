import Link from "next/link";
import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { PanelIcon, type PanelIconName } from "./PanelIcon";

/* Piezas del sistema visual v3 que se repiten en las pantallas del panel.
   Todo usa los tokens de app/panel-theme.css: sirven en claro y en oscuro. */

export type Tone = "ok" | "info" | "warn" | "danger" | "neutral" | "accent";

/* --- Indicadores ------------------------------------------------------------ */

/** Tarjeta de indicador: rótulo, cifra grande y dos líneas de contexto. */
export function KpiCard({
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

/** Grilla de indicadores: 1, 2 o 4 columnas según el ancho. */
export function KpiGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4", className)}>{children}</div>;
}

/** Dato compacto (v3 «stat»): rótulo, cifra y una línea. `flat` para usarlo dentro de una tarjeta. */
export function StatCard({
  label,
  value,
  sub,
  extra,
  flat = false,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  extra?: ReactNode;
  flat?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid min-w-0 content-start",
        flat
          ? "rounded-box bg-field px-3.5 py-3"
          : "rounded-card border border-line bg-surface px-6 py-5 shadow-card",
        className,
      )}
    >
      <div className="flex min-h-[22px] items-center justify-between gap-2 text-sm font-medium text-ink-2">
        <span>{label}</span>
        {extra}
      </div>
      <p
        className={cn(
          "font-semibold leading-tight tracking-[-0.03em] text-ink tabular-nums",
          flat ? "mt-1 text-lg" : "mt-2.5 text-[1.75rem]",
        )}
      >
        {value}
      </p>
      {sub ? <p className={cn("text-ink-2", flat ? "mt-1 text-xs" : "mt-2 text-[13px]")}>{sub}</p> : null}
    </div>
  );
}

/** Variación frente al periodo anterior, con su tono. */
export function Delta({ current, previous, goodUp }: { current: number; previous: number; goodUp?: boolean }) {
  if (!previous) return null;
  const pct = ((current - previous) / previous) * 100;
  const up = pct >= 0;
  const tone = goodUp == null ? "neutral" : up === goodUp ? "ok" : "danger";
  return (
    <span className={cn("panel-badge num", `tone-${tone}`)}>
      <PanelIcon name={up ? "trend-up" : "trend-down"} className="size-3" />
      {Math.abs(pct).toFixed(1)} %
    </span>
  );
}

/* --- Insignias, avatares e íconos en cuadro --------------------------------- */

export function ToneBadge({
  tone = "neutral",
  icon,
  dot = false,
  className,
  children,
}: {
  tone?: Tone;
  icon?: PanelIconName;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={cn("panel-badge", `tone-${tone}`, className)}>
      {dot ? <span aria-hidden className="size-1.5 rounded-full bg-[var(--t-solid)]" /> : null}
      {icon ? <PanelIcon name={icon} className="size-3" /> : null}
      {children}
    </span>
  );
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = name
    .split(/[\s.@_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <span aria-hidden className={cn("panel-avatar", size === "sm" && "panel-avatar--sm")}>
      {initials}
    </span>
  );
}

/** Ícono en un cuadro de 32 px, con tono opcional. */
export function SquareIcon({ icon, tone, children }: { icon?: PanelIconName; tone?: Tone; children?: ReactNode }) {
  return (
    <span aria-hidden className={cn("panel-sqi", tone && `tone-${tone}`)}>
      {icon ? <PanelIcon name={icon} /> : children}
    </span>
  );
}

/* --- Avisos y estados vacíos ------------------------------------------------- */

/** Aviso en línea con tono (v3 «note»). */
export function Note({
  tone = "neutral",
  icon = tone === "danger" || tone === "warn" ? "alert" : "info",
  title,
  className,
  children,
}: {
  tone?: Tone;
  icon?: PanelIconName;
  title?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      className={cn(
        "flex gap-2.5 rounded-box border border-[var(--t-line,var(--ui-line))] bg-[var(--t-bg,var(--ui-field))] px-3 py-2.5 text-[13px] leading-snug text-[var(--t-fg,var(--ui-text-2))]",
        `tone-${tone}`,
        className,
      )}
    >
      <PanelIcon name={icon} className="mt-0.5" />
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={title ? "mt-0.5" : undefined}>{children}</div> : null}
      </div>
    </div>
  );
}

/** Estado vacío (v3 «empty»): ícono, título, texto y una acción. */
export function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
  className,
}: {
  icon?: PanelIconName;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid justify-items-center gap-1 px-6 py-12 text-center", className)}>
      <span aria-hidden className="mb-2.5 grid size-10 place-items-center rounded-box bg-subtle text-ink">
        <PanelIcon name={icon} className="size-[18px]" />
      </span>
      <p className="text-lg font-semibold tracking-[-0.015em] text-ink">{title}</p>
      {description ? <p className="max-w-[52ch] text-ink-2">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

/* --- Filtros ----------------------------------------------------------------- */

/** Barra de filtros (v3 «fbar»): buscador, filtros y herramientas a la derecha. */
export function FilterBar({
  children,
  tools,
  chips,
  className,
}: {
  children?: ReactNode;
  /** Herramientas a la derecha (exportar, columnas, vista). */
  tools?: ReactNode;
  /** Filtros activos, en una segunda fila. */
  chips?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-box border border-line bg-surface p-3 shadow-card",
        className,
      )}
    >
      <PanelIcon name="filter" className="mx-1 size-[18px] text-ink" />
      {children}
      <span className="flex-1" />
      {tools}
      {chips ? <div className="flex basis-full flex-wrap items-center gap-1.5 pt-1">{chips}</div> : null}
    </div>
  );
}

/** Buscador con lupa (v3 «search»). Responde a la tecla «/» del panel. */
export function SearchField({
  label,
  className,
  ...props
}: { label: string; className?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <label className={cn("panel-search min-w-[150px] max-w-[300px] flex-[4_1_150px] max-sm:max-w-none max-sm:basis-full", className)}>
      <span className="sr-only">{label}</span>
      <PanelIcon name="search" />
      <input type="search" placeholder={`${label}…`} autoComplete="off" spellCheck={false} {...props} />
      <kbd aria-hidden>/</kbd>
    </label>
  );
}

/** Botón de filtro (v3 «btn-filter»): se marca cuando tiene valores elegidos. */
export function FilterButton({
  label,
  count = 0,
  active,
  className,
  ...props
}: {
  label: string;
  count?: number;
  active?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const on = active ?? count > 0;
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-ctl border pl-3 pr-2 text-xs font-medium shadow-ctl",
        on ? "border-accent-line bg-accent-soft text-accent-text" : "border-line bg-field text-ink hover:border-line-strong hover:bg-hover",
        className,
      )}
      {...props}
    >
      <span>{label}</span>
      {count ? (
        <span className={cn("min-w-[18px] rounded-full px-1 text-center font-mono text-[11px] font-semibold leading-[18px]", on ? "bg-accent-btn text-on-accent" : "bg-subtle text-ink")}>
          {count}
        </span>
      ) : null}
      <PanelIcon name="chevrons" className="size-3.5 text-ink-3" />
    </button>
  );
}

/** Filtro activo que se puede quitar (v3 «chip»). */
export function FilterChip({ name, value, onRemove, removeLabel }: { name: string; value: string; onRemove: () => void; removeLabel: string }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`${removeLabel}: ${name} ${value}`}
      className="inline-flex h-6 items-center gap-1.5 rounded-full border border-line bg-subtle pl-2 pr-1.5 text-xs font-medium hover:border-line-strong"
    >
      <span className="font-normal text-ink-3">{name}</span>
      {value}
      <PanelIcon name="x" className="size-3 text-ink-3" />
    </button>
  );
}

/** Control segmentado (v3 «seg»): opciones excluyentes, como radios. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  block = false,
  className,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: ReactNode }>;
  onChange: (value: T) => void;
  block?: boolean;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-box bg-subtle p-[3px]", block && "flex", className)}>
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-ctl px-3 font-medium",
              block ? "h-[30px] text-[13px]" : "h-[26px] text-xs",
              checked ? "bg-surface text-ink shadow-card" : "text-ink-2 hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Pestañas con subrayado naranja (v3 «tabsbar»). Con `href` son enlaces. */
export function TabBar<T extends string>({
  label,
  value,
  tabs,
  onChange,
  className,
}: {
  label: string;
  value: T;
  tabs: Array<{ value: T; label: ReactNode; href?: string; count?: number }>;
  onChange?: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cn("flex gap-5 overflow-x-auto border-b border-line", className)}>
      {tabs.map((tab) => {
        const selected = tab.value === value;
        const cls = cn(
          "-mb-px block whitespace-nowrap border-b-2 px-0.5 pb-[9px] pt-2.5 text-sm font-medium",
          selected ? "border-accent text-ink" : "border-transparent text-ink-2 hover:text-ink",
        );
        const content = (
          <>
            {tab.label}
            {tab.count ? <span className="ml-1.5 font-mono text-xs text-ink-3">{tab.count}</span> : null}
          </>
        );
        return tab.href ? (
          <Link key={tab.value} href={tab.href} role="tab" aria-selected={selected} className={cls}>
            {content}
          </Link>
        ) : (
          <button key={tab.value} type="button" role="tab" aria-selected={selected} onClick={() => onChange?.(tab.value)} className={cls}>
            {content}
          </button>
        );
      })}
    </div>
  );
}

/* --- Listas de datos --------------------------------------------------------- */

/** Lista de pares rótulo/valor (v3 «props»). */
export function PropList({ items, className }: { items: Array<{ label: ReactNode; value: ReactNode }>; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-[minmax(120px,auto)_1fr]", className)}>
      {items.map((item, i) => (
        <div key={i} className="contents">
          <dt className="border-b border-line py-2 pr-4 text-[13px] text-ink-2">{item.label}</dt>
          <dd className="border-b border-line py-2 text-right text-[13px] font-medium [overflow-wrap:anywhere]">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Barra de proporción (v3 «meter»). `value` entre 0 y 1. */
export function Meter({ label, value, display }: { label: ReactNode; value: number; display?: ReactNode }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="mt-3.5">
      <div className="mb-1.5 flex justify-between text-[13px] text-ink-2">
        <span>{label}</span>
        <b className="num font-semibold text-ink">{display ?? `${Math.round(pct)} %`}</b>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-accent-soft" role="img" aria-label={`${Math.round(pct)} %`}>
        <i className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
