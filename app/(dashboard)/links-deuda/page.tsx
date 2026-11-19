import { redirect } from "next/navigation";
import { routes } from "@/config/routes";
import { PageHeader } from "@/components/ui/PageHeader";
import { Note } from "@/components/ui/PanelKit";
import { LinksDeudaPanel } from "@/features/clientes/components/LinksDeudaPanel.client";
import { requirePermission } from "@/lib/auth/guards.server";
import { listDebtLinkClients } from "@/lib/hecom/lo-pagado-staff-links.server";
import { getActingAsCliente } from "@/lib/hecom/selected-cliente.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";

export const dynamic = "force-dynamic";

export default async function LinksDeudaPage() {
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

  let ready = false;
  let clients: Awaited<ReturnType<typeof listDebtLinkClients>>["clients"] = [];
  let loadError: string | null = null;
  try {
    const listed = await listDebtLinkClients();
    ready = listed.ready;
    clients = listed.clients;
  } catch {
    loadError = "No se pudo cargar la lista de clientes.";
  }

  return (
    <div className="min-w-0">
      <PageHeader
        eyebrow="Gerencia"
        title="Links de deuda"
        lede="Elige un cliente y copia su link. Ahí ve lo que debe, sus pagos y gastos, y puede abonar o subir un comprobante."
      />

      {loadError ? (
        <Note tone="danger">{loadError}</Note>
      ) : !ready ? (
        <Note tone="info">En este ambiente todavía no se pueden armar los links.</Note>
      ) : (
        <LinksDeudaPanel clients={clients} />
      )}
    </div>
  );
}
