import { redirect } from "next/navigation";
import { routes } from "@/config/routes";
import { PanelShell } from "@/components/layout/panel/PanelShell.client";
import { registrationNextPath } from "@/features/contracts/lib/registration-contract.server";
import { DashboardSpanishLock } from "@/components/layout/DashboardSpanishLock.client";
import { requireSession } from "@/lib/auth/guards.server";
import {
  getActingAsCliente,
  getSelectedHecomCliente,
} from "@/lib/hecom/selected-cliente.server";
import { isOtpTestClienteId } from "@/lib/hecom/clientes.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { warmHolisticBcAdvertisers } from "@/lib/integrations/tiktok/bc-advertisers.server";
import { canSwitchTesterDashboardMode } from "@/lib/auth/tester-dashboard-mode";
import { getTesterDashboardMode } from "@/lib/auth/tester-dashboard-mode.server";
import type { DashboardPersona } from "@/types/dashboard-persona";
import { getSignedPartnerForCliente } from "@/lib/partners/partners.server";
import { readPanelPreferences } from "@/lib/ui/panel-preferences.server";

// Instrumentación del log [dashboard-layout]; fuera del componente para no leer el reloj en el render.
const readTimestamp = () => Date.now();

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const started = readTimestamp();
  const session = await requireSession();

  // No bloquea: el listado de BM se usa después en Cuentas ads y Pagos.
  warmHolisticBcAdvertisers({
    organizationId: session.organizationId ?? undefined,
  });

  const [funding, testerMode] = await Promise.all([
    resolvePaymentsFundingCapabilities({
      email: session.email,
      role: session.role,
    }),
    getTesterDashboardMode(session.email),
  ]);
  const canSwitchMode = canSwitchTesterDashboardMode(session.email);

  const persona: DashboardPersona = funding.isSuperAdmin
    ? "super_admin"
    : funding.isStaff
      ? "gerente"
      : "cliente";

  if (persona === "cliente") {
    const next = await registrationNextPath(session.email);
    if (next === "/contrato") redirect(routes.serviceContract);
    if (next === "/pago") redirect(routes.membershipCheckout);
  }

  let [selected, actingAsCliente] = await Promise.all([
    getSelectedHecomCliente(session.id),
    getActingAsCliente(session.id),
  ]);

  if (
    selected &&
    funding.isStaff &&
    isOtpTestClienteId(selected.id) &&
    !funding.isSuperAdmin
  ) {
    selected = null;
  }

  if (actingAsCliente && (!selected || (!funding.isStaff && !funding.isSuperAdmin))) {
    actingAsCliente = false;
  }

  const chromePersona: DashboardPersona =
    actingAsCliente && selected ? "cliente" : persona;

  // «Alianzas» solo si el chrome es de cliente y firmó el contrato (lo marca Hecom).
  const [showAlliances, preferences] = await Promise.all([
    chromePersona === "cliente" && selected
      ? getSignedPartnerForCliente(selected.id)
          .then(Boolean)
          .catch(() => false)
      : Promise.resolve(false),
    readPanelPreferences(),
  ]);

  const ms = readTimestamp() - started;
  if (process.env.NODE_ENV !== "production" || ms > 400) {
    console.info("[dashboard-layout]", {
      ms,
      persona,
      chromePersona,
      actingAsCliente,
      hasCliente: Boolean(selected),
    });
  }

  return (
    <DashboardSpanishLock enabled={chromePersona !== "cliente"}>
      <PanelShell
        user={{
          id: session.id,
          name: session.name,
          email: session.email,
          avatarInitials: session.avatarInitials,
        }}
        persona={chromePersona}
        sessionPersona={persona}
        actingAsCliente={actingAsCliente && Boolean(selected)}
        selectedCliente={selected ? { id: selected.id, name: selected.name } : null}
        canSwitchMode={canSwitchMode}
        testerMode={testerMode ?? "cliente"}
        showAlliances={showAlliances}
        preferences={preferences}
      >
        {children}
      </PanelShell>
    </DashboardSpanishLock>
  );
}
