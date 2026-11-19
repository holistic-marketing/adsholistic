"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { findActiveNavItem } from "@/config/navigation";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { PanelMenu, PanelPopover, usePopover } from "@/components/ui/PanelPopover.client";
import type { NavItem } from "@/types/navigation";
import { usePanel } from "./panel-context.client";
import { PanelUserMenu } from "./PanelUserMenu.client";

const OPEN_GROUPS_KEY = "ah-ui-nav-open";

function readOpenGroups(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(OPEN_GROUPS_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

const noopSubscribe = () => () => {};
function useIsMac() {
  return useSyncExternalStore(
    noopSubscribe,
    () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
    () => false,
  );
}

/**
 * Enlace del menú que precarga la sección completa solo cuando el usuario
 * muestra intención (pasa el mouse, enfoca o toca). Antes se precargaban
 * TODAS las secciones al entrar: ~20 páginas armándose a la vez en el servidor
 * (algunas llaman a TikTok) y la entrada al panel se ponía lenta.
 */
function IntentLink(props: React.ComponentProps<typeof Link>) {
  const [active, setActive] = useState(false);
  const arm = () => setActive(true);
  return (
    <Link
      {...props}
      prefetch={active ? true : false}
      onMouseEnter={arm}
      onFocus={arm}
      onTouchStart={arm}
    />
  );
}

/** Menú lateral: marca, vista, secciones, buscador y cuenta. */
export function PanelRail({ id }: { id: string }) {
  const t = useTranslations("nav");
  const ts = useTranslations("nav.shell");
  const pathname = usePathname();
  const panel = usePanel();
  const isMac = useIsMac();
  const active = findActiveNavItem(panel.navigation, pathname);

  // Grupos plegables abiertos (Finanzas). Se recuerdan en este navegador y se
  // abren solos si la página actual está dentro.
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage solo existe en el cliente
    setOpenGroups(readOpenGroups());
  }, []);
  const parentKey = active?.parent?.key;
  const isOpen = (key: string) => openGroups.includes(key) || parentKey === key;
  function toggleGroup(key: string) {
    setOpenGroups((current) => {
      const next = isOpen(key) ? current.filter((k) => k !== key) : [...current, key];
      try {
        localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(next));
      } catch {
        // sin almacenamiento: el grupo se abre igual, solo no se recuerda
      }
      return next;
    });
  }

  const labelOf = (entry: NavItem) => t(entry.labelKey ?? entry.key);

  function link(entry: NavItem, sub = false) {
    const current = active?.href === entry.href;
    const label = labelOf(entry);
    return (
      <li key={entry.href}>
        <IntentLink
          href={entry.href}
          title={label}
          aria-current={current ? "page" : undefined}
          className={cn("panel-navlink", sub && "panel-navlink--sub")}
        >
          {sub ? null : <PanelIcon name={entry.icon} />}
          <span data-rail-label className="min-w-0 flex-1 truncate">
            {label}
          </span>
        </IntentLink>
      </li>
    );
  }

  return (
    <aside id={id} className="panel-rail" aria-label={ts("mainMenu")}>
      <div className="panel-rail-head">
        <Link href={routes.overview} className="flex min-w-0 items-center gap-2" aria-label={ts("home")}>
          <span data-rail-mini className="panel-mark" aria-hidden>
            h
          </span>
          <Image
            data-rail-label
            src={siteConfig.logoSrc}
            alt=""
            width={506}
            height={183}
            priority
            className="h-[30px] w-auto max-w-[150px]"
          />
        </Link>
      </div>

      <ViewSwitch />

      <nav className="panel-nav ui-scroll" aria-label={ts("sections")}>
        {panel.navigation.map((group) => (
          <div key={group.key} className="panel-nav-group">
            <p className="panel-nav-label" id={`ng-${group.key}`} data-rail-label>
              {t(`groups.${group.key}`)}
            </p>
            <ul aria-labelledby={`ng-${group.key}`}>
              {group.items.map((entry) => {
                if (!entry.children) return link(entry);
                const open = isOpen(entry.key);
                const label = labelOf(entry);
                return (
                  <li key={entry.key}>
                    <button
                      type="button"
                      className="panel-navlink"
                      aria-expanded={open}
                      aria-controls={`ns-${entry.key}`}
                      title={label}
                      onClick={() => toggleGroup(entry.key)}
                    >
                      <PanelIcon name={entry.icon} />
                      <span data-rail-label className="min-w-0 flex-1 truncate">
                        {label}
                      </span>
                      <PanelIcon
                        name="chevron-right"
                        data-rail-label
                        className={cn("text-ink-3 transition-transform", open && "rotate-90")}
                      />
                    </button>
                    <ul id={`ns-${entry.key}`} className="panel-nav-sub" hidden={!open}>
                      {entry.children.map((child) => link(child, true))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="panel-rail-foot">
        <button
          type="button"
          className="panel-navlink text-ink-2"
          onClick={panel.openPalette}
          aria-label={ts("searchAria")}
        >
          <PanelIcon name="search" />
          <span data-rail-label className="flex-1 text-left">
            {ts("search")}
          </span>
          <kbd data-rail-label aria-hidden>
            {isMac ? "⌘K" : "Ctrl K"}
          </kbd>
        </button>
        <PanelUserMenu />
      </div>
    </aside>
  );
}

/* --- Selector de vista ------------------------------------------------------ */

function ViewSwitch() {
  const ts = useTranslations("nav.shell");
  const panel = usePanel();
  const { anchorRef, open: popOpen, toggle: togglePop, close: closePop } = usePopover();
  const cliente = panel.selectedCliente;

  // El cliente no cambia de vista: ve a qué negocio pertenece el panel.
  if (!panel.isStaff) {
    if (!cliente) return null;
    return (
      <div className="panel-viewsw" data-static>
        <span className="panel-sqi tone-accent" aria-hidden>
          <PanelIcon name="user" />
        </span>
        <span data-rail-label className="grid min-w-0 flex-1 leading-tight">
          <small className="text-[11px] text-ink-3">{ts("yourAccount")}</small>
          <b className="truncate text-[13px] font-semibold">{cliente.name}</b>
        </span>
      </div>
    );
  }

  const asClient = panel.actingAsCliente && Boolean(cliente);
  const viewLabel = asClient && cliente ? ts("viewClientOf", { name: cliente.name }) : ts("viewAdmin");

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="panel-viewsw"
        aria-haspopup="menu"
        aria-expanded={popOpen}
        aria-label={ts("viewChange", { view: viewLabel })}
        disabled={panel.busy}
        onClick={togglePop}
      >
        <span className={cn("panel-sqi", asClient && "tone-accent")} aria-hidden>
          <PanelIcon name={asClient ? "user" : "building"} />
        </span>
        <span data-rail-label className="grid min-w-0 flex-1 text-left leading-tight">
          <small className="text-[11px] text-ink-3">{ts("view")}</small>
          <b className="truncate text-[13px] font-semibold">{viewLabel}</b>
        </span>
        <PanelIcon name="chevrons" data-rail-label className="text-ink-3" />
      </button>
      <PanelPopover anchorRef={anchorRef} open={popOpen} onClose={closePop} label={ts("view")} align="fit" minWidth={264}>
        <PanelMenu
          label={ts("view")}
          items={[
            {
              label: ts("viewAdmin"),
              hint: ts("viewAdminHint"),
              icon: "building",
              checked: !asClient,
              onSelect: () => {
                closePop();
                if (asClient) panel.setActAsCliente(false);
              },
            },
            {
              label: ts("viewClient"),
              hint: cliente ? ts("viewClientHint", { name: cliente.name }) : ts("viewClientHintNoClient"),
              icon: "user",
              checked: asClient,
              onSelect: () => {
                closePop();
                if (!asClient) panel.setActAsCliente(true);
              },
            },
            ...(asClient
              ? [
                  "separator" as const,
                  {
                    label: ts("viewOtherClient"),
                    icon: "users" as const,
                    onSelect: () => {
                      closePop();
                      panel.openClientPicker(true);
                    },
                  },
                ]
              : []),
          ]}
        />
      </PanelPopover>
    </>
  );
}
