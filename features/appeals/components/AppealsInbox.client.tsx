"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppealRecord, AppealStatus } from "@/lib/appeals/account-appeals.shared";

type StaffAppeal = AppealRecord & { attachmentUrls: Record<string, string> };

const STATUS_UI: Record<AppealStatus, { label: string; chip: string }> = {
  pending: { label: "Por enviar", chip: "bg-warn-bg text-warn-fg ring-warn-line" },
  sent: { label: "Enviada a TikTok", chip: "bg-field text-ok-fg ring-ok-line" },
  approved: { label: "Aprobada", chip: "bg-ok-bg text-ok-fg ring-ok-solid" },
  rejected: { label: "Rechazada", chip: "bg-field text-danger-fg ring-danger-line" },
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
      className="inline-flex h-8 shrink-0 items-center rounded-lg border border-line bg-surface px-2.5 text-[11.5px] font-semibold text-ink transition hover:border-line-strong"
    >
      {ok ? "Copiado ✓" : label}
    </button>
  );
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
              filter === f.key
                ? "border-accent-line bg-accent-soft text-accent-text"
                : "border-line bg-surface text-ink-2 hover:border-line-strong"
            }`}
          >
            {f.label}
            <span className={`ml-1.5 tabular-nums ${filter === f.key ? "text-white/70" : "text-[#a39a90]"}`}>
              {counts[f.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {error ? (
        <p className="rounded-box border border-danger-line bg-danger-bg px-4 py-3 text-[13px] font-medium text-danger-fg" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="rounded-card border border-line bg-surface px-5 py-10 text-center text-[13px] text-ink-3">Cargando…</p>
      ) : visible.length === 0 ? (
        <p className="rounded-card border border-dashed border-line bg-field px-5 py-10 text-center text-[13px] text-ink-3">
          No hay apelaciones en esta vista.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((a) => {
            const expanded = openId === a.id;
            const ui = STATUS_UI[a.status];
            return (
              <li key={a.id} className="overflow-hidden rounded-card border border-line bg-surface">
                <button
                  type="button"
                  onClick={() => setOpenId(expanded ? null : a.id)}
                  aria-expanded={expanded}
                  className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-field sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-bold text-ink">{a.hecomClienteName ?? a.companyName}</p>
                    <p className="mt-0.5 truncate text-[12px] text-ink-2">
                      {a.advertiserName ?? a.advertiserId}
                      {a.bmLabel ? ` · ${a.bmLabel}` : ""} · {fmtDate(a.createdAt)}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${ui.chip}`}>{ui.label}</span>
                </button>

                {expanded ? (
                  <div className="grid gap-4 border-t border-line px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
                    <div className="flex flex-col gap-3">
                      <div className="rounded-box bg-subtle px-3.5 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-3">Cuenta</p>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <p className="min-w-0 break-all font-mono text-[13px] font-semibold text-ink">{a.advertiserId}</p>
                          <CopyBtn value={a.advertiserId} label="Copiar ID" />
                        </div>
                        {a.suspensionReason ? (
                          <p className="mt-2 text-[11.5px] italic leading-5 text-ink-2 [overflow-wrap:anywhere]">“{a.suspensionReason}”</p>
                        ) : null}
                        {a.suspensionUntil ? (
                          <p className="mt-1 text-[11.5px] text-ink-2">Suspendida hasta {new Date(a.suspensionUntil).toLocaleDateString("es-PE")}</p>
                        ) : null}
                      </div>

                      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[12.5px]">
                        {[
                          ["Empresa", a.companyName],
                          ["RUC / doc.", a.taxId],
                          ["Tienda", a.storeUrl],
                          ["Vende", a.products],
                          ["Correo", a.contactEmail],
                          ["Teléfono", a.contactPhone],
                          ["Nota cliente", a.clientNotes],
                        ]
                          .filter(([, v]) => v)
                          .map(([k, v]) => (
                            <div key={k} className="contents">
                              <dt className="text-ink-3">{k}</dt>
                              <dd className="min-w-0 font-medium text-ink [overflow-wrap:anywhere]">
                                {k === "Tienda" ? (
                                  <a href={String(v)} target="_blank" rel="noreferrer" className="text-accent-text underline-offset-2 hover:underline">
                                    {v}
                                  </a>
                                ) : (
                                  v
                                )}
                              </dd>
                            </div>
                          ))}
                      </dl>

                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-3">
                          Documentos ({a.attachments.length})
                        </p>
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
                                    className="block overflow-hidden rounded-lg border border-line bg-field transition hover:border-line-strong"
                                  >
                                    {img && url ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={url} alt={f.name} className="h-20 w-full object-cover" />
                                    ) : (
                                      <span className="flex h-20 items-center justify-center text-[12px] font-bold text-ink-3">PDF</span>
                                    )}
                                    <span className="block truncate px-2 py-1 text-[10.5px] text-ink-2">{f.name}</span>
                                  </a>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="mt-1 text-[12px] text-ink-3">El cliente no adjuntó documentos.</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      <div className="rounded-box border border-line">
                        <div className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
                          <p className="text-[12.5px] font-bold text-ink">Mensaje para TikTok (inglés)</p>
                          <CopyBtn value={a.appealMessage} label="Copiar mensaje" />
                        </div>
                        <pre className="max-h-72 overflow-auto whitespace-pre-wrap px-3.5 py-3 [overflow-wrap:anywhere] font-sans text-[12.5px] leading-5 text-ink">
                          {a.appealMessage}
                        </pre>
                      </div>

                      <ol className="list-decimal space-y-0.5 rounded-box bg-subtle px-3.5 py-3 pl-8 text-[12px] leading-5 text-ink-2">
                        <li>
                          Abre{" "}
                          <a href="https://ads.tiktok.com/" target="_blank" rel="noreferrer" className="font-semibold text-accent-text underline-offset-2 hover:underline">
                            TikTok Ads Manager
                          </a>{" "}
                          con el BM de la cuenta.
                        </li>
                        <li>Ayuda (?) → Submit ticket → Account Review → Account Suspension Appeal.</li>
                        <li>Pega el ID, el mensaje y adjunta los documentos.</li>
                        <li>Marca aquí «Enviada a TikTok».</li>
                      </ol>

                      <label className="block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-3">
                        Nota interna
                        <textarea
                          className="mt-1.5 min-h-[3.5rem] w-full resize-y rounded-box border border-line bg-field px-3 py-2 text-[12.5px] font-medium normal-case tracking-normal text-ink outline-none focus:border-line-strong focus:bg-surface"
                          value={notes[a.id] ?? a.staffNotes ?? ""}
                          onChange={(e) => setNotes((prev) => ({ ...prev, [a.id]: e.target.value }))}
                          placeholder="N.º de ticket de TikTok, respuesta, etc."
                        />
                      </label>

                      <div className="flex flex-wrap gap-2">
                        {a.status === "pending" ? (
                          <button
                            type="button"
                            disabled={saving === a.id}
                            onClick={() => void setStatus(a, "sent")}
                            className="inline-flex h-10 items-center rounded-box bg-accent-btn px-4 text-[13px] font-semibold text-on-accent transition hover:bg-accent-btn-hover disabled:opacity-50"
                          >
                            Marcar enviada a TikTok
                          </button>
                        ) : null}
                        {a.status === "pending" || a.status === "sent" ? (
                          <>
                            <button
                              type="button"
                              disabled={saving === a.id}
                              onClick={() => void setStatus(a, "approved")}
                              className="inline-flex h-10 items-center rounded-box border border-ok-line bg-field px-4 text-[13px] font-semibold text-ok-fg transition hover:bg-ok-bg disabled:opacity-50"
                            >
                              TikTok la aprobó
                            </button>
                            <button
                              type="button"
                              disabled={saving === a.id}
                              onClick={() => void setStatus(a, "rejected")}
                              className="inline-flex h-10 items-center rounded-box border border-danger-line bg-surface px-4 text-[13px] font-semibold text-danger-fg transition hover:bg-field disabled:opacity-50"
                            >
                              TikTok la rechazó
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            disabled={saving === a.id}
                            onClick={() => void setStatus(a, a.status)}
                            className="inline-flex h-10 items-center rounded-box border border-line bg-surface px-4 text-[13px] font-semibold text-ink transition hover:border-line-strong disabled:opacity-50"
                          >
                            Guardar nota
                          </button>
                        )}
                      </div>
                      {a.sentAt ? <p className="text-[11.5px] text-ink-3">Enviada a TikTok: {fmtDate(a.sentAt)}</p> : null}
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
