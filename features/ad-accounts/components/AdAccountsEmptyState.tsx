"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { routes } from "@/config/routes";
import { buttonClass } from "@/components/ui/Button";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { EmptyState } from "@/components/ui/PanelKit";
import { AdAccountsOpenCreateModalButton } from "./AdAccountsOpenCreateModalButton.client";

export function AdAccountsEmptyState() {
  const t = useTranslations("adAccounts");

  return (
    <section className="rounded-card border border-line bg-surface shadow-card">
      <EmptyState
        icon="layers"
        title={t("empty.title")}
        description={t("empty.body")}
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link href={routes.payments} className={buttonClass("outline")}>
              <PanelIcon name="wallet" />
              {t("empty.ctaWallet")}
            </Link>
            <AdAccountsOpenCreateModalButton className={buttonClass("primary")}>
              <PanelIcon name="plus" />
              {t("empty.ctaCreate")}
            </AdAccountsOpenCreateModalButton>
          </div>
        }
      />
    </section>
  );
}
