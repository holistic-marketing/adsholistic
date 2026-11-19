import { routes } from "./routes";
import type { NavGroup, NavItem } from "@/types/navigation";
import type { DashboardPersona } from "@/types/dashboard-persona";

/* Menú del panel (sistema visual v3).
   El equipo ve cuatro grupos; Finanzas se pliega. El cliente ve solo lo suyo,
   con nombres en primera persona («Mis cuentas», «Saldo y recargas»). */

const item = (
  key: NavItem["key"],
  href: string,
  icon: NavItem["icon"],
  extra: Partial<NavItem> = {},
): NavItem => ({ key, href, icon, ...extra });

export const staffNavigation: NavGroup[] = [
  {
    key: "agency",
    items: [
      item("overview", routes.overview, "gauge"),
      item("adAccounts", routes.adAccounts, "layers"),
      item("clients", routes.clientes, "users"),
      item("prepagoMonitor", routes.monitoreo, "activity"),
      {
        key: "finance",
        href: routes.payments,
        icon: "wallet",
        children: [
          item("payments", routes.payments, "card"),
          item("cobros", routes.cobros, "ledger"),
          item("paymentsManual", routes.paymentsManual, "bank"),
          item("paymentsProfit", routes.paymentsProfit, "bolt"),
          item("paymentsMissingCobros", routes.paymentsMissingCobros, "file"),
          item("debtLinks", routes.linksDeuda, "link"),
        ],
      },
      item("freeAccounts", routes.adAccountsFree, "grid"),
      item("appeals", routes.apelaciones, "shield"),
    ],
  },
  {
    key: "growth",
    items: [
      item("profit", routes.profit, "trend-up"),
      item("creativeAnalyzer", routes.creativeAnalyzer, "video"),
      item("pixels", routes.pixels, "target"),
      item("affiliates", routes.affiliates, "gift"),
      item("alliances", routes.alianzas, "globe"),
    ],
  },
  {
    key: "management",
    items: [
      item("simulator", routes.simulator, "scale"),
      item("assistant", routes.assistant, "sparkle"),
      item("broadcasts", routes.avisos, "megaphone"),
      item("registrationContracts", routes.registrationContracts, "contract"),
    ],
  },
  {
    key: "support",
    items: [
      item("support", routes.support, "inbox", { labelKey: "supportStaff" }),
      item("education", routes.education, "cap"),
    ],
  },
];

export const clienteNavigation: NavGroup[] = [
  {
    key: "account",
    items: [
      item("overview", routes.overview, "gauge"),
      item("adAccounts", routes.adAccounts, "layers", { labelKey: "adAccountsClient" }),
      item("payments", routes.payments, "card", { labelKey: "paymentsClient" }),
      item("cobros", routes.cobros, "ledger"),
    ],
  },
  {
    key: "growth",
    items: [
      item("profit", routes.profit, "trend-up"),
      item("creativeAnalyzer", routes.creativeAnalyzer, "video"),
      item("pixels", routes.pixels, "target"),
      item("affiliates", routes.affiliates, "gift"),
      item("alliances", routes.alianzas, "globe"),
    ],
  },
  {
    key: "help",
    items: [
      item("education", routes.education, "cap"),
      item("support", routes.support, "inbox"),
    ],
  },
];

/** Menú que corresponde a quien mira el panel. */
export function navigationFor(
  persona: DashboardPersona,
  { showAlliances = false }: { showAlliances?: boolean } = {},
): NavGroup[] {
  if (persona !== "cliente") return staffNavigation;
  // «Alianzas» solo para el cliente que ya firmó su contrato de alianza.
  return clienteNavigation.map((group) => ({
    ...group,
    items: group.items.filter((entry) => entry.href !== routes.alianzas || showAlliances),
  }));
}

/** Lista plana de destinos (las subsecciones llevan a su sección madre en `parent`). */
export function flattenNavigation(groups: NavGroup[]): Array<NavItem & { parent?: NavItem }> {
  return groups.flatMap((group) =>
    group.items.flatMap((entry) =>
      entry.children
        ? entry.children.map((child) => ({ ...child, parent: entry }))
        : [entry],
    ),
  );
}

/**
 * La sección activa para una ruta: la coincidencia más larga gana, así
 * `/payments/manual` no marca también «Recargas y saldo».
 */
export function findActiveNavItem(
  groups: NavGroup[],
  pathname: string,
): (NavItem & { parent?: NavItem }) | null {
  let best: (NavItem & { parent?: NavItem }) | null = null;
  for (const entry of flattenNavigation(groups)) {
    const matches = pathname === entry.href || pathname.startsWith(`${entry.href}/`);
    if (matches && (!best || entry.href.length > best.href.length)) best = entry;
  }
  return best;
}

export interface AdminNavItem {
  label: string;
  href: string;
  description: string;
  icon: string;
}

/** Admin UI stays Spanish-only in v1 (out of scope for next-intl). */
export const adminNavigation: AdminNavItem[] = [
  { label: "Resumen", href: "/admin/overview", description: "KPIs operativos", icon: "◇" },
  { label: "Clientes", href: "/admin/clientes", description: "Elegir cliente y ver solo lo suyo", icon: "◎" },
  { label: "Organizaciones", href: "/admin/organizations", description: "Ficha operativa CRM", icon: "⌂" },
  { label: "Usuarios", href: "/admin/users", description: "Perfiles y membresías", icon: "☷" },
  { label: "Pagos manuales", href: "/admin/payments", description: "Vouchers y abonos", icon: "$" },
  { label: "Reembolsos", href: "/admin/refunds", description: "Solicitudes del cliente", icon: "↩" },
  { label: "Cuentas Ads", href: "/admin/ad-accounts", description: "Estados y límites", icon: "▣" },
  { label: "Soporte", href: "/admin/support", description: "Tickets y mensajes", icon: "✦" },
  { label: "Educación", href: "/admin/education", description: "Tutoriales y enlaces Loom", icon: "▶" },
  { label: "Afiliados", href: "/admin/affiliates", description: "Códigos y comisiones", icon: "↗" },
  { label: "Creativos", href: "/admin/creatives", description: "Uploads y jobs IA", icon: "✺" },
  { label: "Ledger", href: "/admin/ledger", description: "Journals y entries", icon: "≡" },
  { label: "Conciliación", href: "/admin/reconciliation", description: "Runs e inconsistencias", icon: "⇄" },
  { label: "Webhooks", href: "/admin/webhooks", description: "Eventos externos", icon: "⌁" },
  { label: "Auditoría", href: "/admin/audit", description: "Trazabilidad", icon: "◷" },
  { label: "Integraciones", href: "/admin/integrations", description: "Conexiones y API keys", icon: "⛓" },
  { label: "Configuración", href: "/admin/settings", description: "Estado del admin", icon: "⚙" },
];
