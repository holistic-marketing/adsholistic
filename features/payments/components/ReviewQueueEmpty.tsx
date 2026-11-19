import { PanelCard } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/PanelKit";

/** Cola de revisión sin pendientes (v3 «empty» dentro de una tarjeta). */
export function ReviewQueueEmpty({
  id,
  label,
  title,
  description,
}: {
  id: string;
  label: string;
  title: string;
  description: string;
}) {
  return (
    <PanelCard id={id} aria-label={label}>
      <EmptyState icon="check-circle" title={title} description={description} />
    </PanelCard>
  );
}
