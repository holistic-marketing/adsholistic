import { listRealProfitVoucherReviewsForStaff } from "@/services/payments.service";
import { ManualVoucherReviewSection } from "@/features/payments/components/ManualVoucherReviewSection.client";
import { ReviewQueueEmpty } from "./ReviewQueueEmpty";

interface RealProfitVoucherReviewHostProps {
  staffMode: boolean;
  hecomClienteId?: string | null;
  clienteName?: string;
}

/**
 * Solo gerentes/staff: boletas Real Profit COD (+$20).
 */
export async function RealProfitVoucherReviewHost({
  staffMode,
  hecomClienteId,
  clienteName,
}: RealProfitVoucherReviewHostProps) {
  if (!staffMode) return null;

  const { pending, pendingCount, scope } =
    await listRealProfitVoucherReviewsForStaff({
      hecomClienteId: hecomClienteId ?? null,
    });

  if (pending.length === 0) {
    return (
      <ReviewQueueEmpty
        id="comprobantes-profit"
        label="Sin boletas Profit"
        title={
          scope === "cliente"
            ? `Sin pagos Real Profit pendientes de ${clienteName?.trim() || "este cliente"}`
            : "Sin pagos Real Profit pendientes"
        }
        description="Solo aparecen depósitos de $20 COD con voucher por aceptar o rechazar."
      />
    );
  }

  return (
    <ManualVoucherReviewSection
      mode="staff"
      product="realprofit"
      pending={pending}
      recent={[]}
      pendingCount={pendingCount}
      canReview
      globalQueue={scope === "all"}
    />
  );
}
