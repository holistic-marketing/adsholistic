"use client";

import { useTranslations } from "next-intl";
import { routes } from "@/config/routes";
import type { PanelIconName } from "@/components/ui/PanelIcon";
import { usePanel } from "./panel-context.client";

export interface QuickAction {
  id: string;
  icon: PanelIconName;
  title: string;
  hint: string;
  run: () => void;
}

export interface QuickActionGroup {
  label: string;
  actions: QuickAction[];
}

/** Lo más usado, a un clic. Cada acción lleva a la pantalla real que la resuelve. */
export function useQuickActions(): QuickActionGroup[] {
  const t = useTranslations("nav.shell");
  const panel = usePanel();
  const cliente = panel.selectedCliente;

  // Las acciones sobre un cliente piden elegirlo primero.
  const forCliente = (href: string) => () => {
    if (!cliente) panel.openClientPicker(false);
    else panel.go(href);
  };

  if (panel.persona === "cliente") {
    return [
      {
        label: t("groupAccount"),
        actions: [
          { id: "recharge", icon: "wallet", title: t("qRecharge"), hint: t("qRechargeHint"), run: () => panel.go(routes.payments) },
          { id: "assign", icon: "send", title: t("qAssign"), hint: t("qAssignHint"), run: () => panel.go(routes.payments) },
          { id: "accounts", icon: "layers", title: t("qAccounts"), hint: t("qAccountsHint"), run: () => panel.go(routes.adAccounts) },
          { id: "paid", icon: "ledger", title: t("qPaid"), hint: t("qPaidHint"), run: () => panel.go(routes.cobros) },
        ],
      },
    ];
  }

  const who = cliente ? cliente.name : t("qNeedsClient");
  return [
    {
      label: t("groupAccountsClients"),
      actions: [
        { id: "new-account", icon: "layers", title: t("qNewAccount"), hint: t("qNewAccountHint", { client: who }), run: forCliente(routes.adAccounts) },
        { id: "recharge", icon: "wallet", title: t("qRecharge"), hint: t("qRechargeStaffHint", { client: who }), run: forCliente(routes.payments) },
        { id: "assign", icon: "send", title: t("qAssign"), hint: t("qAssignStaffHint", { client: who }), run: forCliente(routes.payments) },
        { id: "client", icon: "user-plus", title: t("qClient"), hint: t("qClientHint"), run: () => panel.go(routes.clientes) },
      ],
    },
    {
      label: t("groupFinance"),
      actions: [
        { id: "manual", icon: "bank", title: t("qManual"), hint: t("qManualHint"), run: () => panel.go(routes.paymentsManual) },
        { id: "debt", icon: "link", title: t("qDebt"), hint: t("qDebtHint"), run: () => panel.go(routes.linksDeuda) },
      ],
    },
    {
      label: t("groupManagement"),
      actions: [
        { id: "ally", icon: "globe", title: t("qAlly"), hint: t("qAllyHint"), run: () => panel.go(routes.alianzas) },
        { id: "free", icon: "grid", title: t("qFree"), hint: t("qFreeHint"), run: () => panel.go(routes.adAccountsFree) },
        { id: "appeal", icon: "shield", title: t("qAppeal"), hint: t("qAppealHint"), run: () => panel.go(routes.apelaciones) },
      ],
    },
  ];
}

/** Compara sin tildes ni mayúsculas. */
export function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
