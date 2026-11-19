import Link from "next/link";
import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes, ComponentPropsWithoutRef, ReactNode } from "react";

/* Botones (sistema visual v3): 36 px de alto, radio de 8 px.
   Los colores salen de los tokens --admin-*, que dentro del panel apuntan a v3
   (app/panel-theme.css) y en /admin conservan su propio tema. */

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "luxury" | "danger" | "success";
type ButtonSize = "sm" | "md" | "lg";

type NativeButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: false;
};

type LinkButtonProps = ComponentPropsWithoutRef<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild: true;
  children: ReactNode;
};

const PRIMARY =
  "border-[var(--admin-accent)] bg-[var(--admin-accent)] text-[var(--admin-on-accent,#fff)] hover:border-[var(--admin-accent-hover)] hover:bg-[var(--admin-accent-hover)]";

const variantClasses: Record<ButtonVariant, string> = {
  primary: PRIMARY,
  // Acción secundaria con el acento suave (como un filtro activo).
  secondary:
    "border-[var(--admin-accent-line,var(--admin-border))] bg-[var(--admin-accent-soft)] text-[var(--admin-accent-text,var(--admin-accent))] hover:brightness-[0.98]",
  outline:
    "border-[var(--admin-control-border)] bg-[var(--admin-control-bg)] text-[var(--admin-control-text)] hover:border-[var(--admin-border-strong)] hover:bg-[var(--admin-control-hover-bg)]",
  ghost:
    "border-transparent bg-transparent text-[var(--admin-text)] shadow-none hover:bg-[var(--admin-surface-hover)]",
  // Antes era un degradado: en v3 es el botón principal con su brillo.
  luxury: `${PRIMARY} shadow-[var(--ui-glow)]`,
  danger: "border-[var(--ui-danger-btn)] bg-[var(--ui-danger-btn)] text-white hover:border-[var(--ui-danger-btn-hover)] hover:bg-[var(--ui-danger-btn-hover)]",
  success: "border-[var(--ui-ok-solid)] bg-[var(--ui-ok-solid)] text-white hover:brightness-95",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-[0.8125rem]",
  md: "h-9 px-3.5 text-sm",
  lg: "h-10 px-[18px] text-sm",
};

const baseClass =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[8px] border font-medium shadow-[var(--ui-shadow-xs)] transition-[color,background-color,border-color,box-shadow,filter] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-focus,var(--admin-accent))] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none [&_svg]:size-4 [&_svg]:shrink-0";

export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
) {
  return cn(baseClass, variantClasses[variant], sizeClasses[size], className);
}

export function Button(props: NativeButtonProps | LinkButtonProps) {
  const { variant = "primary", size = "md", className } = props;
  const composed = buttonClass(variant, size, className);

  if (props.asChild) {
    const { asChild: _asChild, variant: _variant, size: _size, className: _className, ...linkProps } = props;
    void _asChild;
    void _variant;
    void _size;
    void _className;
    return <Link className={composed} {...linkProps} />;
  }

  const { variant: _variant, size: _size, asChild: _asChild, className: _className, type = "button", ...buttonProps } = props;
  void _variant;
  void _size;
  void _asChild;
  void _className;
  return <button type={type} className={composed} {...buttonProps} />;
}
