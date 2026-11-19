"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { routes } from "@/config/routes";
import { buttonClass } from "@/components/ui/Button";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { SquareIcon } from "@/components/ui/PanelKit";

/** Invitación al Radar en Profit, mientras el cliente no haya armado su perfil. */
export function RadarInviteCard() {
  const t = useTranslations("profit.radar.invite");
  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-line bg-surface px-5 py-4 shadow-card sm:px-6">
      <div className="flex min-w-0 max-w-[64ch] items-start gap-3">
        <SquareIcon icon="video" tone="accent" />
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-6 tracking-[-0.01em] text-ink">{t("title")}</h2>
          <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{t("body")}</p>
        </div>
      </div>
      <Link href={`${routes.profit}/radar`} className={buttonClass("primary", "md", "shrink-0")}>
        {t("cta")}
        <PanelIcon name="arrow-right" />
      </Link>
    </section>
  );
}
