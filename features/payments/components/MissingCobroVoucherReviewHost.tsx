import { listMissingCobroReviewsForStaff } from "@/services/payments.service";
import { ManualVoucherReviewSection } from "@/features/payments/components/ManualVoucherReviewSection.client";
import { ReviewQueueEmpty } from "./ReviewQueueEmpty";

interface MissingCobroVoucherReviewHostProps {
  staffMode: boolean;
  hecomClienteId?: string | null;
  clienteName?: string;
}

/**
 * Staff: claims “cobro faltante” (Lo pagado) — aprueba → insert Hecom, sin cartera.
 */
export async function MissingCobroVoucherReviewHost({
  staffMode,
  hecomClienteId,
  clienteName,
}: MissingCobroVoucherReviewHostProps) {
  if (!staffMode) return null;

  const { pending, pendingCount, scope } =
    await listMissingCobroReviewsForStaff({
      hecomClienteId: hecomClienteId ?? null,
    });

  if (pending.length === 0) {
    return (
      <ReviewQueueEmpty
        id="comprobantes-missing-cobro"
        label="Sin cobros faltantes"
        title={
          scope === "cliente"
            ? `Sin cobros faltantes pendientes de ${clienteName?.trim() || "este cliente"}`
            : "Sin cobros faltantes pendientes"
        }
        description="Solo aparecen reportes desde Lo pagado con voucher por aceptar o rechazar. No acreditan cartera."
      />
    );
  }

  return (
    <ManualVoucherReviewSection
      mode="staff"
      product="missing_cobro"
      pending={pending}
      recent={[]}
      pendingCount={pendingCount}
      canReview
      globalQueue={scope === "all"}
    />
  );
}
