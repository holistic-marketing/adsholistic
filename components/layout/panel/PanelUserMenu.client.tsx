"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { routes } from "@/config/routes";
import { apiClient } from "@/lib/api/api-client.client";
import { signOutOfClerkIfLoaded } from "@/lib/auth/clerk-sign-out.client";
import { setLocaleAction } from "@/app/actions/locale";
import { localeLabels, locales, type AppLocale } from "@/i18n/config";
import { dashboardPersonaLabel } from "@/types/dashboard-persona";
import type { TesterDashboardMode } from "@/lib/auth/tester-dashboard-mode";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { PanelMenu, PanelPopover, usePopover, type PanelMenuEntry } from "@/components/ui/PanelPopover.client";
import { initialsOf, usePanel } from "./panel-context.client";

/** Ficha de la cuenta al pie del menú: tema, contraste, idioma y salir. */
export function PanelUserMenu() {
  const ts = useTranslations("nav.shell");
  const tMode = useTranslations("nav.modeSwitch");
  const router = useRouter();
  const locale = useLocale() as AppLocale;
  const panel = usePanel();
  const { anchorRef, open: popOpen, toggle: togglePop, close: closePop } = usePopover();
  const [loggingOut, setLoggingOut] = useState(false);
  const [pending, startTransition] = useTransition();

  const asClient = panel.persona === "cliente" && panel.selectedCliente;
  const name = panel.actingAsCliente && panel.selectedCliente ? panel.selectedCliente.name : panel.user.name;
  const sub = panel.isStaff && !panel.actingAsCliente ? dashboardPersonaLabel(panel.sessionPersona) : panel.user.email;
  const dark = panel.theme === "dark";

  async function logout() {
    setLoggingOut(true);
    try {
      // 1) Supabase + cookies Hecom en el servidor; 2) sesión de Clerk en el navegador.
      let redirectTo: string = routes.login;
      try {
        const data = await apiClient<{ ok: boolean; redirectTo: string }>(routes.api.auth.logout, { method: "POST" });
        redirectTo = data.redirectTo;
      } catch {
        // Igual cerramos Clerk y salimos al login.
      }
      if (await signOutOfClerkIfLoaded(redirectTo)) return;
      router.push(redirectTo);
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  function changeLocale(next: AppLocale) {
    if (next === locale) return;
    startTransition(async () => {
      await setLocaleAction(next);
      router.refresh();
    });
  }

  function changeMode(next: TesterDashboardMode) {
    if (next === panel.testerMode) return;
    startTransition(async () => {
      try {
        await fetch("/api/session/dashboard-mode", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: next }),
        });
      } finally {
        router.refresh();
      }
    });
  }

  const run = (action: () => void) => () => {
    closePop();
    action();
  };

  const items: PanelMenuEntry[] = [
    { label: dark ? ts("themeLight") : ts("themeDark"), icon: dark ? "sun" : "moon", onSelect: run(panel.toggleTheme) },
    {
      label: panel.contrast === "alto" ? ts("contrastOff") : ts("contrastOn"),
      icon: "contrast",
      onSelect: run(panel.toggleContrast),
    },
  ];

  // El equipo trabaja siempre en español; el cliente elige su idioma.
  if (panel.persona === "cliente") {
    items.push("separator");
    for (const code of locales) {
      items.push({
        label: localeLabels[code],
        icon: code === locales[0] ? "languages" : undefined,
        inset: true,
        checked: code === locale,
        disabled: pending,
        onSelect: run(() => changeLocale(code)),
      });
    }
  }

  if (panel.canSwitchMode) {
    items.push("separator");
    for (const mode of ["cliente", "gerente"] as const) {
      items.push({
        label: `${ts("testerMode")}: ${tMode(mode)}`,
        inset: true,
        checked: panel.testerMode === mode,
        disabled: pending,
        onSelect: run(() => changeMode(mode)),
      });
    }
  }

  items.push("separator", {
    label: loggingOut ? ts("loggingOut") : ts("logout"),
    icon: "logout",
    disabled: loggingOut,
    onSelect: run(() => void logout()),
  });

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="panel-user"
        aria-haspopup="menu"
        aria-expanded={popOpen}
        aria-label={ts("accountMenu", { name })}
        onClick={togglePop}
      >
        <span className="panel-avatar" aria-hidden>
          {initialsOf(name) || panel.user.avatarInitials}
        </span>
        <span data-rail-label className="grid min-w-0 flex-1 text-left leading-tight">
          <b className="truncate text-[13px] font-semibold">{name}</b>
          <small className="truncate text-xs text-ink-3">{sub}</small>
        </span>
        <PanelIcon name="dots-v" data-rail-label className="text-ink-3" />
      </button>
      <PanelPopover anchorRef={anchorRef} open={popOpen} onClose={closePop} label={ts("yourAccount")} align="fit" minWidth={232}>
        <div className="border-b border-line px-3 py-2.5 leading-snug">
          <b className="block truncate font-semibold">{name}</b>
          <small className="block truncate text-xs text-ink-3">{panel.user.email}</small>
          <span className="mt-1.5 inline-flex h-[22px] items-center rounded-full border border-line bg-subtle px-2 text-xs font-medium">
            {asClient || !panel.isStaff ? ts("roleClient") : ts("roleAdmin", { role: dashboardPersonaLabel(panel.sessionPersona) })}
          </span>
        </div>
        <PanelMenu label={ts("yourAccount")} items={items} />
      </PanelPopover>
    </>
  );
}
