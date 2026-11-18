import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { routes } from "@/config/routes";
import type { AdAccountsPlatform } from "@/lib/integrations/bluefocus/meta-availability";

function TikTokMark() {
  return (
    <span
      aria-hidden
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#16161a] text-[8px] font-bold tracking-wide"
    >
      <span className="text-[#25f4ee]">T</span>
      <span className="text-[#fe2c55]">T</span>
    </span>
  );
}

export function MetaMark({ size = 24 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#0668E1] to-[#0081FB]"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.68} height={size * 0.68} fill="none">
        <path
          d="M4.2 15.6c0 1.4.7 2.3 1.8 2.3 1 0 1.7-.6 3.4-3.4l1.4-2.3.2-.4.2.3 1.3 2.2c1.6 2.6 2.6 3.6 4.1 3.6 1.7 0 2.9-1.6 2.9-4.2 0-3.3-1.9-6.6-4.3-6.6-1.4 0-2.5 1-3.5 2.4l-.6.9-.6-.9C9.4 8.1 8.3 7.1 6.9 7.1 4.6 7.1 4.2 11 4.2 15.6Z"
          stroke="white"
          strokeWidth="1.9"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/** Pestañas TikTok / Meta de "Cuentas publicitarias" (navegación por ?platform=). */
export async function AdAccountsPlatformTabs({
  active,
  metaMaintenance,
}: {
  active: AdAccountsPlatform;
  metaMaintenance: boolean;
}) {
  const t = await getTranslations("adAccounts.platformTabs");

  const tabs: Array<{
    key: AdAccountsPlatform;
    href: string;
    label: string;
    mark: React.ReactNode;
    badge?: string;
  }> = [
    { key: "tiktok", href: routes.adAccounts, label: "TikTok", mark: <TikTokMark /> },
    {
      key: "meta",
      href: `${routes.adAccounts}?platform=meta`,
      label: "Meta",
      mark: <MetaMark />,
      badge: metaMaintenance ? t("maintenance") : undefined,
    },
  ];

  return (
    <nav aria-label={t("aria")} className="-mx-1 overflow-x-auto px-1">
      <div className="inline-flex min-w-full gap-1 rounded-xl border border-[var(--auth-border)] bg-[var(--auth-surface-muted,#f6f7f9)] p-1 sm:min-w-0">
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              scroll={false}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-[13px] font-semibold transition-all sm:flex-none ${
                isActive
                  ? "bg-white text-[var(--auth-text)] shadow-[0_1px_2px_rgba(16,24,40,0.08),0_0_0_1px_rgba(16,24,40,0.04)]"
                  : "text-[var(--auth-text-muted)] hover:bg-white/60 hover:text-[var(--auth-text)]"
              }`}
            >
              {tab.mark}
              <span>{tab.label}</span>
              {tab.badge ? (
                <span
                  title={tab.badge}
                  className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 p-1 text-[10px] font-semibold uppercase tracking-[0.04em] text-amber-700 sm:px-2 sm:py-0.5"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  <span className="hidden sm:inline">{tab.badge}</span>
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
