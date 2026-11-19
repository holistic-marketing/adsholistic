"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PanelCard } from "@/components/ui/PageHeader";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { Note, ToneBadge } from "@/components/ui/PanelKit";
import { createMyInviteAction, reviewMyClientAction, revokeMyInviteAction } from "../my-partner-actions";
import type { PartnerPanelInvite, PartnerPanelPending } from "@/lib/partners/partner-panel.server";

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short", timeZone: "America/Lima" });

const linkish = "shrink-0 text-[13px] font-medium underline-offset-[3px] hover:underline disabled:opacity-50";

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
        <PanelCard
          ruled
          title={
            <span className="inline-flex items-center gap-2">
              Por confirmar
              <ToneBadge tone="accent" className="num">
                {pending.length}
              </ToneBadge>
            </span>
          }
          description="Se registraron con tu link o código. Confírmalos solo si son de tu gente: recién ahí quedan a tu nombre y con tu fee."
        >
          <ul className="divide-y divide-line">
            {pending.map((p) => (
              <li key={p.hecomClienteId} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
                <div className="grid min-w-0 flex-1 leading-snug">
                  <b className="truncate font-semibold text-ink">{p.name}</b>
                  <small className="truncate text-xs text-ink-3">
                    {p.emailMasked} · {fechaCorta(p.registeredAt)}
                    {p.inviteCode ? ` · código ${p.inviteCode}` : " · por link"}
                  </small>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 sm:flex-none"
                    disabled={busy !== null}
                    onClick={() => run(`ok:${p.hecomClienteId}`, () => reviewMyClientAction(p.hecomClienteId, true))}
                  >
                    <PanelIcon name="check" />
                    {busy === `ok:${p.hecomClienteId}` ? "Guardando…" : "Sí es mío"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 sm:flex-none"
                    disabled={busy !== null}
                    onClick={() => run(`no:${p.hecomClienteId}`, () => reviewMyClientAction(p.hecomClienteId, false))}
                  >
                    No lo conozco
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </PanelCard>
      )}

      <PanelCard
        title="Códigos de invitación"
        description={
          <>
            Crea un código para cada persona. Lo pone al registrarse y sirve <strong className="font-semibold text-ink">una sola vez</strong>: si
            alguien lo comparte, ya no funciona.
          </>
        }
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={note}
            maxLength={80}
            onChange={(e) => setNote(e.target.value)}
            placeholder="¿Para quién? (opcional, ej. Brian tienda 12)"
            aria-label="¿Para quién es el código?"
            className="min-w-0 flex-1"
          />
          <Button disabled={busy !== null} onClick={create}>
            <PanelIcon name="plus" />
            {busy === "create" ? "Creando…" : "Crear código"}
          </Button>
        </div>

        {fresh && (
          <Note tone="ok" icon="check-circle" className="mt-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                Código creado: <strong className="font-mono font-semibold tracking-wide">{fresh}</strong>
              </span>
              <button type="button" onClick={() => copy(fresh)} className={linkish}>
                {copied === fresh ? "Copiado ✓" : "Copiar"}
              </button>
            </div>
          </Note>
        )}
        {error && (
          <Note tone="danger" className="mt-3">
            {error}
          </Note>
        )}

        {open.length > 0 && (
          <ul className="mt-3 divide-y divide-line">
            {open.map((i) => (
              <li key={i.id} className="flex items-center gap-2 py-2.5">
                <code className="shrink-0 rounded-ctl border border-accent-line bg-accent-soft px-2 py-0.5 font-mono text-[13px] font-semibold tracking-wide text-accent-text">
                  {i.code}
                </code>
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2">{i.note || "Sin nota"}</span>
                <button type="button" onClick={() => copy(i.code)} className={`${linkish} text-accent-text`}>
                  {copied === i.code ? "Copiado ✓" : "Copiar"}
                  <span className="sr-only"> {i.code}</span>
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => run(`rv:${i.id}`, () => revokeMyInviteAction(i.id))}
                  className={`${linkish} text-danger-fg`}
                >
                  Anular<span className="sr-only"> {i.code}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {closed.length > 0 && (
          <div className="mt-2">
            <button
              type="button"
              aria-expanded={showUsed}
              onClick={() => setShowUsed((v) => !v)}
              className={`${linkish} inline-flex items-center gap-1 text-ink-2`}
            >
              {showUsed ? "Ocultar" : "Ver"} usados y anulados ({closed.length})
              <PanelIcon name="chevron-down" className={`size-3.5 transition-transform ${showUsed ? "rotate-180" : ""}`} />
            </button>
            {showUsed && (
              <ul className="mt-1 divide-y divide-line">
                {closed.map((i) => (
                  <li key={i.id} className="flex items-center gap-2 py-2 text-[13px] text-ink-3">
                    <code className="shrink-0 font-mono font-semibold tracking-wide line-through decoration-ink-3">{i.code}</code>
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
      </PanelCard>
    </>
  );
}
