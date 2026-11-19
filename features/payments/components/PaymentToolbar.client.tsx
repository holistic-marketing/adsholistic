"use client";

import { useTranslations } from "next-intl";
import { Select } from "@/components/ui/Input";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { SearchField } from "@/components/ui/PanelKit";
import type { PaymentAccountSortKey } from "@/lib/sort/payment-accounts";

interface PaymentToolbarProps {
  search: string;
  status: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  sort?: PaymentAccountSortKey;
  onSortChange?: (value: PaymentAccountSortKey) => void;
  agencyBmFunding?: boolean;
}

/* Filtros de la tabla de cuentas (v3 «fbar»), como franja superior de la
   tarjeta que contiene la tabla. */
export function PaymentToolbar({
  search,
  status,
  onSearchChange,
  onStatusChange,
  sort = "recommended",
  onSortChange,
  agencyBmFunding = false,
}: PaymentToolbarProps) {
  const t = useTranslations("payments");

  return (
    <div className="border-b border-line px-4 py-3 sm:px-5">
      <p className="mb-2.5 text-xs text-ink-2 sm:hidden">
        {t("toolbar.hintBefore")}{" "}
        <span className="font-semibold text-ink">
          {agencyBmFunding
            ? t("assignmentTable.reload")
            : t("assignmentTable.assignBalance")}
        </span>{" "}
        {t("toolbar.hintAfter")}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <PanelIcon name="filter" className="mx-1 size-[18px] text-ink max-sm:hidden" />
        <SearchField
          id="payment-account-search"
          label={t("toolbar.search")}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <div className="min-w-0 flex-[1_1_150px] sm:flex-none">
          <label htmlFor="payment-account-status" className="sr-only">
            {t("toolbar.filterStatus")}
          </label>
          <Select
            id="payment-account-status"
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
          >
            <option value="all">{t("toolbar.statusAll")}</option>
            <option value="active">{t("toolbar.statusActive")}</option>
            <option value="pending">{t("toolbar.statusPending")}</option>
            <option value="disabled">{t("toolbar.statusDisabled")}</option>
          </Select>
        </div>
        {onSortChange ? (
          <div className="min-w-0 flex-[1_1_150px] sm:flex-none">
            <label htmlFor="payment-account-sort" className="sr-only">
              {t("toolbar.sortLabel")}
            </label>
            <Select
              id="payment-account-sort"
              value={sort}
              onChange={(e) =>
                onSortChange(e.target.value as PaymentAccountSortKey)
              }
            >
              <option value="recommended">{t("toolbar.sortRecommended")}</option>
              <option value="bm">{t("toolbar.sortBm")}</option>
              <option value="name">{t("toolbar.sortName")}</option>
              <option value="ledger_desc">{t("toolbar.sortLedgerDesc")}</option>
              <option value="ledger_asc">{t("toolbar.sortLedgerAsc")}</option>
            </Select>
          </div>
        ) : null}
      </div>
    </div>
  );
}
