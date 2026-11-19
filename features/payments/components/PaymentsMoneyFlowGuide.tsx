"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { GuideAccordion, GuideFaq, HowToSteps } from "./PaymentsGuide";
import type { PaymentGatewayId } from "@/types/payment";

/**
 * Guía de recarga: pasos según el método, cuánto tarda y las preguntas que
 * más llegan a soporte. Abre en el método que el cliente tiene elegido.
 */
type GuideTab = "yape" | "manual" | "crypto" | "abroad";

const STEPS: Record<GuideTab, number> = { yape: 3, manual: 4, crypto: 4, abroad: 3 };
const FAQ = ["notCredited", "invalidPayment", "card", "fee", "assign"] as const;

function tabFromGateway(id: PaymentGatewayId | undefined): GuideTab {
  if (id === "manual") return "manual";
  if (id === "crypto") return "crypto";
  return "yape";
}

export function PaymentsMoneyFlowGuide({
  selected,
  feePercent = 10,
  className,
}: {
  selected?: PaymentGatewayId;
  feePercent?: number;
  className?: string;
}) {
  const t = useTranslations("payments.guide");
  const [picked, setPicked] = useState<GuideTab | null>(null);
  const tab = picked ?? tabFromGateway(selected);

  return (
    <GuideAccordion summary={t("summary")} className={className}>
      <p className="text-[13px] text-ink-2">{t("intro")}</p>

      <div role="tablist" aria-label={t("tabsLabel")} className="mt-3 flex flex-wrap gap-1.5">
        {(["yape", "manual", "crypto", "abroad"] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setPicked(id)}
            className={cn(
              "inline-flex h-8 items-center rounded-ctl border px-3 text-[13px] font-medium shadow-ctl",
              tab === id
                ? "border-accent-line bg-accent-soft text-accent-text"
                : "border-line bg-surface text-ink hover:bg-hover",
            )}
          >
            {t(`tabs.${id}`)}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="mt-4">
        <HowToSteps
          steps={Array.from({ length: STEPS[tab] }, (_, i) =>
            t(`${tab}.step${i + 1}` as Parameters<typeof t>[0], { fee: feePercent }),
          )}
        />
        {/* Insignia que puede partir línea: el tiempo de algunos métodos es largo. */}
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-[11px] border border-ok-line bg-ok-bg px-2 py-0.5 text-xs font-medium text-ok-fg">
          <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-ok-solid" />
          {t(`${tab}.time`)}
        </p>
        <p className="mt-2 text-xs leading-snug text-ink-3">{t(`${tab}.tip`)}</p>
      </div>

      <GuideFaq
        title={t("faqTitle")}
        items={FAQ.map((id) => ({
          q: t(`faq.${id}.q`, { fee: feePercent }),
          a: t(`faq.${id}.a`, { fee: feePercent }),
        }))}
      />
    </GuideAccordion>
  );
}
