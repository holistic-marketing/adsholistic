"use client";

import { createContext, useContext } from "react";
import type { DashboardPersona } from "@/types/dashboard-persona";
import type { TesterDashboardMode } from "@/lib/auth/tester-dashboard-mode";
import type { NavGroup } from "@/types/navigation";
import type { PanelContrast, PanelTheme } from "@/lib/ui/panel-preferences";
import type { User } from "@/types/user";

export interface PanelCliente {
  id: string;
  name: string;
}

export interface PanelContextValue {
  user: User;
  /** Persona con la que se pinta el panel (cliente si el equipo entra «como cliente»). */
  persona: DashboardPersona;
  /** Persona real de la sesión. */
  sessionPersona: DashboardPersona;
  /** Quien opera es del equipo (gerente o super admin), entre o no como cliente. */
  isStaff: boolean;
  actingAsCliente: boolean;
  selectedCliente: PanelCliente | null;
  navigation: NavGroup[];
  canSwitchMode: boolean;
  testerMode: TesterDashboardMode;
  theme: PanelTheme;
  contrast: PanelContrast;
  busy: boolean;
  error: string | null;
  toggleTheme: () => void;
  toggleContrast: () => void;
  openPalette: () => void;
  openClientPicker: (asClient?: boolean) => void;
  selectCliente: (cliente: PanelCliente, options?: { asClient?: boolean }) => void;
  clearCliente: () => void;
  setActAsCliente: (value: boolean) => void;
  go: (href: string) => void;
}

export const PanelContext = createContext<PanelContextValue | null>(null);

export function usePanel(): PanelContextValue {
  const value = useContext(PanelContext);
  if (!value) throw new Error("usePanel debe usarse dentro de <PanelShell>.");
  return value;
}

/** Iniciales para el avatar: dos palabras, en mayúsculas. */
export function initialsOf(name: string): string {
  return name
    .split(/[\s.@_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
