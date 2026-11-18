/**
 * Meta Ads (vía BlueFocus) en AdsHolistic.
 *
 * Mientras BlueFocus no tenga en lista blanca la IP del relay
 * (134.209.108.169) y no se haya probado una recarga real, Meta se muestra
 * en "Cuentas publicitarias" como pestaña en mantenimiento: visible para
 * todos, sin acciones. Para activarlo, cambiar a `false`.
 */
export const META_ADS_MAINTENANCE = true;

export type AdAccountsPlatform = "tiktok" | "meta";

export function resolveAdAccountsPlatform(raw: string | null | undefined): AdAccountsPlatform {
  return raw === "meta" ? "meta" : "tiktok";
}
