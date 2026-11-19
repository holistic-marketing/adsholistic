import "server-only";
import { cookies } from "next/headers";
import {
  PANEL_COOKIES,
  parsePanelContrast,
  parsePanelRail,
  parsePanelTheme,
  type PanelContrast,
  type PanelRail,
  type PanelTheme,
} from "./panel-preferences";

export async function readPanelPreferences(): Promise<{
  theme: PanelTheme;
  contrast: PanelContrast;
  rail: PanelRail;
}> {
  const store = await cookies();
  return {
    theme: parsePanelTheme(store.get(PANEL_COOKIES.theme)?.value),
    contrast: parsePanelContrast(store.get(PANEL_COOKIES.contrast)?.value),
    rail: parsePanelRail(store.get(PANEL_COOKIES.rail)?.value),
  };
}
