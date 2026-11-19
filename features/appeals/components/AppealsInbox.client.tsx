"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { EmptyState, Note, PropList, SquareIcon, ToneBadge, type Tone } from "@/components/ui/PanelKit";
import { cn } from "@/lib/cn";
import type { AppealRecord, AppealStatus } from "@/lib/appeals/account-appeals.shared";

type StaffAppeal = AppealRecord & { attachmentUrls: Record<string, string> };

const STATUS_UI: Record<AppealStatus, { label: string; tone: Tone }> = {
  pending: { label: "Por enviar", tone: "warn" },
  sent: { label: "Enviada a TikTok", tone: "info" },
  approved: { label: "Aprobada", tone: "ok" },
  rejected: { label: "Rechazada", tone: "danger" },
};

const FILTERS: Array<{ key: "open" | AppealStatus | "all"; label: string }> = [
  { key: "open", label: "Abiertas" },
  { key: "pending", label: "Por enviar" },
  { key: "sent", label: "Enviadas" },
  { key: "approved", label: "Aprobadas" },
  { key: "rejected", label: "Rechazadas" },
  { key: "all", label: "Todas" },
];

function fmtDate(iso: string | null) {
  return iso
    ? new Date(iso).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "—";
}

function CopyBtn({ value, label }: { value: string; label: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        void navigator.clipboard.writeText(value).then(() => {
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        })
      }
      className={buttonClass("outline", "sm", "shrink-0")}
    >
      <PanelIcon name={ok ? "check" : "copy"} />
      {ok ? "Copiado" : label}
    </button>
  );
}

/** Rótulo pequeño de sección dentro de una apelación. */
function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}

export function AppealsInbox() {
  const [appeals, setAppeals] = useState<StaffAppeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("open");
  const [openId, setOpenId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/appeals/staff", { cache: "no-store" });
      const json = (await res.json()) as { ok?: boolean; error?: string; appeals?: StaffAppeal[] };
      if (!res.ok || !json.ok) throw new Error(json.error || "No se pudo cargar.");
      return { appeals: json.appeals ?? [], error: null };
    } catch (e) {
      return { appeals: null, error: e instanceof Error ? e.message : "No se pudo cargar." };
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void load().then((r) => {
      if (!alive) return;
      setLoading(false);
      if (r.appeals) setAppeals(r.appeals);
      setError(r.error);
    });
    return () => {
      alive = false;
    };
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: appeals.length, open: 0 };
    for (const a of appeals) {
      c[a.status] = (c[a.status] ?? 0) + 1;
      if (a.status === "pending" || a.status === "sent") c.open = (c.open ?? 0) + 1;
    }
    return c;
  }, [appeals]);

  const visible = appeals.filter((a) =>
    filter === "all" ? true : filter === "open" ? a.status === "pending" || a.status === "sent" : a.status === filter,
  );

  async function setStatus(a: StaffAppeal, status: AppealStatus) {
    setSaving(a.id);
    setError(null);
    try {
      const res = await fetch("/api/appeals/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: a.id, status, staffNotes: notes[a.id] ?? a.staffNotes ?? "" }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; appeal?: AppealRecord };
      if (!res.ok || !json.ok || !json.appeal) throw new Error(json.error || "No se pudo guardar.");
      const updated = json.appeal;
      setAppeals((prev) => prev.map((x) => (x.id === a.id ? { ...x, ...updated } : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setSaving(null);
    }
  }

  const activeLabel = FILTERS.find((f) => f.key === filter)?.label ?? "";

  return (
    <div className="space-y-4">
      {/* Estados (v3 «picks»): una opción a la vez, con su conteo. */}
      <div role="group" aria-label="Estado de la apelación" className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => {
          const on = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(f.key)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-ctl border px-3 text-[13px] font-medium shadow-ctl",
                on
                  ? "border-accent-line bg-accent-soft text-accent-text"
                  : "border-line bg-field text-ink hover:border-line-strong hover:bg-hover",
              )}
            >
              {f.label}
              <b className={cn("num text-xs font-medium", on ? "text-accent-text" : "text-ink-3")}>{counts[f.key] ?? 0}</b>
            </button>
          );
        })}
      </div>

      {error ? <Note tone="danger">{error}</Note> : null}

      {loading ? (
        <p role="status" className="rounded-card border border-line bg-surface px-5 py-10 text-center text-[13px] text-ink-3 shadow-card">
          Cargando…
        </p>
      ) : visible.length === 0 ? (
        <section className="rounded-card border border-line bg-surface shadow-card">
          <EmptyState
            icon="shield"
            title={`Nada en «${activeLabel}»`}
            description="Cuando un cliente pida apelar una cuenta suspendida, aparecerá aquí."
          />
        </section>
      ) : (
        <ul className="space-y-4">
          {visible.map((a) => {
            const expanded = openId === a.id;
            const ui = STATUS_UI[a.status];
            const bodyId = `appeal-${a.id}`;
            const actions: Array<{ status: AppealStatus; label: string; icon: "send" | "check-circle" | "x-circle" | "check" }> =
              a.status === "pending" || a.status === "sent"
                ? [
                    ...(a.status === "pending"
                      ? [{ status: "sent" as const, label: "Marcar enviada a TikTok", icon: "send" as const }]
                      : []),
                    { status: "approved", label: "TikTok la aprobó", icon: "check-circle" },
                    { status: "rejected", label: "TikTok la rechazó", icon: "x-circle" },
                  ]
                : [{ status: a.status, label: "Guardar nota", icon: "check" }];
            const facts = (
              [
                ["Empresa", a.companyName],
                ["RUC / doc.", a.taxId],
                ["Tienda", a.storeUrl],
                ["Vende", a.products],
                ["Correo", a.contactEmail],
                ["Teléfono", a.contactPhone],
                ["Nota cliente", a.clientNotes],
              ] as Array<[string, string | null]>
            ).filter(([, v]) => v);
            return (
              <li key={a.id} className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
                <button
                  type="button"
                  onClick={() => setOpenId(expanded ? null : a.id)}
                  aria-expanded={expanded}
                  aria-controls={bodyId}
                  className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left hover:bg-field sm:px-6"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <SquareIcon>TT</SquareIcon>
                    <span className="grid min-w-0 leading-[1.35]">
                      <span className="truncate text-base font-semibold tracking-[-0.01em] text-ink">
                        {a.hecomClienteName ?? a.companyName}
                      </span>
                      <span className="truncate text-xs text-ink-2">
                        {a.advertiserName ?? a.advertiserId}
                        {a.bmLabel ? ` · ${a.bmLabel}` : ""} · pedida el {fmtDate(a.createdAt)}
                      </span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <ToneBadge tone={ui.tone} dot>
                      {ui.label}
                    </ToneBadge>
                    <PanelIcon
                      name="chevron-down"
                      className={cn("text-ink-3 transition-transform", expanded && "rotate-180")}
                    />
                  </span>
                </button>

                {expanded ? (
                  <div
                    id={bodyId}
                    className="grid gap-5 border-t border-line px-4 pb-6 pt-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]"
                  >
                    <div className="space-y-4">
                      <div className="rounded-box bg-field px-3.5 py-3">
                        <SectionLabel>Cuenta</SectionLabel>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <p className="min-w-0 break-all font-mono text-[13px] font-medium text-ink">{a.advertiserId}</p>
                          <CopyBtn value={a.advertiserId} label="Copiar ID" />
                        </div>
                        {a.suspensionReason ? (
                          <p className="mt-2 text-xs italic leading-5 text-ink-2 [overflow-wrap:anywhere]">“{a.suspensionReason}”</p>
                        ) : null}
                        {a.suspensionUntil ? (
                          <p className="mt-1 text-xs text-ink-2">
                            Suspendida hasta {new Date(a.suspensionUntil).toLocaleDateString("es-PE")}
                          </p>
                        ) : null}
                      </div>

                      {facts.length ? (
                        <PropList
                          items={facts.map(([k, v]) => ({
                            label: k,
                            value:
                              k === "Tienda" ? (
                                <a
                                  href={String(v)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-accent-text underline-offset-2 hover:underline"
                                >
                                  {v}
                                </a>
                              ) : (
                                v
                              ),
                          }))}
                        />
                      ) : null}

                      <div>
                        <SectionLabel>Documentos ({a.attachments.length})</SectionLabel>
                        {a.attachments.length ? (
                          <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {a.attachments.map((f) => {
                              const url = a.attachmentUrls[f.path];
                              const img = f.mimeType.startsWith("image/");
                              return (
                                <li key={f.path}>
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                    download={f.name}
                                    className="block overflow-hidden rounded-box border border-line bg-field hover:border-line-strong"
                                  >
                                    {img && url ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={url} alt={f.name} className="h-20 w-full object-cover" />
                                    ) : (
                                      <span className="flex h-20 flex-col items-center justify-center gap-1 text-xs font-semibold text-ink-3">
                                        <PanelIcon name="file" className="size-5" />
                                        PDF
                                      </span>
                                    )}
                                    <span className="block truncate px-2 py-1 text-[11px] text-ink-2">{f.name}</span>
                                  </a>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="mt-1 text-[13px] text-ink-3">El cliente no adjuntó documentos.</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-box border border-line">
                        <div className="flex items-center justify-between gap-2 border-b border-line bg-field px-3.5 py-2">
                          <p className="flex items-center gap-2 text-[13px] font-medium text-ink">
                            <PanelIcon name="file" className="text-ink-3" />
                            Mensaje para TikTok (inglés)
                          </p>
                          <CopyBtn value={a.appealMessage} label="Copiar mensaje" />
                        </div>
                        <pre
                          lang="en"
                          className="max-h-72 overflow-auto whitespace-pre-wrap px-3.5 py-3 font-sans text-[13px] leading-5 text-ink-2 [overflow-wrap:anywhere]"
                        >
                          {a.appealMessage}
                        </pre>
                      </div>

                      <ol className="list-decimal space-y-0.5 rounded-box bg-field py-3 pl-8 pr-3.5 text-[13px] leading-5 text-ink-2">
                        <li>
                          Abre{" "}
                          <a
                            href="https://ads.tiktok.com/"
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-accent-text underline-offset-2 hover:underline"
                          >
                            TikTok Ads Manager
                          </a>{" "}
                          con el BM de la cuenta.
                        </li>
                        <li>Ayuda (?) → Submit ticket → Account Review → Account Suspension Appeal.</li>
                        <li>Pega el ID, el mensaje y adjunta los documentos.</li>
                        <li>Marca aquí «Enviada a TikTok».</li>
                      </ol>

                      <div className="grid gap-1.5">
                        <label htmlFor={`${bodyId}-note`} className="text-sm font-medium text-ink">
                          Nota interna
                        </label>
                        <Textarea
                          id={`${bodyId}-note`}
                          className="resize-y"
                          value={notes[a.id] ?? a.staffNotes ?? ""}
                          onChange={(e) => setNotes((prev) => ({ ...prev, [a.id]: e.target.value }))}
                          placeholder="N.º de ticket de TikTok, respuesta, etc."
                        />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {actions.map((action, i) => (
                          <Button
                            key={action.label}
                            variant={i === 0 ? "primary" : "outline"}
                            disabled={saving === a.id}
                            onClick={() => void setStatus(a, action.status)}
                          >
                            <PanelIcon name={action.icon} />
                            {action.label}
                          </Button>
                        ))}
                      </div>
                      {a.sentAt ? <p className="text-xs text-ink-3">Enviada a TikTok: {fmtDate(a.sentAt)}</p> : null}
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
