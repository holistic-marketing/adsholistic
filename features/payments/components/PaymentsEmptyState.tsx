"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { routes } from "@/config/routes";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/PanelKit";
import { PaymentsOpenAddBalanceButton } from "./PaymentsOpenAddBalanceButton.client";

export function PaymentsEmptyState() {
  const t = useTranslations("payments");

  return (
    <EmptyState
      icon="wallet"
      title={t("empty.title")}
      description={t("empty.body")}
      action={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <PaymentsOpenAddBalanceButton className={buttonClass("primary")}>
            {t("empty.ctaAdd")}
          </PaymentsOpenAddBalanceButton>
          <Link href={routes.adAccounts} className={buttonClass("outline")}>
            {t("empty.ctaCreate")}
          </Link>
        </div>
      }
    />
  );
}
