import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { PanelIcon } from "@/components/ui/PanelIcon";

/* Guías plegables de pagos (v3 «acc» + «howto»): pasos numerados y
   preguntas frecuentes. Plegadas por defecto para no ocupar espacio. */

/** Acordeón con borde (v3 «details.acc»). */
export function GuideAccordion({
  summary,
  className,
  children,
}: {
  summary: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <details className={cn("group rounded-box border border-line bg-field", className)}>
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-box px-3 py-2.5 text-[13px] font-medium text-ink [&::-webkit-details-marker]:hidden">
        <PanelIcon name="info" className="text-ink-2" />
        <span className="min-w-0">{summary}</span>
        <PanelIcon
          name="chevron-down"
          className="ml-auto text-ink-3 transition-transform duration-150 group-open:rotate-180"
        />
      </summary>
      <div className="px-3 pb-3 pt-0.5">{children}</div>
    </details>
  );
}

/** Pasos numerados (v3 «howto»). */
export function HowToSteps({ steps, className }: { steps: ReactNode[]; className?: string }) {
  return (
    <ol className={cn("grid gap-2.5", className)}>
      {steps.map((step, index) => (
        <li key={index} className="grid grid-cols-[24px_1fr] items-start gap-2.5 text-[13px] text-ink-2">
          <span
            aria-hidden
            className="grid size-[22px] place-items-center rounded-[6px] bg-subtle font-mono text-[11px] font-semibold text-ink"
          >
            {index + 1}
          </span>
          <span className="min-w-0 pt-0.5">{step}</span>
        </li>
      ))}
    </ol>
  );
}

/** Preguntas frecuentes (v3 «details.acc.plain»). */
export function GuideFaq({
  title,
  items,
  className,
}: {
  title?: ReactNode;
  items: Array<{ q: ReactNode; a: ReactNode }>;
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className={cn("mt-4", className)}>
      {title ? <h3 className="mb-1 text-sm font-semibold text-ink">{title}</h3> : null}
      {items.map((item, index) => (
        <details key={index} className="group/faq border-t border-line">
          <summary className="flex cursor-pointer list-none items-center gap-2 py-2.5 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
            <span className="min-w-0">{item.q}</span>
            <PanelIcon
              name="chevron-down"
              className="ml-auto text-ink-3 transition-transform duration-150 group-open/faq:rotate-180"
            />
          </summary>
          <p className="pb-2.5 text-[13px] leading-relaxed text-ink-2">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
