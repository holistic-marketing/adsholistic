import { getTranslations } from "next-intl/server";
import { CrmPanel } from "@/components/dashboard/crm-ui";
import {
  Table,
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


function Head({ children }: { children: React.ReactNode }) {
  return (
    <TableHead className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
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

function MaintenancePill({ label }: { label: string }) {
  return (
    <span className="inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-warn-bg px-2 text-[11px] font-semibold text-warn-fg ring-1 ring-inset ring-warn-line">
      <span className="h-1.5 w-1.5 rounded-full bg-warn-solid" />
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
                className="h-9 w-full cursor-not-allowed rounded-lg border border-[var(--auth-border)] bg-surface pl-9 pr-3 text-[13px] text-[var(--auth-text)] opacity-60"
              />
            </div>
            <select
              disabled
              aria-label={tm("allStatuses")}
              className="h-9 w-full cursor-not-allowed rounded-lg border border-[var(--auth-border)] bg-surface px-3 text-[13px] text-[var(--auth-text)] opacity-60 sm:w-auto"
            >
              <option>{tm("allStatuses")}</option>
            </select>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              disabled
              title={tm("ctaHint")}
              className="inline-flex h-9 cursor-not-allowed items-center justify-center gap-1.5 rounded-lg bg-accent-btn px-3.5 text-[12px] font-semibold text-on-accent opacity-45"
            >
              <LockIcon />
              {tm("cta")}
            </button>
          </div>
        </div>
      </div>

      {/* Cabecera de columnas igual que TikTok (solo escritorio). */}
      <div className="hidden overflow-x-auto md:block">
        <Table embedded className="rounded-none">
          <TableHeader>
            <TableRow className="border-b border-[rgb(20_18_16_/_0.07)] bg-field hover:bg-field">
              <Head>{t("table.account")}</Head>
              <Head>{t("table.colId")}</Head>
              <Head>{t("table.status")}</Head>
              <Head>{t("live.column")}</Head>
              <Head>{t("table.fee")}</Head>
              <Head>{t("table.actions")}</Head>
            </TableRow>
          </TableHeader>
        </Table>
      </div>

      {/* Estado vacío (mismo estilo que TikTok sin cuentas): nada que parezca "cargando". */}
      <div className="px-6 py-12 text-center">
        <div className="mx-auto flex w-fit">
          <MetaMark size={48} />
        </div>
        <div className="mt-4 flex justify-center">
          <MaintenancePill label={tm("badge")} />
        </div>
        <p className="mt-3 text-[14px] font-medium tracking-[-0.01em] text-[var(--auth-text)]">
          {tm("emptyTitle")}
        </p>
        <p className="mx-auto mt-2 max-w-lg text-[13px] leading-5 text-[var(--auth-text-muted)]">
          {tm("emptyBody")}
        </p>
      </div>
    </CrmPanel>
  );
}
