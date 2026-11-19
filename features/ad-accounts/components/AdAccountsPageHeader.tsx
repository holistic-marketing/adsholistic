import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { routes } from "@/config/routes";
import { getAppFormatter } from "@/lib/i18n/get-app-formatter";
import { buttonClass } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { ToneBadge } from "@/components/ui/PanelKit";
import { AdAccountsOpenCreateModalButton } from "./AdAccountsOpenCreateModalButton.client";
import type { AdAccountsSummary } from "@/types/ad-account";

interface AdAccountsPageHeaderProps {
  summary: AdAccountsSummary;
  hecomScoped?: boolean;
  clienteName?: string;
  hideCreate?: boolean;
  enableTikTokCreate?: boolean;
  /** Pestaña activa: en "meta" cambia la bajada y oculta crear (mantenimiento). */
  platform?: "tiktok" | "meta";
}

/* Encabezado v3 de «Cuentas publicitarias»: título, bajada, saldo al costado
   y acciones (crear cuenta como acción principal). */
export async function AdAccountsPageHeader({
  summary,
  hecomScoped = false,
  clienteName,
  hideCreate: hideCreateProp = false,
  enableTikTokCreate: enableTikTokCreateProp = false,
  platform = "tiktok",
}: AdAccountsPageHeaderProps) {
  const isMeta = platform === "meta";
  const enableTikTokCreate = enableTikTokCreateProp && !isMeta;
  const showCreate = !(hideCreateProp || isMeta) || enableTikTokCreate;
  const t = await getTranslations("adAccounts");
  const { formatMoney, formatNumber } = await getAppFormatter();
  const total = isMeta ? 0 : summary.totalAccounts;
  const pending = isMeta ? 0 : summary.pendingSetup ?? 0;

  const lede = isMeta
    ? t("header.metaScopedMeta")
    : hecomScoped && clienteName
      ? t("header.lede", { name: clienteName })
      : t("header.metaPick");

  const asideDetail = isMeta
    ? t("header.metaNoAccounts")
    : total === 0
      ? t("header.noMapped")
      : t("header.activeOfTotal", { active: formatNumber(summary.activeAccounts), total });

  return (
    <PageHeader
      title={t("header.pageTitle")}
      lede={lede}
      aside={
        <>
          <span className="text-xs text-ink-2">{t("header.assignedBalance")}</span>
          <b className="text-2xl font-semibold leading-tight tracking-[-0.03em] text-ink tabular-nums">
            {formatMoney(isMeta ? 0 : summary.assignedBalance)}
          </b>
          <span className="text-xs text-ink-2">{asideDetail}</span>
          {pending > 0 ? (
            <span className="mt-1.5" title={t("header.pendingHint")}>
              <ToneBadge tone="warn" dot>
                {t(pending === 1 ? "header.pendingOne" : "header.pendingMany", {
                  count: formatNumber(pending),
                })}
              </ToneBadge>
            </span>
          ) : null}
        </>
      }
      actions={
        <>
          <Link href={routes.overview} className={buttonClass("ghost")}>
            {t("header.goOverview")}
          </Link>
          <Link href={routes.payments} className={buttonClass(showCreate ? "outline" : "primary")}>
            <PanelIcon name="wallet" />
            {t("header.goPayments")}
          </Link>
          {showCreate ? (
            <AdAccountsOpenCreateModalButton className={buttonClass("primary")}>
              <PanelIcon name="plus" />
              {enableTikTokCreate ? t("header.createTikTok") : t("header.create")}
            </AdAccountsOpenCreateModalButton>
          ) : null}
        </>
      }
    />
  );
}
