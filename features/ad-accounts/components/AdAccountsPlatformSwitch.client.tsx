"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ToneBadge } from "@/components/ui/PanelKit";
import { cn } from "@/lib/cn";
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

      {/* Control segmentado v3 con semántica de pestañas. */}
      <div role="tablist" aria-label={t("aria")} className="flex rounded-box bg-subtle p-[3px] sm:inline-flex">
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              id={`ad-accounts-tab-${tab.key}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`ad-accounts-panel-${tab.key}`}
              onClick={() => select(tab.key)}
              className={cn(
                "flex h-8 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-ctl px-3 text-[13px] font-medium sm:flex-none",
                isActive ? "bg-surface text-ink shadow-card" : "text-ink-2 hover:text-ink",
              )}
            >
              {tab.mark}
              <span>{tab.label}</span>
              {tab.badge ? (
                <span title={tab.badge}>
                  <ToneBadge tone="warn" dot>
                    <span className="max-sm:sr-only">{tab.badge}</span>
                  </ToneBadge>
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div
        id="ad-accounts-panel-tiktok"
        role="tabpanel"
        aria-labelledby="ad-accounts-tab-tiktok"
        hidden={active !== "tiktok"}
        className="space-y-4"
      >
        {tiktokBody}
      </div>
      <div
        id="ad-accounts-panel-meta"
        role="tabpanel"
        aria-labelledby="ad-accounts-tab-meta"
        hidden={active !== "meta"}
      >
        {metaBody}
      </div>
    </>
  );
}
