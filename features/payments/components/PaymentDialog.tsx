import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { PanelIcon } from "@/components/ui/PanelIcon";

/* Piezas v3 de los diálogos de pagos: marco, cabecera, cuerpo, pie, cálculo,
   pasos y campo de monto. Solo presentación: cada modal conserva su portal,
   su forma de cerrar y su lógica. */

/** Fondo oscuro + caja del diálogo (v3 «dialog»). Va dentro del portal del modal. */
export function PaymentDialogFrame({
  onDismiss,
  dismissLabel,
  labelledBy,
  size = "md",
  className,
  children,
}: {
  /** Clic en el fondo oscuro. */
  onDismiss: () => void;
  dismissLabel: string;
  labelledBy?: string;
  size?: "md" | "wide";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
      <button
        type="button"
        aria-label={dismissLabel}
        onClick={onDismiss}
        className="absolute inset-0 bg-[var(--ui-scrim)]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={cn(
          "relative flex max-h-[calc(100dvh-24px)] w-full flex-col overflow-hidden rounded-card border border-line bg-canvas text-ink shadow-dlg sm:max-h-[calc(100dvh-32px)]",
          size === "wide" ? "max-w-[640px]" : "max-w-[512px]",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Cabecera: título de 18 px, bajada en gris y botón de cerrar. `children` va debajo (pasos, etc.). */
export function PaymentDialogHeader({
  titleId,
  title,
  description,
  onClose,
  closeLabel,
  aside,
  children,
}: {
  titleId?: string;
  title: ReactNode;
  description?: ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  /** Algo junto al título (un logo, una insignia). */
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="shrink-0 pb-1 pl-6 pr-4 pt-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {aside}
          <div className="min-w-0">
            <h2
              id={titleId}
              className="text-lg font-semibold leading-6 tracking-[-0.015em] text-ink [overflow-wrap:anywhere]"
            >
              {title}
            </h2>
            {description ? <p className="mt-0.5 text-sm text-ink-2">{description}</p> : null}
          </div>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="-mt-2 inline-grid size-8 shrink-0 place-items-center rounded-ctl text-ink hover:bg-hover"
          >
            <PanelIcon name="x" />
          </button>
        ) : null}
      </div>
      {children ? <div className="pr-2">{children}</div> : null}
    </header>
  );
}

/** Cuerpo con su propio scroll: el pie queda fijo abajo. */
export function PaymentDialogBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4", className)}>{children}</div>;
}

/** Pie: Cancelar + acción principal, a la derecha. */
export function PaymentDialogFooter({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <footer
      className={cn(
        "flex shrink-0 flex-col-reverse gap-2 px-6 pb-6 sm:flex-row sm:items-center sm:justify-end",
        className,
      )}
    >
      {children}
    </footer>
  );
}

export type PaymentCalcRow = {
  label: ReactNode;
  value: ReactNode;
  /** Fila final en negrita (lo que se paga o se recibe). */
  total?: boolean;
};

/** Desglose de montos (v3 «calc»): filas rótulo/cifra y una fila total. */
export function PaymentCalc({
  rows,
  live = false,
  className,
}: {
  rows: Array<PaymentCalcRow | null | false>;
  /** Anuncia los cambios a lectores de pantalla (montos que se recalculan). */
  live?: boolean;
  className?: string;
}) {
  const visible = rows.filter((row): row is PaymentCalcRow => Boolean(row));
  if (visible.length === 0) return null;
  return (
    <dl
      aria-live={live ? "polite" : undefined}
      className={cn("overflow-hidden rounded-box border border-line bg-subtle", className)}
    >
      {visible.map((row, index) => (
        <div
          key={index}
          className={cn(
            "flex items-baseline justify-between gap-3 px-3 py-[9px] text-[13px]",
            index > 0 && "border-t border-line",
          )}
        >
          <dt className={row.total ? "font-semibold text-ink" : "text-ink-2"}>{row.label}</dt>
          <dd className={cn("num text-right text-ink", row.total ? "text-base font-bold" : "font-medium")}>
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Pasos del flujo (v3 «stepper»): raya naranja hasta el paso actual. */
export function PaymentStepper({
  steps,
  current,
  label,
  className,
}: {
  steps: readonly string[];
  current: number;
  label: string;
  className?: string;
}) {
  return (
    <ol aria-label={label} className={cn("mt-4 grid auto-cols-fr grid-flow-col gap-2", className)}>
      {steps.map((step, index) => (
        <li
          key={step}
          aria-current={index === current ? "step" : undefined}
          className={cn(
            "border-t-2 pt-2 text-xs font-medium",
            index <= current ? "border-accent text-ink" : "border-line-strong text-ink-3",
          )}
        >
          {step}
        </li>
      ))}
    </ol>
  );
}

/** Campo de monto con prefijo y sufijo (v3 «affix»). `big` para el monto principal. */
export function PaymentAmountInput({
  prefix = "$",
  suffix,
  big = false,
  className,
  inputClassName,
  ...props
}: {
  prefix?: ReactNode;
  suffix?: ReactNode;
  big?: boolean;
  className?: string;
  inputClassName?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  const box = cn(
    "grid shrink-0 place-items-center border border-line bg-subtle px-2.5 font-mono text-[13px] font-medium text-ink-3",
    big ? "h-11" : "h-9",
  );
  return (
    <div className={cn("flex min-w-0", className)}>
      {prefix ? <span aria-hidden className={cn(box, "rounded-l-ctl border-r-0")}>{prefix}</span> : null}
      <input
        {...props}
        className={cn(
          "num min-w-0 flex-1 border border-line bg-field px-3 text-right font-semibold text-ink shadow-ctl outline-none transition-[border-color,box-shadow] placeholder:font-normal placeholder:text-ink-3 hover:border-line-strong focus-visible:border-accent focus-visible:ring-[3px] focus-visible:ring-[var(--ui-ring)] disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger-solid",
          big ? "h-11 text-lg" : "h-9 text-[15px]",
          prefix ? "" : "rounded-l-ctl",
          suffix ? "" : "rounded-r-ctl",
          inputClassName,
        )}
      />
      {suffix ? <span className={cn(box, "rounded-r-ctl border-l-0")}>{suffix}</span> : null}
    </div>
  );
}

/** Rótulo de campo (14 px, medio). */
export function PaymentFieldLabel({
  htmlFor,
  optional,
  className,
  children,
}: {
  htmlFor?: string;
  /** Texto «(opcional)» ya traducido. */
  optional?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className={cn("mb-1.5 block text-sm font-medium text-ink", className)}>
      {children}
      {optional ? <span className="ml-1 text-xs font-normal text-ink-3">{optional}</span> : null}
    </label>
  );
}

/** Ayuda bajo un campo. */
export function PaymentFieldHint({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={cn("mt-1.5 text-xs leading-snug text-ink-3", className)}>{children}</p>;
}

/** Error bajo un campo (v3 «err»). */
export function PaymentFieldError({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <p role="alert" className={cn("mt-1.5 flex items-start gap-1.5 text-xs text-danger-fg", className)}>
      <PanelIcon name="alert" className="mt-px size-3.5!" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}
