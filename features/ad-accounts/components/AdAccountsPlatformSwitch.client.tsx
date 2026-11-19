"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { AdAccountsPlatform } from "@/lib/integrations/bluefocus/meta-availability";
import { MetaMark, TikTokMark } from "./platform-marks";

/**
 * Pestañas TikTok / Meta de "Cuentas publicitarias".
 * Las dos vistas llegan ya renderizadas desde el servidor: cambiar de pestaña
 * es instantáneo (sin ida y vuelta al servidor) y TikTok conserva su estado.
 * La URL se actualiza (?platform=meta) para poder compartir el enlace.
 */
export function AdAccountsPlatformSwitch({
  initial,
  metaMaintenance,
  tiktokHeader,
  tiktokBody,
  metaHeader,
  metaBody,
}: {
  initial: AdAccountsPlatform;
  metaMaintenance: boolean;
  tiktokHeader: ReactNode;
  tiktokBody: ReactNode;
  metaHeader: ReactNode;
  metaBody: ReactNode;
}) {
  const t = useTranslations("adAccounts.platformTabs");
  const [active, setActive] = useState<AdAccountsPlatform>(initial);

  // Atrás/adelante del navegador entre pestañas.
  useEffect(() => {
    const onPop = () => {
      const p = new URLSearchParams(window.location.search).get("platform");
      setActive(p === "meta" ? "meta" : "tiktok");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const select = useCallback((next: AdAccountsPlatform) => {
    setActive((prev) => {
      if (prev === next) return prev;
      const url = new URL(window.location.href);
      if (next === "meta") url.searchParams.set("platform", "meta");
      else url.searchParams.delete("platform");
      window.history.pushState(window.history.state, "", url);
      return next;
    });
  }, []);

  const tabs: Array<{ key: AdAccountsPlatform; label: string; mark: ReactNode; badge?: string }> = [
    { key: "tiktok", label: "TikTok", mark: <TikTokMark /> },
    {
      key: "meta",
      label: "Meta",
      mark: <MetaMark />,
      badge: metaMaintenance ? t("maintenance") : undefined,
    },
  ];

  return (
    <>
      <div hidden={active !== "tiktok"}>{tiktokHeader}</div>
      <div hidden={active !== "meta"}>{metaHeader}</div>

      <div role="tablist" aria-label={t("aria")} className="-mx-1 overflow-x-auto px-1">
        <div className="inline-flex min-w-full gap-1 rounded-box border border-[var(--auth-border)] bg-[var(--auth-surface-muted)] p-1 sm:min-w-0">
          {tabs.map((tab) => {
            const isActive = tab.key === active;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => select(tab.key)}
                className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors sm:flex-none ${
                  isActive
                    ? "bg-surface text-[var(--auth-text)] shadow-[0_1px_2px_rgba(16,24,40,0.08),0_0_0_1px_rgba(16,24,40,0.04)]"
                    : "text-[var(--auth-text-muted)] hover:bg-surface/60 hover:text-[var(--auth-text)]"
                }`}
              >
                {tab.mark}
                <span>{tab.label}</span>
                {tab.badge ? (
                  <span
                    title={tab.badge}
                    className="inline-flex items-center gap-1 rounded-full border border-warn-line bg-warn-bg p-1 text-[10px] font-semibold uppercase tracking-[0.04em] text-warn-fg sm:px-2 sm:py-0.5"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-warn-solid" />
                    <span className="hidden sm:inline">{tab.badge}</span>
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel" hidden={active !== "tiktok"} className="space-y-5 sm:space-y-6 lg:space-y-8">
        {tiktokBody}
      </div>
      <div role="tabpanel" hidden={active !== "meta"}>
        {metaBody}
      </div>
    </>
  );
}
