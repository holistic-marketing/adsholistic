import type { PanelIconName } from "@/components/ui/PanelIcon";

export type NavItemKey =
  | "overview"
  | "clients"
  | "adAccounts"
  | "payments"
  | "paymentsManual"
  | "paymentsProfit"
  | "paymentsMissingCobros"
  | "debtLinks"
  | "prepagoMonitor"
  | "broadcasts"
  | "freeAccounts"
  | "appeals"
  | "cobros"
  | "gastos"
  | "affiliates"
  | "alliances"
  | "registrationContracts"
  | "creativeAnalyzer"
  | "pixels"
  | "profit"
  | "simulator"
  | "assistant"
  | "education"
  | "support"
  | "finance";

/** Claves de texto bajo `nav` que reemplazan la etiqueta por defecto. */
export type NavLabelKey = NavItemKey | "supportStaff" | "adAccountsClient" | "paymentsClient";

export type NavGroupKey = "agency" | "growth" | "management" | "support" | "account" | "help";

export interface NavItem {
  /** Clave de traducción bajo `nav`. */
  key: NavItemKey;
  href: string;
  icon: PanelIconName;
  /** Etiqueta alternativa (por ejemplo, la del cliente). */
  labelKey?: NavLabelKey;
  /** Subsecciones: la entrada se muestra como grupo plegable. */
  children?: NavItem[];
}

export interface NavGroup {
  key: NavGroupKey;
  items: NavItem[];
}
