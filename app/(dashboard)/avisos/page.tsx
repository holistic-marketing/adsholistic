import { redirect } from "next/navigation";
import { routes } from "@/config/routes";
import { PageHeader } from "@/components/ui/PageHeader";
import { BroadcastComposer } from "@/features/push/BroadcastComposer.client";
import { requireSession } from "@/lib/auth/guards.server";
import { getActingAsCliente } from "@/lib/hecom/selected-cliente.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { BROADCAST_BODY_MAX, BROADCAST_DESTINATIONS, BROADCAST_TITLE_MAX } from "@/lib/push/broadcast.server";

export const dynamic = "force-dynamic";

export default async function AvisosPage() {
  const session = await requireSession();
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

  return (
    <>
      <PageHeader
        eyebrow="Gerencia"
        title="Avisos"
        lede="Manda un aviso a todos los clientes. Les llega al celular o a la computadora si tienen los avisos activos, y queda en su campanita."
      />
      <BroadcastComposer
        destinations={BROADCAST_DESTINATIONS.map((d) => ({ url: d.url, label: d.label }))}
        titleMax={BROADCAST_TITLE_MAX}
        bodyMax={BROADCAST_BODY_MAX}
      />
    </>
  );
}
