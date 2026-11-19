"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { findActiveNavItem } from "@/config/navigation";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { PanelPopover, usePopover } from "@/components/ui/PanelPopover.client";
import { usePanel } from "./panel-context.client";
import { PanelNotifications } from "./PanelNotifications.client";
import { normalizeSearch, useQuickActions } from "./use-quick-actions.client";

const SMALL_SCREEN = "(max-width: 959px)";
function subscribeSmall(onChange: () => void) {
  const query = window.matchMedia(SMALL_SCREEN);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const isSmallScreen = () => window.matchMedia(SMALL_SCREEN).matches;

/** Barra superior del marco: menú, ubicación, cliente en contexto y acciones. */
export function PanelTopbar({
  railMini,
  drawerOpen,
  onToggleRail,
}: {
  railMini: boolean;
  drawerOpen: boolean;
  onToggleRail: () => void;
}) {
  const ts = useTranslations("nav.shell");
  const panel = usePanel();
  const dark = panel.theme === "dark";
  // En pantallas chicas el botón abre y cierra el cajón; en grandes, pliega el menú.
  const small = useSyncExternalStore(subscribeSmall, isSmallScreen, () => false);
  const toggleLabel = small
    ? drawerOpen
      ? ts("closeMenu")
      : ts("openMenu")
    : railMini
      ? ts("expand")
      : ts("collapse");

  return (
    <header className="panel-topbar">
      <button
        type="button"
        className="panel-icon-btn"
        aria-controls="panel-rail"
        aria-expanded={small ? drawerOpen : !railMini}
        aria-label={toggleLabel}
        onClick={onToggleRail}
      >
        <PanelIcon name="panel-left" />
      </button>
      <span className="panel-vsep" aria-hidden />
      <Crumbs />
      <span className="flex-1" />
      <ClienteContext />
      <QuickCreate />
      <span className="panel-vsep" aria-hidden />
      <PanelNotifications />
      <button
        type="button"
        className="panel-icon-btn panel-icon-btn--bordered"
        aria-label={dark ? ts("themeLight") : ts("themeDark")}
        title={dark ? ts("themeLight") : ts("themeDark")}
        onClick={panel.toggleTheme}
      >
        <PanelIcon name={dark ? "sun" : "moon"} />
      </button>
    </header>
  );
}

/* --- Ubicación: «Finanzas › Pagos manuales» o «Clientes › Detalle» --------- */

function Crumbs() {
  const t = useTranslations("nav");
  const ts = useTranslations("nav.shell");
  const pathname = usePathname();
  const panel = usePanel();
  const active = findActiveNavItem(panel.navigation, pathname);
  const label = active ? t(active.labelKey ?? active.key) : t("overview");
  const detail = active && pathname !== active.href;
  const parent = active?.parent && panel.persona !== "cliente" ? t(active.parent.labelKey ?? active.parent.key) : null;

  return (
    <nav className="panel-crumbs" aria-label={ts("location")}>
      {parent ? (
        <>
          <span className="text-ink-3 max-md:hidden">{parent}</span>
          <PanelIcon name="chevron-right" className="size-3.5 text-ink-3 max-md:hidden" />
        </>
      ) : null}
      {detail && active ? (
        <>
          <Link href={active.href} className="text-ink-3 hover:text-ink max-md:hidden">
            {label}
          </Link>
          <PanelIcon name="chevron-right" className="size-3.5 text-ink-3 max-md:hidden" />
          <b aria-current="page" className="truncate font-medium">
            {ts("detail")}
          </b>
        </>
      ) : (
        <b aria-current="page" className="truncate font-medium">
          {label}
        </b>
      )}
    </nav>
  );
}

/* --- Cliente en contexto (equipo) o aviso de vista de cliente ------------- */

function ClienteContext() {
  const ts = useTranslations("nav.shell");
  const panel = usePanel();
  const cliente = panel.selectedCliente;

  if (!panel.isStaff) return null;

  if (panel.actingAsCliente && cliente) {
    return (
      <span className="panel-badge tone-accent" title={ts("clientViewBadge")}>
        <PanelIcon name="eye" className="size-3" />
        <span className="max-md:hidden">{ts("clientViewBadge")}</span>
      </span>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <button
        type="button"
        className={cn("panel-btn panel-btn--sm max-w-[280px]", !cliente && "panel-btn--ghost")}
        aria-label={cliente ? ts("clientInContext", { name: cliente.name }) : ts("pickClientAria")}
        disabled={panel.busy}
        onClick={() => panel.openClientPicker(false)}
      >
        <PanelIcon name="user" />
        <span className="truncate max-md:hidden">{cliente ? cliente.name : ts("allClients")}</span>
        <PanelIcon name="chevrons" className="text-ink-3" />
      </button>
      {cliente ? (
        <button
          type="button"
          className="panel-icon-btn"
          aria-label={ts("leaveClient")}
          title={ts("leaveClient")}
          disabled={panel.busy}
          onClick={panel.clearCliente}
        >
          <PanelIcon name="x" />
        </button>
      ) : null}
    </div>
  );
}

/* --- Creación rápida -------------------------------------------------------- */

function QuickCreate() {
  const ts = useTranslations("nav.shell");
  const { anchorRef, open: popOpen, toggle: togglePop, close: closePop } = usePopover();
  const groups = useQuickActions();
  const [query, setQuery] = useState("");
  const q = normalizeSearch(query);
  const visible = groups
    .map((group) => ({
      ...group,
      actions: group.actions.filter((action) => normalizeSearch(`${action.title} ${action.hint}`).includes(q)),
    }))
    .filter((group) => group.actions.length > 0);

  function close() {
    closePop();
    setQuery("");
  }

  function run(action: { run: () => void }) {
    close();
    action.run();
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="panel-btn panel-btn--primary panel-btn--sm shadow-glow"
        aria-haspopup="dialog"
        aria-expanded={popOpen}
        aria-label={ts("quickCreate")}
        onClick={togglePop}
      >
        <PanelIcon name="plus" />
        <span className="max-md:hidden">{ts("quickCreate")}</span>
      </button>
      <PanelPopover anchorRef={anchorRef} open={popOpen} onClose={close} label={ts("quickCreate")} align="end" minWidth={320}>
        <div className="w-[420px] max-w-[calc(100vw-16px)]">
          <div className="px-3 pb-2.5 pt-3">
            <b className="block text-sm font-semibold">{ts("quickCreate")}</b>
            <small className="text-xs text-ink-3">{ts("quickCreateHint")}</small>
            <label className="panel-search mt-2.5">
              <span className="sr-only">{ts("quickSearch")}</span>
              <PanelIcon name="search" />
              <input
                type="search"
                data-autofocus
                value={query}
                placeholder={ts("quickSearch")}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  const first = visible[0]?.actions[0];
                  if (event.key === "Enter" && first) {
                    event.preventDefault();
                    run(first);
                  }
                }}
              />
            </label>
          </div>
          <div className="max-h-[min(60vh,420px)] overflow-y-auto border-t border-line px-2 pb-2">
            {visible.map((group) => (
              <div key={group.label}>
                <p className="px-1.5 pb-1.5 pt-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3">
                  {group.label}
                </p>
                <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
                  {group.actions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      className="flex items-start gap-2.5 rounded-ctl px-1.5 py-2 text-left outline-none hover:bg-hover focus-visible:bg-hover"
                      onClick={() => run(action)}
                    >
                      <span className="panel-sqi" aria-hidden>
                        <PanelIcon name={action.icon} />
                      </span>
                      <span className="grid min-w-0 leading-tight">
                        <b className="text-[13px] font-medium">{action.title}</b>
                        <small className="text-xs text-ink-3">{action.hint}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {visible.length === 0 ? <p className="px-1.5 py-4 text-ink-3">{ts("quickNone")}</p> : null}
          </div>
          <div className="flex justify-center gap-3 border-t border-line p-2 text-[11px] text-ink-3">
            <span>
              <kbd>Enter</kbd> {ts("enterToPick")}
            </span>
            <span>
              <kbd>Esc</kbd> {ts("escToClose")}
            </span>
          </div>
        </div>
      </PanelPopover>
    </>
  );
}
