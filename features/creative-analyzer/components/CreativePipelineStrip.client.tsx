"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

const STEP_IDS = ["upload", "score", "brief", "launch"] as const;

/** Pasos del flujo creativo (v3 «stepper»): raya naranja hasta el paso actual. */
export function CreativePipelineStrip({
  activeStep,
}: {
  /** 0=upload, 1=score, 2=brief, 3=launch */
  activeStep: 0 | 1 | 2 | 3;
}) {
  const t = useTranslations("creatives.pipeline");

  return (
    <nav aria-label={t("ariaLabel")}>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STEP_IDS.map((id, index) => {
          const reached = index <= activeStep;
          return (
            <li
              key={id}
              aria-current={index === activeStep ? "step" : undefined}
              className={cn(
                "min-w-0 border-t-2 pt-2 text-xs font-medium",
                reached ? "border-accent text-ink" : "border-line-strong text-ink-3",
              )}
            >
              {t(id)} <span className="font-normal text-ink-3">· {t(`${id}Hint`)}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
