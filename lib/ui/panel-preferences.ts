/**
 * Preferencias visuales del panel: tema, contraste y menú plegado.
 * Se guardan en cookies para que el servidor pinte la página ya con el tema
 * correcto (sin parpadeo) y valgan en cualquier pestaña.
 */

export type PanelTheme = "light" | "dark";
export type PanelContrast = "normal" | "alto";
export type PanelRail = "full" | "mini";

export const PANEL_COOKIES = {
  theme: "ah-ui-theme",
  contrast: "ah-ui-contrast",
  rail: "ah-ui-rail",
} as const;

const ONE_YEAR = 60 * 60 * 24 * 365;

export function parsePanelTheme(value: string | undefined | null): PanelTheme {
  return value === "dark" ? "dark" : "light";
}

export function parsePanelContrast(value: string | undefined | null): PanelContrast {
  return value === "alto" ? "alto" : "normal";
}

export function parsePanelRail(value: string | undefined | null): PanelRail {
  return value === "mini" ? "mini" : "full";
}

/** Guarda una preferencia desde el navegador. */
export function writePanelCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax`;
}

/** Aplica tema y contraste al documento sin recargar. */
export function applyPanelTheme(theme: PanelTheme, contrast: PanelContrast) {
  const root = document.documentElement;
  root.dataset.uiTheme = theme;
  if (contrast === "alto") root.dataset.uiContrast = "alto";
  else delete root.dataset.uiContrast;
}
