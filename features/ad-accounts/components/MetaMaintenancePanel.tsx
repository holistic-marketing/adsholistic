import { getTranslations } from "next-intl/server";
import { buttonClass } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { FilterBar, SearchField, ToneBadge } from "@/components/ui/PanelKit";
import { MetaMark } from "./platform-marks";

/**
 * Pestaña Meta mientras la integración BlueFocus está en mantenimiento.
 * Mismo esqueleto v3 que TikTok (barra de filtros y tarjeta de la tabla, aquí
 * en su estado vacío) para que al activarse el cliente ya lo reconozca.
 */
export async function MetaMaintenancePanel({ clienteName }: { clienteName?: string }) {
  const t = await getTranslations("adAccounts");
  const tm = await getTranslations("adAccounts.metaMaintenance");
  const title = clienteName ? tm("tableTitle", { name: clienteName }) : tm("tableTitleGeneric");

  return (
    <section aria-labelledby="meta-accounts-title" className="space-y-4">
      <h2 id="meta-accounts-title" className="sr-only">
        {title}
      </h2>

      {/* Filtros deshabilitados: los mismos de TikTok. */}
      <FilterBar
        tools={
          <button type="button" disabled title={tm("ctaHint")} className={buttonClass("primary", "md", "max-sm:w-full")}>
            <PanelIcon name="clock" />
            {tm("cta")}
          </button>
        }
      >
        <SearchField label={t("toolbar.search").replace(/…$/, "")} disabled className="cursor-not-allowed opacity-60" />
        <div className="shrink-0 max-sm:flex-1">
          <Select disabled aria-label={tm("allStatuses")}>
            <option>{tm("allStatuses")}</option>
          </Select>
        </div>
      </FilterBar>

      {/* Estado vacío de la tabla: nada que parezca «cargando». */}
      <div className="rounded-card border border-line bg-surface shadow-card">
        <div className="grid justify-items-center gap-1 px-6 py-12 text-center">
          <MetaMark size={40} />
          <span className="mb-1 mt-3">
            <ToneBadge tone="warn" dot>
              {tm("badge")}
            </ToneBadge>
          </span>
          <p className="text-lg font-semibold tracking-[-0.015em] text-ink">{tm("emptyTitle")}</p>
          <p className="max-w-[52ch] text-ink-2">{tm("emptyBody")}</p>
        </div>
      </div>
    </section>
  );
}
