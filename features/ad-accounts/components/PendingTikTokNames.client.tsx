"use client";

import { useCallback, useEffect, useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { Note } from "@/components/ui/PanelKit";
import { routes } from "@/config/routes";

type Pending = { advertiserId: string; bmBucket: string; expected: string; live: string | null };

/** Botón chico (28 px) para acciones dentro de filas y avisos: copiar, abrir, reintentar. */
export const miniButton =
  "inline-flex h-7 shrink-0 items-center gap-1 rounded-ctl border border-line bg-field px-2 text-xs font-medium text-ink shadow-ctl hover:border-line-strong hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50";

/** Abre la cuenta en TikTok Ads Manager (ahí: Cuenta → Información de la cuenta → Nombre). */
export function tiktokAccountUrl(advertiserId: string): string {
  return `https://ads.tiktok.com/i18n/dashboard?aadvid=${encodeURIComponent(advertiserId)}`;
}

export function CopyNameButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        });
      }}
      className={miniButton}
    >
      <PanelIcon name={done ? "check" : "copy"} className="size-3.5" />
      {done ? "Copiado" : "Copiar nombre"}
    </button>
  );
}

async function fetchPending(): Promise<Pending[]> {
  const r = await fetch(`${routes.api.adAccountsTikTokFree}?pendingNames=1`, { credentials: "include", cache: "no-store" });
  const j = (await r.json().catch(() => ({}))) as { pending?: Pending[]; error?: string };
  if (!r.ok || !j.pending) throw new Error(j.error || "No se pudo leer TikTok.");
  return j.pending;
}

/**
 * Cuentas BM10 ya entregadas a clientes que en TikTok siguen con otro nombre.
 * TikTok no deja renombrarlas por API (BC directo), así que se cambian a mano;
 * la fila desaparece sola cuando el nombre en TikTok ya coincide.
 */
export function PendingTikTokNames() {
  const [rows, setRows] = useState<Pending[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    fetchPending()
      .then(
        (list) => {
          setRows(list);
          setError(null);
        },
        (e: unknown) => setError(e instanceof Error ? e.message : "No se pudo leer TikTok."),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  function load() {
    setLoading(true);
    run();
  }

  return (
    <section className="rounded-card border border-line bg-surface shadow-card" aria-labelledby="pending-names-title">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-5">
        <div className="min-w-0">
          <h2 id="pending-names-title" className="text-base font-semibold leading-6 tracking-[-0.01em] text-ink">
            Nombres pendientes en TikTok (BM 10)
          </h2>
          <p className="mt-0.5 text-xs text-ink-2">
            TikTok no deja cambiar el nombre de estas cuentas desde Ads Holistic. Cámbialo a mano y se quita solo de la lista.
          </p>
        </div>
        <button type="button" onClick={load} disabled={loading} className={buttonClass("outline", "sm")}>
          <PanelIcon name="refresh" />
          {loading ? "Leyendo TikTok…" : "Revisar de nuevo"}
        </button>
      </div>
      <div className="px-4 pb-4 pt-3 sm:px-6 sm:pb-6">
        {error ? <Note tone="warn">{error}</Note> : null}
        {rows && !rows.length && !loading ? (
          <Note tone="ok" icon="check-circle">
            Todas las cuentas BM 10 de clientes ya tienen su nombre en TikTok.
          </Note>
        ) : null}
        {rows && rows.length ? (
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.advertiserId} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{r.expected}</p>
                  <p className="text-xs text-ink-2">
                    En TikTok: “{r.live ?? "?"}” · <span className="font-mono">{r.advertiserId}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <CopyNameButton text={r.expected} />
                  <a href={tiktokAccountUrl(r.advertiserId)} target="_blank" rel="noreferrer" className={miniButton}>
                    Abrir en TikTok
                    <PanelIcon name="external" className="size-3.5" />
                  </a>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
