"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { routes } from "@/config/routes";
import { cn } from "@/lib/cn";

/**
 * Selector entre las dos vistas de Profit (v3 «seg»). El Radar vive dentro de
 * Profit, sin sección nueva en el menú; cada opción es su propia ruta.
 */
export function ProfitSectionSwitch({ active }: { active: "analysis" | "radar" }) {
  const t = useTranslations("profit.radar.switch");
  const items = [
    { key: "analysis" as const, href: routes.profit, label: t("analysis") },
    { key: "radar" as const, href: `${routes.profit}/radar`, label: t("radar") },
  ];
  return (
    <nav aria-label={t("label")} className="inline-flex rounded-box bg-subtle p-[3px]">
      {items.map((item) => {
        const on = item.key === active;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "flex h-[30px] items-center justify-center whitespace-nowrap rounded-ctl px-3.5 text-[13px] font-medium",
              on ? "bg-surface text-ink shadow-card" : "text-ink-2 hover:text-ink",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
