import { redirect } from "next/navigation";
import { routes } from "@/config/routes";
import { PageHeader } from "@/components/ui/PageHeader";
import { AppealsInbox } from "@/features/appeals/components/AppealsInbox.client";
import { requirePermission } from "@/lib/auth/guards.server";
import { getActingAsCliente } from "@/lib/hecom/selected-cliente.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";

export const dynamic = "force-dynamic";

export default async function ApelacionesPage() {
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

  return (
    <div className="min-w-0">
      <PageHeader
        eyebrow="Gerencia"
        title="Apelaciones TikTok"
        lede="Cuentas suspendidas que los clientes pidieron apelar. Cada una trae el mensaje en inglés listo y sus documentos: cópialo, envíalo a TikTok y marca cómo va."
      />

      <AppealsInbox />
    </div>
  );
}
