import { cn } from "@/lib/cn";
import type { ComponentPropsWithoutRef, HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

interface TableProps extends HTMLAttributes<HTMLTableElement> {
  embedded?: boolean;
}

export function Table({ className, embedded = false, ...props }: TableProps) {
  if (embedded) return <table className={cn("w-full min-w-[520px] border-collapse text-sm", className)} {...props} />;

  return (
    <div className="scrollbar-thin w-full overflow-x-auto rounded-[14px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2 shadow-[var(--admin-shadow-2)]">
      <table className={cn("w-full min-w-[520px] border-collapse text-sm", className)} {...props} />
    </div>
  );
}

export function TableWrap({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "admin-table-wrap scrollbar-thin overflow-x-auto",
        className,
      )}
      {...props}
    />
  );
}

export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-[var(--admin-table-head-bg)]", className)} {...props} />;
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-[var(--admin-table-divider)]", className)} {...props} />;
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("transition-colors duration-150 hover:bg-[var(--admin-table-row-hover)]", className)}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "h-10 whitespace-nowrap border-b border-[var(--admin-table-divider)] px-2 text-left text-sm font-medium text-[var(--admin-text)]",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("h-[59px] px-2 py-2 align-middle text-sm text-[var(--admin-text)] sm:whitespace-nowrap", className)} {...props} />;
}

export function Th({ className, ...props }: ComponentPropsWithoutRef<"th">) {
  return (
    <th
      className={cn(
        "h-10 whitespace-nowrap border-b border-[var(--admin-table-divider)] px-2 text-left text-sm font-medium text-[var(--admin-text)]",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: ComponentPropsWithoutRef<"td">) {
  return <td className={cn("h-[59px] px-2 py-2 align-middle text-sm text-[var(--admin-text)]", className)} {...props} />;
}
