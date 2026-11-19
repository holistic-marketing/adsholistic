import { cn } from "@/lib/cn";
import type { ComponentPropsWithoutRef, InputHTMLAttributes } from "react";

/* Campos (sistema visual v3): 36 px, radio de 8 px, fondo de campo y anillo
   naranja al enfocar. Colores desde los tokens --admin-* (ver Button.tsx). */

const FIELD =
  "w-full rounded-[8px] border border-[var(--admin-control-border)] bg-[var(--admin-control-bg)] text-sm text-[var(--admin-control-text)] shadow-[var(--ui-shadow-xs)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--admin-text-soft)] hover:border-[var(--admin-border-strong)] focus-visible:border-[var(--admin-accent)] focus-visible:ring-[3px] focus-visible:ring-[color-mix(in_srgb,var(--admin-accent)_28%,transparent)] disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-[var(--ui-danger-solid)]";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return <input className={cn(FIELD, "flex h-9 px-3", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentPropsWithoutRef<"select">) {
  return (
    <select
      className={cn(
        FIELD,
        "h-9 cursor-pointer appearance-none bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237A8593' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")] bg-[length:12px] bg-[position:right_10px_center] bg-no-repeat pl-3 pr-8 font-medium",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: ComponentPropsWithoutRef<"textarea">) {
  return <textarea className={cn(FIELD, "min-h-28 px-3 py-2 leading-relaxed", className)} {...props} />;
}
