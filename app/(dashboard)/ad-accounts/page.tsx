import { timedPage } from "@/lib/perf/perf-log.server";
﻿import { getTranslations } from "next-intl/server";
import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import { buttonClass } from "@/components/ui/Button";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { EmptyState } from "@/components/ui/PanelKit";
import { AdAccountsPageHeader } from "@/features/ad-accounts/components/AdAccountsPageHeader";
import { AdAccountsCreateModalHost } from "@/features/ad-accounts/components/AdAccountsCreateModalHost.client";
import { AdAccountsOpenCreateModalButton } from "@/features/ad-accounts/components/AdAccountsOpenCreateModalButton.client";
import { AdAccountsTable } from "@/features/ad-accounts/components/AdAccountsTable";
import { AdAccountsToolbar } from "@/features/ad-accounts/components/AdAccountsToolbar.client";
import { PickClienteEmpty } from "@/features/clientes/components/PickClienteEmpty";
import { requirePermission } from "@/lib/auth/guards.server";
import { filterAdAccounts } from "@/lib/filter/ad-accounts";
import { getHecomClienteAdAccountsOverview } from "@/lib/hecom/ad-accounts.server";
import { getActingAsCliente, getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import {
  resolvePaymentsFundingCapabilities,
  withActAsClienteView,
} from "@/lib/payments/funding-roles.server";
import { getSearchParam } from "@/lib/search-params";
import { resolveTikTokSelfServeAccountLimit } from "@/lib/integrations/tiktok/bc-create-profiles";
import { countHecomTikTokAccountsForQuota } from "@/lib/hecom/link-tiktok-cuenta.server";
import type { AdAccountStatus } from "@/types/ad-account";
import { Suspense } from "react";
import { StaffCreateTikTokAccountsPanel } from "@/features/ad-accounts/components/StaffCreateTikTokAccountsPanel.client";
import { isStaffUser } from "@/lib/auth/staff.server";
import { isPaymentsSuperAdminEmail } from "@/lib/payments/funding-roles.server";
import { TikTokConnectionPanel } from "@/features/ad-accounts/components/TikTokConnectionPanel.client";
import { AdAccountsPlatformSwitch } from "@/features/ad-accounts/components/AdAccountsPlatformSwitch.client";
import { MetaMaintenancePanel } from "@/features/ad-accounts/components/MetaMaintenancePanel";
import {
  META_ADS_MAINTENANCE,
  resolveAdAccountsPlatform,
} from "@/lib/integrations/bluefocus/meta-availability";

interface AdAccountsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const ACCOUNT_STATUSES = new Set<AdAccountStatus>([
  "active",
  "pending",
  "disabled",
  "review",
  "archived",
]);

function resolveAccountStatusFilter(raw: string): string {
  if (raw === "all" || ACCOUNT_STATUSES.has(raw as AdAccountStatus)) return raw;
  return "all";
}

const EMPTY_SUMMARY = {
  totalAccounts: 0,
  activeAccounts: 0,
  assignedBalance: 0,
  pendingSetup: 0,
  disabledAccounts: 0,
};

async function AdAccountsPage({ searchParams }: AdAccountsPageProps) {
  const t = await getTranslations("adAccounts");
  const session = await requirePermission("adAccounts:read");
  const params = await searchParams;
  const search = getSearchParam(params, "q");
  const status = resolveAccountStatusFilter(getSearchParam(params, "status", "all"));
  const includeArchived = getSearchParam(params, "archived") === "1";
  void includeArchived;
  // Pestaña inicial; después el cambio TikTok/Meta es 100% en el cliente.
  const platform = resolveAdAccountsPlatform(getSearchParam(params, "platform"));

  const selected = await getSelectedHecomCliente(session.id);
  const pageClass = `${dashboardClasses.page} pb-[env(safe-area-inset-bottom)] md:pb-0`;

  // Meta (BlueFocus) en mantenimiento: visible para todos, sin acciones.
  const metaHeader = (
    <AdAccountsPageHeader
      summary={EMPTY_SUMMARY}
      hecomScoped={Boolean(selected)}
      clienteName={selected?.name}
      platform="meta"
    />
  );
  const metaBody = <MetaMaintenancePanel clienteName={selected?.name} />;

  if (!selected) {
    // Un cliente sin ficha elegida (ej. con dos negocios) debe ver su propio selector,
    // no el de gerencia: "Ver todos los clientes" no le sirve.
    const actingAsCliente = await getActingAsCliente(session.id);
    const funding = withActAsClienteView(
      await resolvePaymentsFundingCapabilities({ email: session.email, role: session.role }),
      actingAsCliente,
    );
    const canChangeCliente = funding.isStaff || funding.isSuperAdmin || actingAsCliente;
    return (
      <div className={pageClass}>
        <AdAccountsPlatformSwitch
          initial={platform}
          metaMaintenance={META_ADS_MAINTENANCE}
          tiktokHeader={<AdAccountsPageHeader summary={EMPTY_SUMMARY} hecomScoped={false} hideCreate />}
          tiktokBody={
            <PickClienteEmpty
              section="las cuentas publicitarias"
              mode={canChangeCliente ? "staff" : "cliente"}
            />
          }
          metaHeader={metaHeader}
          metaBody={metaBody}
        />
      </div>
    );
  }

  const data = await getHecomClienteAdAccountsOverview(selected.id, "fast");
  const clienteName = data.cliente?.name ?? selected.name;
  const filteredAccounts = filterAdAccounts(data.accounts, { search, status });
  // Cupo self-serve = filas Hecom (igual que create API), no solo las del overview.
  let accountCount = data.summary.totalAccounts;
  try {
    accountCount = await countHecomTikTokAccountsForQuota(selected.id);
  } catch {
    accountCount = data.summary.totalAccounts;
  }
  const accountLimit = resolveTikTokSelfServeAccountLimit(selected.id);
  // Correo real de gerencia: el panel de crear sin límite no se muestra a clientes.
  const isStaff =
    (await isStaffUser(session.email ?? "")) || isPaymentsSuperAdminEmail(session.email ?? "");
  const panelTitle = t("panel.title", { name: clienteName });

  return (
    <div className={pageClass}>
      <AdAccountsPlatformSwitch
        initial={platform}
        metaMaintenance={META_ADS_MAINTENANCE}
        metaHeader={metaHeader}
        metaBody={metaBody}
        tiktokHeader={
          <AdAccountsPageHeader
            summary={data.summary}
            hecomScoped
            clienteName={clienteName}
            enableTikTokCreate
          />
        }
        tiktokBody={
          <>
            {isStaff ? <StaffCreateTikTokAccountsPanel clienteName={clienteName} /> : null}

            <TikTokConnectionPanel key={selected.id} />

            {/* Escucha «Crear cuenta» del encabezado, del estado vacío y de perfiles. */}
            <AdAccountsCreateModalHost
              clienteName={clienteName}
              currentAccountCount={accountCount}
              accountLimit={accountLimit}
            />

            <section aria-label={panelTitle} className="space-y-4">
              {data.accounts.length ? (
                <Suspense fallback={null}>
                  <AdAccountsToolbar initialSearch={search} initialStatus={status} />
                </Suspense>
              ) : null}
              {filteredAccounts.length === 0 && data.accounts.length === 0 ? (
                <div className="rounded-card border border-line bg-surface shadow-card">
                  <EmptyState
                    icon="layers"
                    title={t("panel.emptyTitle", { name: clienteName })}
                    description={t("panel.emptyBodyCreate", { name: clienteName })}
                    action={
                      <AdAccountsOpenCreateModalButton className={buttonClass("primary")}>
                        <PanelIcon name="plus" />
                        {t("panel.emptyCtaCreate")}
                      </AdAccountsOpenCreateModalButton>
                    }
                  />
                </div>
              ) : (
                <AdAccountsTable accounts={filteredAccounts} readOnly caption={panelTitle} />
              )}
            </section>
          </>
        }
      />
    </div>
  );
}

export default timedPage("/ad-accounts", AdAccountsPage);
