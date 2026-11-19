"use client";

import { useCallback, useEffect, useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { PanelCard } from "@/components/ui/PageHeader";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { EmptyState, Note, Segmented } from "@/components/ui/PanelKit";
import { cn } from "@/lib/cn";

type Audience = "clientes" | "todos";
type Destination = { url: string; label: string };
type Count = { recipients: number; devices: number };
type Log = {
  id: string;
  title: string;
  body: string;
  url: string;
  audience: Audience;
  sentByEmail: string | null;
  recipients: number;
  devices: number;
  delivered: number;
  createdAt: string;
};

const API = "/api/push/broadcasts";

/** Plantillas listas para no empezar de cero. */
const TEMPLATES: Array<{ name: string; title: string; body: string; url: string }> = [
  {
    name: "Recarga con Stripe",
    title: "Recarga en segundos con tarjeta",
    body: "Ahora recargas tu saldo con Stripe al toque, sin mandar comprobantes. Tu saldo queda listo al instante.",
    url: "/payments",
  },
  {
    name: "Hora de pautar",
    title: "¡Ya es hora de pautar!",
    body: "Tus clientes están en TikTok ahora mismo. Recarga tu saldo y activa tus campañas hoy.",
    url: "/payments",
  },
  {
    name: "Lanza campañas",
    title: "¡Es momento de lanzar campañas!",
    body: "Aprovecha esta semana: sube tus creativos y deja tus anuncios corriendo desde hoy.",
    url: "/ad-accounts",
  },
  {
    name: "Nuevo tutorial",
    title: "Nuevo tutorial disponible",
    body: "Aprende a sacarle más a tus campañas con el nuevo video en Educación.",
    url: "/education",
  },
];

const AUDIENCES: Array<{ value: Audience; label: string }> = [
  { value: "clientes", label: "Clientes" },
  { value: "todos", label: "Todos + equipo" },
];

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Rótulo de un campo con su contador de letras (v3 «lab-row» + «count-in»). */
function CountedLabel({ htmlFor, label, length, max }: { htmlFor: string; label: string; length: number; max: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </label>
      <span className={cn("num text-xs", length > max ? "text-danger-fg" : "text-ink-3")}>
        {length}/{max}
      </span>
    </div>
  );
}

/** Vista previa: así se ve en la pantalla de bloqueo del celular. Tonos invertidos
    del panel (el equipo se ve oscuro en el tema claro y claro en el oscuro). */
function PhonePreview({ title, body }: { title: string; body: string }) {
  return (
    <div
      aria-hidden
      className="mx-auto w-[260px] max-w-full rounded-[32px] border-[6px] border-ink bg-[color-mix(in_srgb,var(--ui-text)_88%,var(--ui-surface))] px-3 pb-5 pt-3.5 text-surface shadow-card"
    >
      <div className="mx-auto mb-[26px] h-[22px] w-[84px] rounded-[12px] bg-ink" />
      <p className="text-center font-mono text-[2.75rem] font-semibold leading-none tracking-[-0.04em]">9:41</p>
      <div className="mt-[30px] grid min-h-14 grid-cols-[32px_minmax(0,1fr)] gap-2.5 rounded-[14px] bg-surface/95 px-3 py-2.5 text-ink">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" className="size-8 rounded-[8px]" />
        <div className="min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <b className="truncate text-[13px] font-semibold leading-tight">{title || "Título del aviso"}</b>
            <span className="shrink-0 text-[10.5px] text-ink-3">ahora</span>
          </div>
          <p className="line-clamp-4 text-xs leading-snug text-ink-2 [overflow-wrap:anywhere]">{body || "Aquí va el mensaje."}</p>
        </div>
      </div>
    </div>
  );
}

export function BroadcastComposer({
  destinations,
  titleMax,
  bodyMax,
}: {
  destinations: Destination[];
  titleMax: number;
  bodyMax: number;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState(destinations[0]?.url ?? "/overview");
  const [audience, setAudience] = useState<Audience>("clientes");
  const [count, setCount] = useState<Count | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<"test" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [history, setHistory] = useState<Log[] | null>(null);

  const loadHistory = useCallback(() => {
    fetch(API, { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((j: { history?: Log[] }) => setHistory(j.history ?? []))
      .catch(() => setHistory([]));
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}?audience=${audience}`, { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((j: { count?: Count }) => {
        if (!cancelled) setCount(j.count ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [audience]);

  const ready = title.trim().length > 0 && body.trim().length > 0;
  const destinationLabel = destinations.find((d) => d.url === url)?.label ?? url;

  function edit<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setConfirming(false);
      setNotice(null);
      setError(null);
    };
  }

  async function post(target: "prueba" | Audience) {
    setBusy(target === "prueba" ? "test" : "send");
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(API, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, url, audience: target }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        result?: { recipients: number; devices: number; delivered: number };
      };
      if (!res.ok || !j.result) throw new Error(j.error || "No se pudo enviar.");
      const r = j.result;
      if (target === "prueba") {
        setNotice(
          r.delivered > 0
            ? "Prueba enviada. Revisa tu celular o tu PC."
            : "No tienes avisos activos en ningún dispositivo. Actívalos en la campanita y vuelve a probar.",
        );
      } else {
        setNotice(
          `Enviado. Quedó en la campanita de ${plural(r.recipients, "persona", "personas")} y llegó al instante a ${plural(r.delivered, "dispositivo", "dispositivos")}.`,
        );
        setTitle("");
        setBody("");
        setConfirming(false);
        loadHistory();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
      <div className="grid min-w-0 gap-4">
        <PanelCard>
          <p id="avisos-plantillas" className="mb-2 text-sm font-medium text-ink">
            Plantillas
          </p>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-labelledby="avisos-plantillas">
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.name}
                type="button"
                onClick={() => {
                  edit(setTitle)(tpl.title);
                  setBody(tpl.body);
                  setUrl(tpl.url);
                }}
                className={buttonClass("outline", "sm")}
              >
                {tpl.name}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-1.5">
            <CountedLabel htmlFor="aviso-titulo" label="Título" length={title.length} max={titleMax} />
            <Input
              id="aviso-titulo"
              value={title}
              maxLength={titleMax}
              onChange={(e) => edit(setTitle)(e.target.value)}
              placeholder="¡Ya es hora de pautar!"
            />
          </div>
          <div className="mt-3.5 grid gap-1.5">
            <CountedLabel htmlFor="aviso-mensaje" label="Mensaje" length={body.length} max={bodyMax} />
            <Textarea
              id="aviso-mensaje"
              value={body}
              maxLength={bodyMax}
              rows={3}
              onChange={(e) => edit(setBody)(e.target.value)}
              placeholder="Recarga tu saldo y activa tus campañas hoy."
              className="resize-y"
            />
          </div>

          <div className="mt-3.5 grid gap-x-3 gap-y-4 sm:grid-cols-2">
            <label className="grid content-start gap-1.5 text-sm font-medium text-ink">
              Al tocarlo abre
              <Select value={url} onChange={(e) => edit(setUrl)(e.target.value)}>
                {destinations.map((d) => (
                  <option key={d.url} value={d.url}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </label>
            <div className="grid content-start gap-1.5">
              <span className="text-sm font-medium text-ink">Para</span>
              <Segmented label="Para" value={audience} onChange={edit(setAudience)} options={AUDIENCES} block />
            </div>
          </div>

          <Note icon="users" className="mt-3.5">
            {count ? (
              <>
                Queda en la campanita de <strong className="num text-ink">{plural(count.recipients, "persona", "personas")}</strong> y
                llega al instante a <strong className="num text-ink">{plural(count.devices, "celular o PC", "celulares o PCs")}</strong> con
                avisos activos.
              </>
            ) : (
              "Calculando a cuántos llega…"
            )}
          </Note>

          {error ? <Note tone="warn" className="mt-3">{error}</Note> : null}
          {notice ? <Note tone="ok" icon="check-circle" className="mt-3">{notice}</Note> : null}

          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            {confirming ? (
              <>
                <button type="button" className={buttonClass("primary")} disabled={busy !== null} onClick={() => void post(audience)}>
                  <PanelIcon name="send" />
                  {busy === "send" ? "Enviando…" : `Sí, enviar a ${count ? plural(count.recipients, "persona", "personas") : "todos"}`}
                </button>
                <button type="button" className={buttonClass("outline")} disabled={busy !== null} onClick={() => setConfirming(false)}>
                  Cancelar
                </button>
                <span className="text-xs text-ink-3">Se manda una sola vez y no se puede deshacer.</span>
              </>
            ) : (
              <>
                <button type="button" className={buttonClass("primary")} disabled={!ready || busy !== null} onClick={() => setConfirming(true)}>
                  <PanelIcon name="send" />
                  Enviar aviso
                </button>
                <button type="button" className={buttonClass("outline")} disabled={!ready || busy !== null} onClick={() => void post("prueba")}>
                  {busy === "test" ? "Enviando prueba…" : "Mandarme una prueba"}
                </button>
              </>
            )}
          </div>
        </PanelCard>

        <PanelCard title="Enviados">
          {history === null ? (
            <p className="text-[13px] text-ink-3">Cargando…</p>
          ) : history.length === 0 ? (
            <EmptyState icon="megaphone" title="Todavía no se mandó ningún aviso" />
          ) : (
            <ul className="divide-y divide-line">
              {history.map((h) => (
                <li key={h.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="grid min-w-0 leading-snug">
                    <b className="font-semibold text-ink">{h.title}</b>
                    <small className="text-[13px] text-ink-2">{h.body}</small>
                    <small className="mt-0.5 text-xs text-ink-3">
                      {plural(h.delivered, "dispositivo", "dispositivos")} al instante
                      {h.sentByEmail ? ` · ${h.sentByEmail}` : ""}
                    </small>
                  </div>
                  <div className="grid shrink-0 justify-items-end gap-1 text-right">
                    <span className="inline-flex h-5 items-center whitespace-nowrap rounded-[6px] bg-subtle px-[7px] text-[11px] font-medium text-ink-2">
                      {h.audience === "todos" ? "Todos + equipo" : "Clientes"} · <span className="num ml-1">{h.recipients}</span>
                    </span>
                    <small className="text-xs text-ink-3">
                      {new Date(h.createdAt).toLocaleString("es-PE", {
                        timeZone: "America/Lima",
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>
      </div>

      <aside className="lg:sticky lg:top-[72px]">
        <p className="mb-2.5 text-center text-[13px] text-ink-3">Así se ve en el celular</p>
        <PhonePreview title={title.trim()} body={body.trim()} />
        <p className="mt-2.5 text-center text-[13px] text-ink-3">Al tocarlo abre: {destinationLabel}</p>
      </aside>
    </div>
  );
}
