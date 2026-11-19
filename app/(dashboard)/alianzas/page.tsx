import { redirect } from "next/navigation";
import { routes } from "@/config/routes";
import { Note } from "@/components/ui/PanelKit";
import { AlianzasHeader } from "@/features/partners/components/AlianzasHeader";
import { AlianzasPanel } from "@/features/partners/components/AlianzasPanel.client";
import { MiAlianza } from "@/features/partners/components/MiAlianza.client";
import { requireSession } from "@/lib/auth/guards.server";
import { getActingAsCliente, getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { getPartnerPanelData } from "@/lib/partners/partner-panel.server";
import { getSignedPartnerForCliente } from "@/lib/partners/partners.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { listPartnersWithStats, type PartnerWithStats } from "@/lib/partners/partners-admin.server";
import { dashboardClasses } from "@/lib/ui/dashboard-classes";

export const dynamic = "force-dynamic";

export default async function AlianzasPage() {
  const session = await requireSession();
  const capabilities = await resolvePaymentsFundingCapabilities({ email: session.email, role: session.role });
  const staff = capabilities.isStaff || capabilities.isSuperAdmin;

  // Cliente (o staff «viendo como cliente»): solo entra si firmó su contrato de alianza.
  if (!staff || (await getActingAsCliente(session.id))) {
    const selected = await getSelectedHecomCliente(session.id);
    const partner = selected ? await getSignedPartnerForCliente(selected.id) : null;
    if (!partner) redirect(routes.overview);
    const panel = await getPartnerPanelData(partner.id).catch(() => null);
    return (
      <div className={dashboardClasses.page}>
        <MiAlianza partner={partner} panel={panel} />
      </div>
    );
  }

  let partners: PartnerWithStats[] = [];
  let loadError: string | null = null;
  try {
    partners = await listPartnersWithStats();
  } catch {
    loadError = "No se pudieron cargar las alianzas.";
  }

  return (
    <div className={dashboardClasses.page}>
      {loadError ? (
        <>
          <AlianzasHeader />
          <Note tone="danger">{loadError}</Note>
        </>
      ) : (
        <AlianzasPanel partners={partners} />
      )}
    </div>
  );
}
