import { redirect } from "next/navigation";
import { routes } from "@/config/routes";
import { PageHeader } from "@/components/ui/PageHeader";
import { FreeTikTokAccountsManager } from "@/features/ad-accounts/components/FreeTikTokAccountsManager.client";
import { requirePermission } from "@/lib/auth/guards.server";
import { isStaffUser } from "@/lib/auth/staff.server";
import { getActingAsCliente } from "@/lib/hecom/selected-cliente.server";
import { isPaymentsSuperAdminEmail } from "@/lib/payments/funding-roles.server";

export const dynamic = "force-dynamic";

export default async function CuentasLibresPage() {
  const session = await requirePermission("payments:read");
  const email = String(session.email ?? "");
  if (!(await isStaffUser(email)) && !isPaymentsSuperAdminEmail(email)) {
    redirect(routes.overview);
  }
  if (await getActingAsCliente(session.id)) {
    redirect(routes.overview);
  }

  return (
    <div className="min-w-0">
      <PageHeader
        eyebrow="Gerencia"
        title="Cuentas libres"
        lede="Crea cuentas de reserva en tandas y entrégalas a un miembro del equipo o a un cliente. Libre significa sin dueño en Hecom."
      />

      <FreeTikTokAccountsManager />
    </div>
  );
}
