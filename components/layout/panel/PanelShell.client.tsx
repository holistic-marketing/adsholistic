"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { routes } from "@/config/routes";
import { flattenNavigation, navigationFor } from "@/config/navigation";
import { HomeScreenAppBanner } from "@/features/push/HomeScreenAppBanner.client";
import { InAppPushToasts } from "@/features/push/InAppPushToasts.client";
import {
  PANEL_COOKIES,
  applyPanelTheme,
  writePanelCookie,
  type PanelContrast,
  type PanelRail,
  type PanelTheme,
} from "@/lib/ui/panel-preferences";
import type { DashboardPersona } from "@/types/dashboard-persona";
import type { TesterDashboardMode } from "@/lib/auth/tester-dashboard-mode";
import type { User } from "@/types/user";
import { PanelContext, type PanelCliente, type PanelContextValue } from "./panel-context.client";
import { PanelRail as Rail } from "./PanelRail.client";
import { PanelTopbar } from "./PanelTopbar.client";
import { PanelCommandPalette } from "./PanelCommandPalette.client";
import { PanelClientPicker } from "./PanelClientPicker.client";

const FloatingSupportStack = dynamic(
  () => import("@/components/floating/FloatingSupportStack.client").then((m) => m.FloatingSupportStack),
  { ssr: false },
);

const SMALL_SCREEN = "(max-width: 959px)";

export interface PanelShellProps {
  user: User;
  persona: DashboardPersona;
  sessionPersona: DashboardPersona;
  actingAsCliente: boolean;
  selectedCliente: PanelCliente | null;
  canSwitchMode: boolean;
  testerMode: TesterDashboardMode;
  showAlliances: boolean;
  preferences: { theme: PanelTheme; contrast: PanelContrast; rail: PanelRail };
  children: ReactNode;
}

/** Armazón del panel: menú lateral, marco con barra superior y capas globales. */
export function PanelShell({
  user,
  persona,
  sessionPersona,
  actingAsCliente,
  selectedCliente,
  canSwitchMode,
  testerMode,
  showAlliances,
  preferences,
  children,
}: PanelShellProps) {
  const t = useTranslations("nav.shell");
  const router = useRouter();
  const pathname = usePathname();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<PanelTheme>(preferences.theme);
  const [contrast, setContrast] = useState<PanelContrast>(preferences.contrast);
  const [rail, setRail] = useState<PanelRail>(preferences.rail);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [picker, setPicker] = useState<{ open: boolean; asClient: boolean }>({ open: false, asClient: false });

  const isStaff = sessionPersona !== "cliente";
  const navigation = useMemo(() => navigationFor(persona, { showAlliances }), [persona, showAlliances]);

  // Al navegar se cierra el menú del celular.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setDrawerOpen(false);
  }

  useEffect(() => {
    if (!drawerOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  // Atajos: Ctrl/⌘ K abre el buscador; Esc cierra el menú del celular;
  // «/» lleva al primer buscador de la página.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && !event.altKey && key === "k") {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (event.key === "Escape" && drawerOpen) {
        setDrawerOpen(false);
        return;
      }
      const active = document.activeElement as HTMLElement | null;
      if (
        event.key === "/" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !document.querySelector("dialog[open]") &&
        !/^(INPUT|TEXTAREA|SELECT)$/.test(active?.tagName ?? "") &&
        !active?.isContentEditable
      ) {
        const search = document.querySelector<HTMLInputElement>("#contenido input[type='search']");
        if (search) {
          event.preventDefault();
          search.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  const toggleRail = useCallback(() => {
    if (window.matchMedia(SMALL_SCREEN).matches) {
      setDrawerOpen((open) => !open);
      return;
    }
    setRail((current) => {
      const next = current === "mini" ? "full" : "mini";
      writePanelCookie(PANEL_COOKIES.rail, next);
      return next;
    });
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyPanelTheme(next, contrast);
    writePanelCookie(PANEL_COOKIES.theme, next);
  }, [theme, contrast]);

  const toggleContrast = useCallback(() => {
    const next = contrast === "alto" ? "normal" : "alto";
    setContrast(next);
    applyPanelTheme(theme, next);
    writePanelCookie(PANEL_COOKIES.contrast, next);
  }, [theme, contrast]);

  const go = useCallback((href: string) => router.push(href), [router]);

  // Cambiar de cliente o de vista: se guarda en la sesión y se recarga el panel.
  const postSelection = useCallback(
    (body: Record<string, unknown>, after: () => void) => {
      setError(null);
      startTransition(async () => {
        try {
          const res = await fetch("/api/clientes/seleccionar", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
          if (!res.ok || !json.ok) {
            setError(json.error ?? t("switchError"));
            return;
          }
          after();
          router.refresh();
        } catch {
          setError(t("switchError"));
        }
      });
    },
    [router, t],
  );

  // Rutas que ve un cliente: si el equipo entra «como cliente» desde una
  // sección de gerencia, se lo lleva al resumen.
  const clienteHrefs = useMemo(
    () => new Set(flattenNavigation(navigationFor("cliente", { showAlliances: true })).map((entry) => entry.href)),
    [],
  );
  const leaveIfHiddenForCliente = useCallback(() => {
    const allowed = [...clienteHrefs].some((href) => pathname === href || pathname.startsWith(`${href}/`));
    if (!allowed) router.push(routes.overview);
  }, [clienteHrefs, pathname, router]);

  const selectCliente = useCallback<PanelContextValue["selectCliente"]>(
    (cliente, options = {}) => {
      const body: Record<string, unknown> = { clienteId: cliente.id, name: cliente.name };
      if (options.asClient !== undefined) body.actAsCliente = options.asClient;
      postSelection(body, () => {
        if (options.asClient) leaveIfHiddenForCliente();
        else if (pathname === routes.clientes) router.push(routes.overview);
      });
    },
    [postSelection, leaveIfHiddenForCliente, pathname, router],
  );

  const setActAsCliente = useCallback(
    (value: boolean) => {
      if (value && !selectedCliente) {
        setPicker({ open: true, asClient: true });
        return;
      }
      postSelection({ actAsCliente: value }, () => {
        if (value) leaveIfHiddenForCliente();
      });
    },
    [postSelection, selectedCliente, leaveIfHiddenForCliente],
  );

  const clearCliente = useCallback(() => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/clientes/seleccionar", { method: "DELETE", credentials: "include" });
        if (!res.ok) {
          setError(t("switchError"));
          return;
        }
        router.refresh();
      } catch {
        setError(t("switchError"));
      }
    });
  }, [router, t]);

  const value: PanelContextValue = {
    user,
    persona,
    sessionPersona,
    isStaff,
    actingAsCliente,
    selectedCliente,
    navigation,
    canSwitchMode,
    testerMode,
    theme,
    contrast,
    busy,
    error,
    toggleTheme,
    toggleContrast,
    openPalette: () => setPaletteOpen(true),
    openClientPicker: (asClient = false) => setPicker({ open: true, asClient }),
    selectCliente,
    clearCliente,
    setActAsCliente,
    go,
  };

  const fullBleed = pathname === routes.linksDeuda;
  const flush = pathname === routes.assistant;

  return (
    <PanelContext.Provider value={value}>
      <a href="#contenido" className="panel-skip">
        {t("skip")}
      </a>
      <div
        className="dashboard-canvas panel-app"
        data-rail={rail}
        data-rail-open={drawerOpen ? "" : undefined}
      >
        <Rail id="panel-rail" />
        {drawerOpen ? (
          <div className="panel-scrim" aria-hidden onClick={() => setDrawerOpen(false)} />
        ) : null}

        <div className="panel-frame">
          <PanelTopbar
            railMini={rail === "mini"}
            drawerOpen={drawerOpen}
            onToggleRail={toggleRail}
          />
          <main
            id="contenido"
            tabIndex={-1}
            className={
              fullBleed
                ? "app-content flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden p-4"
                : flush
                  ? "app-content w-full min-w-0 flex-1"
                  : "app-content panel-main"
            }
          >
            {error ? (
              <p role="alert" className="mb-4 rounded-box border border-danger-line bg-danger-bg px-3 py-2.5 text-[13px] text-danger-fg">
                {error}
              </p>
            ) : null}
            {children}
          </main>
        </div>
      </div>

      <PanelCommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <PanelClientPicker
        open={picker.open}
        asClient={picker.asClient}
        onClose={() => setPicker((current) => ({ ...current, open: false }))}
      />
      <FloatingSupportStack persona={persona} />
      <HomeScreenAppBanner />
      <InAppPushToasts />
    </PanelContext.Provider>
  );
}
