"use client";

import { useTranslations } from "next-intl";
import { GuideAccordion, GuideFaq, HowToSteps } from "./PaymentsGuide";
import { usePaymentsFundingMode } from "./PaymentsFundingModeContext.client";

/** Título de «Asignar saldo» (v3 «sec-h»), su bajada y la guía plegable. */
export function PaymentsAllocateSectionCopy({
  walletBalanceLabel,
  walletBalance,
  clienteName,
}: {
  walletBalanceLabel: string;
  walletBalance: number;
  clienteName?: string;
}) {
  const t = useTranslations("payments");
  const h = useTranslations("help");
  const { agencyBmFunding } = usePaymentsFundingMode();

  if (agencyBmFunding) {
    return (
      <div className="mb-3">
        <h2 className="text-base font-semibold tracking-[-0.01em] text-ink">
          {t("allocate.titleManager")}
        </h2>
        <p className="mt-1 max-w-[78ch] text-sm text-ink-3">
          {t("allocate.bodyManager", {
            ofClient: clienteName
              ? t("allocate.ofClient", { name: clienteName })
              : "",
          })}
        </p>
      </div>
    );
  }

  return (
    <div className="mb-3">
      <h2 className="text-base font-semibold tracking-[-0.01em] text-ink">
        {t("allocate.titleClient")}
      </h2>
      <p className="mt-1 max-w-[78ch] text-sm text-ink-3">
        {walletBalance > 0 ? (
          <>{t("allocate.bodyWithBalance")}</>
        ) : (
          <>
            {t("allocate.bodyEmptyBefore", { balance: walletBalanceLabel })}{" "}
            <a
              href="#recargar-saldo"
              className="font-medium text-accent-text underline-offset-2 hover:underline"
            >
              {t("allocate.bodyEmptyCta")}
            </a>
            .
          </>
        )}
      </p>
      <GuideAccordion summary={h("allocate.summary")} className="mt-3">
        <p className="text-[13px] text-ink-2">{h("allocate.intro")}</p>
        <HowToSteps
          className="mt-3"
          steps={[h("allocate.step1"), h("allocate.step2"), h("allocate.step3")]}
        />
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-[11px] border border-ok-line bg-ok-bg px-2 py-0.5 text-xs font-medium text-ok-fg">
          <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-ok-solid" />
          {h("allocate.time")}
        </p>
        <p className="mt-2 text-xs leading-snug text-ink-3">{h("allocate.tip")}</p>
        <GuideFaq
          title={h("faqTitle")}
          items={(["notListed", "notShowing", "move", "fee"] as const).map((id) => ({
            q: h(`allocate.faq.${id}.q`),
            a: h(`allocate.faq.${id}.a`),
          }))}
        />
      </GuideAccordion>
    </div>
  );
}
