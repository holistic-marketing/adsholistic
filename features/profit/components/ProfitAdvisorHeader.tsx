import { SquareIcon } from "@/components/ui/PanelKit";

/**
 * Cabecera del asesor del cliente. Vive aparte para que el reemplazo mientras
 * carga no arrastre el chat (que se importa en diferido).
 */
export function ProfitAdvisorHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="flex items-start gap-3 border-b border-line px-4 py-4 sm:px-6">
      <SquareIcon icon="sparkle" tone="accent" />
      <div className="min-w-0 flex-1">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="text-base font-semibold leading-6 tracking-[-0.01em] text-ink">{title}</h2>
        {subtitle ? <p className="mt-0.5 max-w-lg text-xs text-ink-2">{subtitle}</p> : null}
      </div>
    </header>
  );
}
