"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

export type PaymentsFundingMode = "client" | "agency_bm";

interface PaymentsFundingModeSwitchProps {
  mode: PaymentsFundingMode;
  onChange: (mode: PaymentsFundingMode) => void;
  canClientStripeFund: boolean;
  canAgencyBmFund: boolean;
  canSwitchFundingModes: boolean;
}

/* Origen del saldo (solo quien puede usar los dos caminos): control
   segmentado v3 con dos líneas por opción. */
export function PaymentsFundingModeSwitch({
  mode,
  onChange,
  canClientStripeFund,
  canAgencyBmFund,
  canSwitchFundingModes,
}: PaymentsFundingModeSwitchProps) {
  const t = useTranslations("payments");

  if (!canSwitchFundingModes) return null;

  const options = [
    {
      value: "client" as const,
      label: t("fundingMode.wallet"),
      hint: t("fundingMode.walletHint"),
      enabled: canClientStripeFund,
    },
    {
      value: "agency_bm" as const,
      label: t("fundingMode.bm"),
      hint: t("fundingMode.bmHint"),
      enabled: canAgencyBmFund,
    },
  ];

  return (
    <section className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-card sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-[-0.01em] text-ink">
          {t("fundingMode.title")}
        </h2>
        <p className="mt-0.5 text-xs text-ink-2">{t("fundingMode.body")}</p>
      </div>
      <div
        className="grid gap-[3px] rounded-box bg-subtle p-[3px] sm:min-w-[24rem] sm:grid-cols-2"
        role="radiogroup"
        aria-label={t("fundingMode.aria")}
      >
        {options.map((option) => {
          const checked = mode === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={checked}
              disabled={!option.enabled}
              onClick={() => option.enabled && onChange(option.value)}
              className={cn(
                "rounded-ctl px-3.5 py-2 text-left disabled:cursor-not-allowed disabled:opacity-50",
                checked ? "bg-surface shadow-card" : "hover:bg-hover",
              )}
            >
              <span className="block text-[13px] font-semibold text-ink">{option.label}</span>
              <span className="block text-xs text-ink-2">{option.hint}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
