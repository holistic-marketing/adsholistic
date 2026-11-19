"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { PanelIcon, type PanelIconName } from "@/components/ui/PanelIcon";
import { PaymentDialogHeader, PaymentStepper } from "./PaymentDialog";

/* Piezas comunes a los modales de recarga (AddBalance y ManualPayment). */

interface PaymentModalHeaderProps {
  titleId: string;
  title: string;
  description: string;
  identityIcon: ReactNode;
  identityLabel: string;
  identityDescription: string;
  steps: readonly string[];
  currentStep: number;
  onClose: () => void;
}

/** Cabecera v3 del modal: título, bajada, pasos y el método de pago elegido. */
export function PaymentModalHeader({
  titleId,
  title,
  description,
  identityIcon,
  identityLabel,
  identityDescription,
  steps,
  currentStep,
  onClose,
}: PaymentModalHeaderProps) {
  const t = useTranslations("payments");
  const tCommon = useTranslations("common");

  return (
    <PaymentDialogHeader
      titleId={titleId}
      title={title}
      description={description}
      onClose={onClose}
      closeLabel={tCommon("close")}
    >
      <PaymentStepper steps={steps} current={currentStep} label={t("modalChrome.progressAria")} />
      <div className="mt-4 flex items-center gap-3 rounded-box border border-line bg-surface px-3 py-2.5 shadow-ctl">
        {identityIcon}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{identityLabel}</p>
          <p className="truncate text-xs text-ink-3">{identityDescription}</p>
        </div>
      </div>
    </PaymentDialogHeader>
  );
}

/** Resultado del pago (acreditado, en revisión…): ícono con tono, cifra y texto. */
export function PaymentOutcome({
  tone,
  icon,
  label,
  value,
  children,
}: {
  tone: "ok" | "warn";
  icon: PanelIconName;
  label?: ReactNode;
  value?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-box border border-[var(--t-line)] bg-[var(--t-bg)] p-4",
        `tone-${tone}`,
      )}
    >
      <span
        aria-hidden
        className="grid size-10 shrink-0 place-items-center rounded-box bg-surface text-[var(--t-fg)] shadow-ctl"
      >
        <PanelIcon name={icon} className="size-5!" />
      </span>
      <div className="min-w-0 pt-0.5">
        {label ? <p className="text-xs font-medium text-[var(--t-fg)]">{label}</p> : null}
        {value ? (
          <p className="num mt-0.5 text-2xl font-semibold tracking-[-0.03em] text-ink">{value}</p>
        ) : null}
        {children ? (
          <div className={cn("text-[13px] leading-5 text-[var(--t-fg)]", label || value ? "mt-1" : undefined)}>
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Opciones excluyentes en bloque (v3 «seg-block»), con aria-pressed. */
export function PaymentSegmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: ReactNode }>;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex rounded-box bg-subtle p-[3px]">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex h-[30px] flex-1 items-center justify-center whitespace-nowrap rounded-ctl px-3 text-[13px] font-medium transition-colors",
              selected ? "bg-surface text-ink shadow-card" : "text-ink-2 hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
