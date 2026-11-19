import { timedPage } from "@/lib/perf/perf-log.server";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/guards.server";
import { routes } from "@/config/routes";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { ClientesPageClient } from "@/features/clientes/components/ClientesPageClient.client";

export const dynamic = "force-dynamic";

async function ClientesPage() {
  const session = await requireSession();
  const funding = await resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });

  // Cliente final no tiene listado CRM de “todos los clientes”.
  if (!funding.isStaff && !funding.isSuperAdmin) {
    redirect(routes.overview);
  }

  return (
    <Suspense
      fallback={
        <div className="rounded-card border border-line bg-surface p-8 text-center text-sm font-medium text-ink-2 shadow-card">
          Cargando clientes…
        </div>
      }
    >
      <ClientesPageClient mode="staff" />
    </Suspense>
  );
}

export default timedPage("/clientes", ClientesPage);
