import { getTranslations } from "next-intl/server";
import { buttonClass } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { PanelIcon } from "@/components/ui/PanelIcon";
import type { PaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";

interface PaymentsPageHeroProps {
  cliente: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  capabilities: PaymentsFundingCapabilities;
  introCopy: string;
}

export async function PaymentsPageHero({
  cliente,
  capabilities,
  introCopy,
}: PaymentsPageHeroProps) {
  const t = await getTranslations("payments");
  const managerOnly =
    capabilities.canAgencyBmFund && !capabilities.canClientStripeFund;

  return (
    <PageHeader
      eyebrow={t("hero.ofClient", { name: cliente.name })}
      title={managerOnly ? t("hero.titleManager") : t("hero.titleClient")}
      lede={introCopy}
      actions={
        <>
          {/*
           * Lleva al selector de método en vez de abrir el modal directo: el modal
           * hereda el método ya elegido, así que abrirlo desde acá metía a todos
           * por Stripe aunque quisieran pagar con Yape.
           */}
          {capabilities.canClientStripeFund ? (
            <a href="#recargar-saldo" className={buttonClass("primary", "lg")}>
              <PanelIcon name="wallet" />
              {t("hero.ctaReload")}
            </a>
          ) : null}
          <a
            href="#asignar-saldo"
            className={buttonClass(capabilities.canClientStripeFund ? "outline" : "primary", "lg")}
          >
            <PanelIcon name="send" />
            {managerOnly ? t("hero.ctaPickAccount") : t("hero.ctaAssign")}
          </a>
        </>
      }
    />
  );
}
