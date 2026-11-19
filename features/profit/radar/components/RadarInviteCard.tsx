"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { routes } from "@/config/routes";

/** Invitación al Radar en Profit, mientras el cliente no haya armado su perfil. */
export function RadarInviteCard() {
  const t = useTranslations("profit.radar.invite");
  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-line bg-surface px-5 py-4 sm:px-6">
      <div className="min-w-0 max-w-[60ch]">
        <h2 className="text-[15.5px] font-bold tracking-[-0.01em] text-ink">{t("title")}</h2>
        <p className="mt-1 text-[13.5px] leading-[1.55] text-ink-2">{t("body")}</p>
      </div>
      <Link
        href={`${routes.profit}/radar`}
        className="inline-flex h-10 shrink-0 items-center rounded-box bg-accent-btn px-5 text-[14px] font-semibold text-on-accent transition-colors hover:bg-accent-btn-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2"
      >
        {t("cta")}
      </Link>
    </section>
  );
}
