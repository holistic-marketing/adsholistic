import { getTranslations } from "next-intl/server";
import { CrmPanel } from "@/components/dashboard/crm-ui";
import { MetaMark } from "./AdAccountsPlatformTabs";

function FeatureIcon({ path }: { path: string }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0668E1]/[0.08] text-[#0668E1]">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={path} />
      </svg>
    </span>
  );
}

const FEATURES = [
  { key: "accounts", icon: "M3 7h18M3 12h18M3 17h12" },
  { key: "recharge", icon: "M12 5v14M5 12h14" },
  { key: "tracking", icon: "M4 12l5 5L20 6" },
] as const;

/** Pestaña Meta mientras la integración BlueFocus está en mantenimiento. */
export async function MetaMaintenancePanel({ clienteName }: { clienteName?: string }) {
  const t = await getTranslations("adAccounts.metaMaintenance");

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-lg border border-[var(--auth-border)] bg-white">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#0081FB]/[0.07] blur-3xl"
        />
        <div className="relative px-5 py-6 sm:px-8 sm:py-8">
          <div className="flex flex-wrap items-center gap-3">
            <MetaMark size={40} />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
              </span>
              {t("badge")}
            </span>
          </div>

          <h2 className="mt-4 max-w-2xl text-[1.25rem] font-bold leading-snug tracking-[-0.02em] text-[var(--auth-text)] sm:text-[1.5rem]">
            {t("title")}
          </h2>
          <p className="mt-2 max-w-2xl text-[13.5px] leading-6 text-[var(--auth-text-muted)]">
            {t("body")}
          </p>

          <ul className="mt-6 grid gap-3 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <li
                key={f.key}
                className="flex items-start gap-3 rounded-lg border border-[var(--auth-divider)] bg-[var(--auth-surface-muted)] p-3.5"
              >
                <FeatureIcon path={f.icon} />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[var(--auth-text)]">
                    {t(`features.${f.key}.title`)}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-5 text-[var(--auth-text-muted)]">
                    {t(`features.${f.key}.body`)}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <button
              type="button"
              disabled
              aria-disabled
              className="inline-flex h-10 cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-[var(--auth-surface-muted)] px-4 text-[13px] font-semibold text-[var(--auth-text-soft)] ring-1 ring-inset ring-[var(--auth-border)]"
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
              {t("cta")}
            </button>
            <p className="text-[12px] text-[var(--auth-text-muted)]">{t("ctaHint")}</p>
          </div>
        </div>
      </section>

      <CrmPanel
        title={clienteName ? t("tableTitle", { name: clienteName }) : t("tableTitleGeneric")}
        className="overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left sm:min-w-[560px] text-[12px]">
            <thead>
              <tr className="border-b border-[var(--auth-divider)] text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
                <th className="px-4 py-2.5">{t("columns.account")}</th>
                <th className="hidden px-4 py-2.5 sm:table-cell">{t("columns.id")}</th>
                <th className="px-4 py-2.5 text-right">{t("columns.balance")}</th>
                <th className="px-4 py-2.5">{t("columns.status")}</th>
              </tr>
            </thead>
            <tbody>
              {[0, 1].map((i) => (
                <tr key={i} aria-hidden className="border-b border-[var(--auth-divider)] last:border-0">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <span className="h-7 w-7 rounded-md bg-[#eef0f3]" />
                      <span className="h-2.5 w-16 rounded bg-[#eef0f3] sm:w-28" />
                    </div>
                  </td>
                  <td className="hidden px-4 py-3.5 sm:table-cell"><span className="block h-2.5 w-24 rounded bg-[#eef0f3]" /></td>
                  <td className="px-4 py-3.5"><span className="ml-auto block h-2.5 w-14 rounded bg-[#eef0f3]" /></td>
                  <td className="px-4 py-3.5"><span className="block h-5 w-16 rounded-full bg-[#eef0f3]" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-[var(--auth-divider)] px-4 py-3 text-center text-[12px] text-[var(--auth-text-muted)]">
          {t("tableEmpty")}
        </p>
      </CrmPanel>
    </div>
  );
}
