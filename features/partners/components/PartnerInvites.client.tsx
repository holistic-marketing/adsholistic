"use client";

import { useState, useTransition } from "react";
import { createMyInviteAction, reviewMyClientAction, revokeMyInviteAction } from "../my-partner-actions";
import type { PartnerPanelInvite, PartnerPanelPending } from "@/lib/partners/partner-panel.server";

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short", timeZone: "America/Lima" });

/**
 * Control del aliado sobre quién queda a su nombre: confirma los registros que
 * llegaron por su link o código, y crea códigos de un solo uso por persona.
 */
export function PartnerInvites({ pending, invites }: { pending: PartnerPanelPending[]; invites: PartnerPanelInvite[] }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [showUsed, setShowUsed] = useState(false);

  const run = (key: string, fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setError(null);
    setBusy(key);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error);
      setBusy(null);
    });
  };

  const create = () =>
    run("create", async () => {
      const r = await createMyInviteAction(note);
      if (r.ok) {
        setFresh(r.code);
        setNote("");
      }
      return r;
    });

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 1600);
    } catch {
      window.prompt("Copia el código:", code);
    }
  };

  const open = invites.filter((i) => i.status === "open");
  const closed = invites.filter((i) => i.status !== "open");

  return (
    <>
      {pending.length > 0 && (
        <section className="rounded-card border border-accent-line bg-field p-4 sm:p-5">
          <p className="text-[14px] font-semibold text-ink">
            Por confirmar <span className="ml-1 rounded-full bg-accent-btn px-2 py-0.5 text-[11px] text-on-accent">{pending.length}</span>
          </p>
          <p className="mt-1 text-[12.5px] text-ink-2">
            Se registraron con tu link o código. Confírmalos solo si son de tu gente: recién ahí quedan a tu nombre y con tu fee.
          </p>
          <ul className="mt-3 divide-y divide-[#f3e6d6]">
            {pending.map((p) => (
              <li key={p.hecomClienteId} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold text-ink">{p.name}</p>
                  <p className="truncate text-[12px] text-ink-3">
                    {p.emailMasked} · {fechaCorta(p.registeredAt)}
                    {p.inviteCode ? ` · código ${p.inviteCode}` : " · por link"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => run(`ok:${p.hecomClienteId}`, () => reviewMyClientAction(p.hecomClienteId, true))}
                    className="h-9 flex-1 rounded-box bg-accent-btn px-3 text-[12.5px] font-semibold text-on-accent transition hover:bg-black disabled:opacity-50 sm:flex-none"
                  >
                    {busy === `ok:${p.hecomClienteId}` ? "Guardando…" : "Sí es mío"}
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => run(`no:${p.hecomClienteId}`, () => reviewMyClientAction(p.hecomClienteId, false))}
                    className="h-9 flex-1 rounded-box border border-line bg-surface px-3 text-[12.5px] font-semibold text-ink transition hover:bg-hover disabled:opacity-50 sm:flex-none"
                  >
                    No lo conozco
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-card border border-line bg-surface p-4 sm:p-5">
        <p className="text-[14px] font-semibold text-ink">Códigos de invitación</p>
        <p className="mt-1 text-[12.5px] text-ink-2">
          Crea un código para cada persona. Lo pone al registrarse y sirve <strong>una sola vez</strong>: si alguien lo
          comparte, ya no funciona.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={note}
            maxLength={80}
            onChange={(e) => setNote(e.target.value)}
            placeholder="¿Para quién? (opcional, ej. Brian tienda 12)"
            aria-label="¿Para quién es el código?"
            className="h-10 min-w-0 flex-1 rounded-box border border-line px-3 text-[13.5px] outline-none focus:border-accent"
          />
          <button
            type="button"
            disabled={busy !== null}
            onClick={create}
            className="h-10 rounded-box bg-accent-btn px-4 text-[13px] font-semibold text-on-accent transition hover:bg-accent-btn-hover disabled:opacity-50"
          >
            {busy === "create" ? "Creando…" : "Crear código"}
          </button>
        </div>

        {fresh && (
          <div className="mt-3 flex items-center gap-2 rounded-box bg-field px-3 py-2.5">
            <p className="min-w-0 flex-1 text-[13px] text-ok-fg [overflow-wrap:anywhere]">
              Código creado: <strong className="tracking-wide">{fresh}</strong>
            </p>
            <button type="button" onClick={() => copy(fresh)} className="shrink-0 text-[12.5px] font-semibold text-ok-fg underline">
              {copied === fresh ? "Copiado ✓" : "Copiar"}
            </button>
          </div>
        )}
        {error && <p className="mt-2 rounded-box bg-field px-3 py-2 text-[12.5px] text-danger-fg">{error}</p>}

        {open.length > 0 && (
          <ul className="mt-3 divide-y divide-[#f2ece5]">
            {open.map((i) => (
              <li key={i.id} className="flex items-center gap-2 py-2">
                <code className="shrink-0 rounded-lg bg-field px-2 py-1 text-[13px] font-bold tracking-wide text-accent-text">{i.code}</code>
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-2">{i.note || "Sin nota"}</span>
                <button type="button" onClick={() => copy(i.code)} className="shrink-0 text-[12.5px] font-semibold text-ink hover:underline">
                  {copied === i.code ? "Copiado ✓" : "Copiar"}
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => run(`rv:${i.id}`, () => revokeMyInviteAction(i.id))}
                  className="shrink-0 text-[12.5px] font-semibold text-danger-fg hover:underline disabled:opacity-50"
                >
                  Anular
                </button>
              </li>
            ))}
          </ul>
        )}

        {closed.length > 0 && (
          <div className="mt-2">
            <button type="button" onClick={() => setShowUsed((v) => !v)} className="text-[12.5px] font-semibold text-ink-2 hover:underline">
              {showUsed ? "Ocultar" : "Ver"} usados y anulados ({closed.length})
            </button>
            {showUsed && (
              <ul className="mt-1 divide-y divide-[#f2ece5]">
                {closed.map((i) => (
                  <li key={i.id} className="flex items-center gap-2 py-2 text-[12.5px] text-ink-3">
                    <code className="shrink-0 font-semibold tracking-wide line-through decoration-ink-3">{i.code}</code>
                    <span className="min-w-0 flex-1 truncate">
                      {i.status === "used"
                        ? `Usado por ${i.usedBy ?? "un cliente"}${i.usedAt ? ` · ${fechaCorta(i.usedAt)}` : ""}`
                        : "Anulado"}
                      {i.note ? ` · ${i.note}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </>
  );
}
