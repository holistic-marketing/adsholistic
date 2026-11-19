import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import { ReviewQueueHeader } from "@/features/payments/components/ReviewQueueHeader";
import { RealProfitVoucherReviewHost } from "@/features/payments/components/RealProfitVoucherReviewHost";
import { requirePermission } from "@/lib/auth/guards.server";
import { getHecomCliente } from "@/lib/hecom/clientes.server";
import {
  getActingAsCliente,
  getSelectedHecomCliente,
} from "@/lib/hecom/selected-cliente.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { redirect } from "next/navigation";
import { routes } from "@/config/routes";

export default async function RealProfitPaymentsReviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("payments:read");
  const capabilities = await resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });

  if (!capabilities.isStaff && !capabilities.isSuperAdmin) {
    redirect(routes.payments);
  }

  if (await getActingAsCliente(session.id)) {
    redirect(routes.payments);
  }

  const params = await searchParams;
  const filterCliente =
    typeof params.cliente === "string" && params.cliente.trim()
      ? params.cliente.trim()
      : null;

  const selected = await getSelectedHecomCliente(session.id);
  const hecomClienteId = filterCliente;
  let clienteName: string | undefined;
  if (filterCliente) {
    if (selected?.id === filterCliente) {
      clienteName = selected.name;
    } else {
      const c = await getHecomCliente(filterCliente).catch(() => null);
      clienteName = c?.name;
    }
  }

  return (
    <div className={dashboardClasses.page}>
      <ReviewQueueHeader
        area="Profit COD"
        title="Pagos Profit"
        lede={
          <>
            Depósitos{" "}
            <strong className="font-semibold text-ink">Real Profit COD · $20</strong>{" "}
            pendientes. Al aceptar se activa el extra y se vincula la tienda
            Shopify si ya está instalada — no acredita cartera ads.
          </>
        }
        links={[{ label: "Pagos manuales (cartera)", href: routes.paymentsManual }]}
        baseHref={routes.paymentsProfit}
        filteredId={hecomClienteId}
        filteredName={clienteName}
        selected={selected}
      />

      <RealProfitVoucherReviewHost
        staffMode
        hecomClienteId={hecomClienteId}
        clienteName={clienteName ?? selected?.name}
      />
    </div>
  );
}
