import { listManualVoucherReviewsForStaff } from "@/services/payments.service";
import { ManualVoucherReviewSection } from "@/features/payments/components/ManualVoucherReviewSection.client";
import { ReviewQueueEmpty } from "./ReviewQueueEmpty";

interface ManualVoucherReviewHostProps {
  staffMode: boolean;
  /**
   * Si viene, filtra a ese cliente Hecom.
   * Si no, muestra la cola global de todos los clientes.
   */
  hecomClienteId?: string | null;
  clienteName?: string;
}

/**
 * Solo gerentes/staff: boletas de Pago manual (global o filtradas).
 */
export async function ManualVoucherReviewHost({
  staffMode,
  hecomClienteId,
  clienteName,
}: ManualVoucherReviewHostProps) {
  if (!staffMode) return null;

  const { pending, pendingCount, scope } =
    await listManualVoucherReviewsForStaff({
      hecomClienteId: hecomClienteId ?? null,
    });

  if (pending.length === 0) {
    return (
      <ReviewQueueEmpty
        id="comprobantes"
        label="Sin boletas"
        title={
          scope === "cliente"
            ? `Sin pagos manuales pendientes de ${clienteName?.trim() || "este cliente"}`
            : "Sin pagos manuales pendientes"
        }
        description="Solo aparecen boletas BCP nuevas por aceptar o rechazar."
      />
    );
  }

  return (
    <ManualVoucherReviewSection
      mode="staff"
      pending={pending}
      recent={[]}
      pendingCount={pendingCount}
      canReview
      globalQueue={scope === "all"}
    />
  );
}
