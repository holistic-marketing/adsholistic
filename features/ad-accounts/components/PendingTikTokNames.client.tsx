"use client";

import { useCallback, useEffect, useState } from "react";
import { routes } from "@/config/routes";

type Pending = { advertiserId: string; bmBucket: string; expected: string; live: string | null };

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
      className="rounded-md bg-surface px-2 py-0.5 text-[11px] font-semibold text-accent-text ring-1 ring-accent-line hover:bg-field"
    >
      {done ? "Copiado ✓" : "Copiar nombre"}
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
    <section className="rounded-card border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[14px] font-semibold text-ink">Nombres pendientes en TikTok (BM 10)</h3>
          <p className="text-[12px] text-ink-2">
            TikTok no deja cambiar el nombre de estas cuentas desde Ads Holistic. Cámbialo a mano y se quita solo de la lista.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-lg bg-surface px-3 py-1.5 text-[12px] font-semibold text-accent-text ring-1 ring-accent-line hover:bg-field disabled:opacity-50"
        >
          {loading ? "Leyendo TikTok…" : "Revisar de nuevo"}
        </button>
      </div>
      {error ? <p className="mt-2 text-[12px] text-warn-fg">{error}</p> : null}
      {rows && !rows.length && !loading ? (
        <p className="mt-3 text-[13px] text-ok-fg">✓ Todas las cuentas BM 10 de clientes ya tienen su nombre en TikTok.</p>
      ) : null}
      {rows && rows.length ? (
        <ul className="mt-3 divide-y divide-[#f1ebe3]">
          {rows.map((r) => (
            <li key={r.advertiserId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[13px]">
              <div className="min-w-0">
                <p className="font-semibold text-ink">{r.expected}</p>
                <p className="text-[12px] text-ink-2">
                  En TikTok: “{r.live ?? "?"}” · <span className="font-mono">{r.advertiserId}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <CopyNameButton text={r.expected} />
                <a
                  href={tiktokAccountUrl(r.advertiserId)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-accent-text hover:bg-field"
                >
                  Abrir en TikTok ↗
                </a>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
