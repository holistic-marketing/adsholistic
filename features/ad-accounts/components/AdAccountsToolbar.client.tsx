"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { FilterBar, SearchField } from "@/components/ui/PanelKit";
import { routes } from "@/config/routes";
import type { AdAccountStatus } from "@/types/ad-account";

interface AdAccountsToolbarProps {
  initialSearch?: string;
  initialStatus?: string;
}

/* Barra de filtros v3 sobre la tabla de cuentas: búsqueda y estado viven en la URL. */
export function AdAccountsToolbar({ initialSearch = "", initialStatus = "all" }: AdAccountsToolbarProps) {
  const t = useTranslations("adAccounts");
  const tPayments = useTranslations("payments");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState(initialStatus);

  const statusOptions: { value: AdAccountStatus | "all"; label: string }[] = [
    { value: "all", label: t("toolbar.statusAll") },
    { value: "active", label: t("status.active") },
    { value: "pending", label: t("status.pending") },
    { value: "disabled", label: t("status.disabled") },
    { value: "review", label: t("status.review") },
    { value: "archived", label: t("status.archived") },
  ];

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  return (
    <FilterBar
      tools={
        <Link href={routes.creativeAnalyzer} className={buttonClass("outline", "md", "max-sm:w-full")}>
          <PanelIcon name="sparkle" />
          {t("toolbar.creativeAnalyzer")}
        </Link>
      }
    >
      <SearchField
        label={t("toolbar.search").replace(/…$/, "")}
        value={search}
        onChange={(e) => {
          const value = e.target.value;
          setSearch(value);
          updateParams({ q: value || null });
        }}
      />
      <div className="shrink-0 max-sm:flex-1">
        <Select
          aria-label={tPayments("toolbar.filterStatus")}
          value={status}
          onChange={(e) => {
            const value = e.target.value;
            setStatus(value);
            updateParams({ status: value === "all" ? null : value });
          }}
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>
    </FilterBar>
  );
}
