import { getTranslations } from "next-intl/server";
import { CrmPanel } from "@/components/dashboard/crm-ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { MetaMark } from "./platform-marks";

/**
 * Pestaña Meta mientras la integración BlueFocus está en mantenimiento.
 * Mismo esqueleto visual que la tabla TikTok (panel, barra de filtros, franja
 * informativa, columnas) para que al activarse el cliente ya lo reconozca.
 */

const SKELETON_ROWS = 3;
const bar = "rounded bg-[#efe9e2]";

function Head({ children }: { children: React.ReactNode }) {
  return (
    <TableHead className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a8178]">
      {children}
    </TableHead>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function SkeletonAccount() {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <MetaMark size={24} />
      <div className="min-w-0 space-y-1.5">
        <span className={`block h-3 w-28 ${bar}`} />
        <span className={`block h-2.5 w-16 ${bar}`} />
      </div>
    </div>
  );
}

function MaintenancePill({ label }: { label: string }) {
  return (
    <span className="inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-amber-50 px-2 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      {label}
    </span>
  );
}

export async function MetaMaintenancePanel({ clienteName }: { clienteName?: string }) {
  const t = await getTranslations("adAccounts");
  const tm = await getTranslations("adAccounts.metaMaintenance");

  return (
    <CrmPanel
      title={clienteName ? tm("tableTitle", { name: clienteName }) : tm("tableTitleGeneric")}
      subtitle={t("panel.subtitle")}
      className="overflow-hidden"
    >
      {/* Barra de filtros (igual que TikTok, deshabilitada). */}
      <div className="border-b border-[var(--auth-border)] bg-[var(--auth-bg)] px-4 py-3.5 sm:px-5">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--auth-text-soft)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                disabled
                placeholder={t("toolbar.search")}
                aria-label={t("toolbar.search")}
                className="h-9 w-full cursor-not-allowed rounded-lg border border-[var(--auth-border)] bg-white pl-9 pr-3 text-[13px] text-[var(--auth-text)] opacity-60"
              />
            </div>
            <select
              disabled
              aria-label={tm("allStatuses")}
              className="h-9 w-full cursor-not-allowed rounded-lg border border-[var(--auth-border)] bg-white px-3 text-[13px] text-[var(--auth-text)] opacity-60 sm:w-auto"
            >
              <option>{tm("allStatuses")}</option>
            </select>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              disabled
              title={tm("ctaHint")}
              className="inline-flex h-9 cursor-not-allowed items-center justify-center gap-1.5 rounded-lg bg-[var(--auth-accent)] px-3.5 text-[12px] font-semibold text-white opacity-45"
            >
              <LockIcon />
              {tm("cta")}
            </button>
          </div>
        </div>
      </div>

      {/* Franja informativa (mismo lugar y estilo que "Saldo en vivo TikTok"). */}
      <div className="mx-3 mb-2 mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-[12px] leading-5 text-[#5c564e] md:mx-4 md:mb-3 md:px-4 md:py-3">
        <p>
          <span className="font-semibold text-[#1a1612]">{tm("bannerTitle")}</span>
          {" · "}
          {tm("bannerBody")}
        </p>
        <MaintenancePill label={tm("badge")} />
      </div>

      {/* Celular: tarjetas como TikTok. */}
      <div aria-hidden className="space-y-2.5 px-3 pb-4 pt-1 md:hidden">
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
          <article key={i} className="rounded-xl border border-[rgb(20_18_16_/_0.08)] bg-white p-3.5">
            <div className="flex items-start justify-between gap-3">
              <SkeletonAccount />
              <MaintenancePill label={tm("badgeShort")} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className={`h-4 w-24 ${bar}`} />
              <span className="h-4 w-12 rounded bg-[#fff1e8]" />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-[#faf7f3] px-3 py-2.5">
              <div className="min-w-0 space-y-1.5">
                <p className="text-[11px] text-[#9a9187]">{t("live.column")}</p>
                <span className={`block h-3.5 w-16 ${bar}`} />
              </div>
              <span className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#f0d9c8] px-3 text-[12px] font-semibold text-[#c45a18] opacity-50">
                <LockIcon />
                {tm("rechargeShort")}
              </span>
            </div>
          </article>
        ))}
      </div>

      {/* Escritorio: tabla con las mismas columnas que TikTok. */}
      <div aria-hidden className="hidden overflow-x-auto md:block">
        <Table embedded className="rounded-none">
          <TableHeader>
            <TableRow className="border-b border-[rgb(20_18_16_/_0.07)] bg-[#faf7f3] hover:bg-[#faf7f3]">
              <Head>{t("table.account")}</Head>
              <Head>{t("table.colId")}</Head>
              <Head>{t("table.status")}</Head>
              <Head>{t("live.column")}</Head>
              <Head>{t("table.fee")}</Head>
              <Head>{t("table.actions")}</Head>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: SKELETON_ROWS }, (_, i) => (
              <TableRow key={i} className="border-b border-[rgb(20_18_16_/_0.05)] hover:bg-transparent">
                <TableCell className="max-w-[280px]">
                  <SkeletonAccount />
                </TableCell>
                <TableCell>
                  <span className={`block h-4 w-24 ${bar}`} />
                </TableCell>
                <TableCell>
                  <MaintenancePill label={tm("badgeShort")} />
                </TableCell>
                <TableCell>
                  <span className={`block h-3.5 w-16 ${bar}`} />
                  <span className={`mt-1.5 block h-2.5 w-20 ${bar}`} />
                </TableCell>
                <TableCell>
                  <span className="block h-4 w-12 rounded bg-[#fff1e8]" />
                </TableCell>
                <TableCell>
                  <span className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#f0d9c8] px-3 text-[12px] font-semibold text-[#c45a18] opacity-50">
                    <LockIcon />
                    {tm("rechargeShort")}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="border-t border-[rgb(20_18_16_/_0.06)] px-4 py-3 text-center text-[12px] text-[#9a9187]">
        {tm("tableEmpty")}
      </p>
    </CrmPanel>
  );
}
