import { redirect } from "next/navigation";
import { routes } from "@/config/routes";
import { PrepagoMonitor } from "@/features/ops/components/PrepagoMonitor.client";
import { requirePermission } from "@/lib/auth/guards.server";
import { getActingAsCliente } from "@/lib/hecom/selected-cliente.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";

export const dynamic = "force-dynamic";

export default async function MonitoreoPage() {
  const session = await requirePermission("payments:read");
  const capabilities = await resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });

  if (!capabilities.isStaff && !capabilities.isSuperAdmin) {
    redirect(routes.overview);
  }

  if (await getActingAsCliente(session.id)) {
    redirect(routes.overview);
  }

  // El encabezado (con Actualizar y el automático) lo pinta el monitor.
  return <PrepagoMonitor />;
}
