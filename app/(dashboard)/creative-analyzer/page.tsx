import { timedPage } from "@/lib/perf/perf-log.server";
import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import { PickClienteEmpty } from "@/features/clientes/components/PickClienteEmpty";
import { CreativeVideosView } from "@/features/creative-analyzer/components/CreativeVideosView";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { requirePermission } from "@/lib/auth/guards.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { getSearchParam } from "@/lib/search-params";
import { resolveCreativeVideosRange } from "@/features/creative-analyzer/lib/videos-range";

interface CreativeAnalyzerPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Creativos: solo los videos del cliente con su gasto y rendimiento en TikTok,
 * filtrables por fecha. Las métricas salen de radar_ad_daily (job diario).
 */
async function CreativeAnalyzerPage({ searchParams }: CreativeAnalyzerPageProps) {
  const session = await requirePermission("creativeAnalyzer:read");
  const params = await searchParams;
  const [funding, selected] = await Promise.all([
    resolvePaymentsFundingCapabilities({ email: session.email, role: session.role }),
    getSelectedHecomCliente(session.id),
  ]);
  const mode = funding.isStaff || funding.isSuperAdmin ? "staff" : "cliente";

  if (!selected) {
    return (
      <div className={dashboardClasses.page}>
        <PickClienteEmpty section="el analizador creativo" mode={mode} />
      </div>
    );
  }

  const range = resolveCreativeVideosRange({
    preset: getSearchParam(params, "rango"),
    from: getSearchParam(params, "desde"),
    to: getSearchParam(params, "hasta"),
    sort: getSearchParam(params, "orden"),
  });

  return (
    <div className={dashboardClasses.page}>
      <CreativeVideosView
        clienteId={selected.id}
        clienteName={selected.name}
        organizationId={session.organizationId || undefined}
        range={range}
      />
    </div>
  );
}

export default timedPage("/creative-analyzer", CreativeAnalyzerPage);
