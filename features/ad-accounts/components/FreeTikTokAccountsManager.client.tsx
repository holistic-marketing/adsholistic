"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { Avatar, Note, Segmented } from "@/components/ui/PanelKit";
import { routes } from "@/config/routes";
import { cn } from "@/lib/cn";
import { miniButton, PendingTikTokNames } from "./PendingTikTokNames.client";
import { TikTokRenameStatus } from "./TikTokRenameStatus.client";

type Member = { userId: string; userName: string };
type FreeAccount = { advertiserId: string; name: string; members: Member[] | null };
type BcMember = { userId: string; userName: string; email: string | null; role: string | null };
type ClienteOption = { id: string; name: string };
type TikTokUser = { userId: string; userName: string; accounts: number; suggested: boolean };
type Snapshot = {
  accounts: FreeAccount[];
  members: BcMember[];
  createdToday: number;
  maxPerBatch: number;
  recommendedPerDay: number;
  maxPerClienteAssign: number;
};
type BmSummary = { bm: string; free: number | null; total: number | null; createdToday: number; leftToday: number; capped: boolean };
type GivenToCliente = {
  advertiserId: string;
  advertiserName: string;
  hecomLinked: boolean;
  inPanel: boolean;
  budgetZero: boolean | null;
  access: Array<{ userId: string; ok: boolean; message: string }>;
  renameRequested?: boolean | null;
  renameManual?: boolean;
  renameMessage?: string;
};

const BMS: Array<{ id: string; label: string; hint: string }> = [
  { id: "300", label: "BM 300", hint: "Cash" },
  { id: "200", label: "BM 200", hint: "Cash" },
  { id: "30", label: "BM 30", hint: "Crédito · nace en $0" },
  { id: "10", label: "BM 10", hint: "Crédito · nace en $0" },
];
const QUICK_COUNTS = [1, 5, 10, 15, 20];

const card = "min-w-0 rounded-card border border-line bg-surface shadow-card";
const label = "text-sm font-medium text-ink";
const optTag = "text-xs font-normal text-ink-3";
const hint = "text-xs leading-snug text-ink-3";
const checkbox = "size-4 shrink-0 accent-accent-btn";

/** Mismo prefijo que el servidor (freeNamePrefix), solo para la vista previa. */
function previewPrefix(raw: string): string {
  const clean = raw
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\blibre\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
  return clean ? `Libre ${clean}` : "Libre";
}

async function readJson<T>(res: Response): Promise<T & { error?: string | null }> {
  const j = (await res.json().catch(() => ({}))) as T & { error?: string | null };
  return j;
}

function CopyButton({ text }: { text: string }) {
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
      {done ? "Copiado" : "Copiar"}
    </button>
  );
}

async function fetchSnapshot(bm: string): Promise<Snapshot> {
  const res = await fetch(`${routes.api.adAccountsTikTokFree}?bm=${bm}`, { credentials: "include", cache: "no-store" });
  const j = await readJson<Snapshot>(res);
  if (!res.ok) throw new Error(j.error || "No se pudo leer TikTok.");
  return j;
}

/** Solo gerencia: crear cuentas libres por tanda, verlas y entregarlas. */
export function FreeTikTokAccountsManager() {
  const [bm, setBm] = useState("300");
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const apply = useCallback((p: Promise<Snapshot>) => {
    p.then(
      (j) => {
        setSnap(j);
        setLoadError(null);
      },
      (e: unknown) => {
        setSnap(null);
        setLoadError(e instanceof Error ? e.message : "No se pudo leer TikTok.");
      },
    ).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    apply(fetchSnapshot(bm));
  }, [bm, apply]);

  const [summary, setSummary] = useState<Record<string, BmSummary>>({});
  const loadSummary = useCallback(() => {
    fetch(`${routes.api.adAccountsTikTokFree}?summary=1`, { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((j: { summary?: BmSummary[] }) => setSummary(Object.fromEntries((j.summary ?? []).map((s) => [s.bm, s]))))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  function reload(bmId: string) {
    setLoading(true);
    apply(fetchSnapshot(bmId));
    loadSummary();
  }

  return (
    <div className="space-y-4">
      {/* Business Center (v3 «opts»): tarjetas que se eligen, con sus libres y el cupo de hoy. */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" role="group" aria-label="Business Center">
        {BMS.map((b) => {
          const s = summary[b.id];
          const on = bm === b.id;
          return (
            <button
              key={b.id}
              type="button"
              aria-pressed={on}
              onClick={() => {
                if (b.id === bm) return;
                setSnap(null);
                setLoading(true);
                setBm(b.id);
              }}
              className={cn(
                "rounded-box border px-3.5 py-3 text-left",
                on ? "border-accent bg-accent-soft ring-1 ring-accent" : "border-line bg-surface hover:border-line-strong",
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink">{b.label}</span>
                {s ? (
                  <span className="num inline-flex h-5 items-center rounded-[6px] bg-subtle px-1.5 text-[11px] font-medium text-ink-2">
                    {s.free ?? "—"} libres
                  </span>
                ) : null}
              </span>
              <span className="mt-0.5 block text-xs leading-4 text-ink-2">
                {b.hint}
                {s ? ` · ${s.total ?? "—"} en total` : ""}
              </span>
              {s ? (
                <span
                  className={cn(
                    "mt-1 block text-xs font-medium leading-4",
                    s.capped ? "text-danger-fg" : s.leftToday ? "text-ok-fg" : "text-warn-fg",
                  )}
                >
                  {s.capped
                    ? "TikTok: llegó al tope, no crea más"
                    : s.leftToday
                      ? `Puedes crear ${s.leftToday} hoy`
                      : "Hoy ya llegó a 20, sigue mañana"}
                </span>
              ) : (
                <span className="mt-1 block text-xs leading-4 text-ink-3">Contando…</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(280px,380px)_minmax(0,1fr)]">
        <CreatePanel key={`create-${bm}`} bm={bm} snap={snap} onCreated={() => reload(bm)} />
        <FreeListPanel
          key={`list-${bm}`}
          bm={bm}
          snap={snap}
          loading={loading}
          loadError={loadError}
          onReload={() => reload(bm)}
        />
      </div>
      {bm === "10" ? <PendingTikTokNames /> : null}
    </div>
  );
}

function CreatePanel({ bm, snap, onCreated }: { bm: string; snap: Snapshot | null; onCreated: () => void }) {
  const [nickname, setNickname] = useState("");
  const [count, setCount] = useState(20);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Array<{ advertiserId: string; name: string; budgetZero: boolean | null }> | null>(null);

  const max = snap?.maxPerBatch ?? 20;
  const recommended = snap?.recommendedPerDay ?? 20;
  const today = snap?.createdToday ?? 0;
  const leftToday = Math.max(0, recommended - today);
  const prefix = previewPrefix(nickname);
  const bmLabel = BMS.find((b) => b.id === bm)?.label ?? bm;

  async function create() {
    const over = today + count > recommended;
    const warn = over ? `\n\nOjo: hoy ya se crearon ${today} en ${bmLabel}. Pasar de ${recommended} al día puede hacer que TikTok bloquee el BM.` : "";
    if (!window.confirm(`¿Crear ${count} cuenta(s) libre(s) en ${bmLabel} con el nombre "${prefix} N"?${warn}`)) return;
    setBusy(true);
    setError(null);
    setCreated(null);
    try {
      const res = await fetch(routes.api.adAccountsTikTokFree, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", bm, count, label: nickname }),
      });
      const j = await readJson<{ created?: Array<{ advertiserId: string; name: string; budgetZero: boolean | null }> }>(res);
      setCreated(j.created ?? []);
      if (j.error) setError(j.error);
      else if (!res.ok) setError("No se pudo crear.");
      if (j.created?.length) onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={cn(card, "space-y-4 p-4 sm:p-6")} aria-labelledby="free-create-title">
      <div>
        <h2 id="free-create-title" className="text-base font-semibold leading-6 tracking-[-0.01em] text-ink">
          Crear cuentas libres
        </h2>
        <p className="mt-0.5 text-[13px] text-ink-2">Nacen en {bmLabel} sin dueño, listas para asignar.</p>
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="free-nickname" className={label}>
          Apodo o para quién <span className={optTag}>(opcional)</span>
        </label>
        <Input
          id="free-nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Ej.: Freddy, Soporte, Sebas"
          maxLength={40}
          aria-describedby="free-nickname-hint"
        />
        <p id="free-nickname-hint" className={hint}>
          Quedarán como <b className="font-medium text-ink">{prefix} 1</b>, <b className="font-medium text-ink">{prefix} 2</b>… (sigue el
          número que ya haya). Al entregarla a un cliente, el sistema le pone el nombre del cliente.
        </p>
      </div>

      <div role="group" aria-labelledby="free-count-label">
        <p id="free-count-label" className={label}>
          Cantidad
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {QUICK_COUNTS.filter((n) => n <= max).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCount(n)}
              aria-pressed={count === n}
              className={cn(
                "num inline-flex h-8 min-w-10 items-center justify-center rounded-ctl border px-3 text-[13px] font-medium shadow-ctl",
                count === n
                  ? "border-accent-line bg-accent-soft text-accent-text"
                  : "border-line bg-field text-ink hover:border-line-strong hover:bg-hover",
              )}
            >
              {n}
            </button>
          ))}
          <div className="w-20">
            <Select value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label="Otra cantidad" className="num">
              {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <Note tone="neutral" className="mt-3">
          Recomendado: <b className="font-semibold">{recommended} por día</b> por BM. Hoy van <b className="font-semibold">{today}</b>
          {leftToday > 0 ? ` · te quedan ${leftToday}.` : " · ya llegaste, mejor sigue mañana."}
        </Note>
      </div>

      <Button onClick={() => void create()} disabled={busy || !snap} className="w-full">
        <PanelIcon name="plus" />
        {busy ? `Creando en TikTok… (puede tardar ~${Math.ceil(count * 3)} s)` : `Crear ${count} cuenta${count > 1 ? "s" : ""}`}
      </Button>

      {error ? <Note tone="warn">{error}</Note> : null}
      {created && created.length ? (
        <Note tone="ok" icon="check-circle" title={`Listo: ${created.length} creada${created.length > 1 ? "s" : ""}`}>
          <ul className="max-h-40 space-y-0.5 overflow-auto text-xs">
            {created.map((c) => (
              <li key={c.advertiserId}>
                {c.name} · <span className="font-mono">{c.advertiserId}</span>
                {c.budgetZero === false ? " · ✗ revisar cupo $0 en TikTok" : ""}
              </li>
            ))}
          </ul>
        </Note>
      ) : null}
    </section>
  );
}

function FreeListPanel({
  bm,
  snap,
  loading,
  loadError,
  onReload,
}: {
  bm: string;
  snap: Snapshot | null;
  loading: boolean;
  loadError: string | null;
  onReload: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState<"member" | "cliente">("member");

  const accounts = useMemo(() => snap?.accounts ?? [], [snap]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.advertiserId.includes(q) ||
        a.members?.some((m) => m.userName.toLowerCase().includes(q)),
    );
  }, [accounts, query]);

  const maxPick = target === "cliente" ? snap?.maxPerClienteAssign ?? 5 : snap?.maxPerBatch ?? 20;
  const picked = accounts.filter((a) => selected.has(a.advertiserId));

  function toggle(id: string) {
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else if (s.size < maxPick) s.add(id);
      return s;
    });
  }

  function done() {
    setSelected(new Set());
    onReload();
  }

  return (
    <section className={cn(card, "flex flex-col overflow-hidden")} aria-labelledby="free-list-title">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 pb-4 pt-4 sm:px-6 sm:pt-5">
        <div className="min-w-0">
          <h2 id="free-list-title" className="flex flex-wrap items-center gap-2 text-base font-semibold leading-6 tracking-[-0.01em] text-ink">
            Libres listas para asignar
            {snap ? (
              <span className="num inline-flex h-5 items-center rounded-[6px] bg-subtle px-1.5 text-[11px] font-medium text-ink-2">
                {accounts.length} en {BMS.find((b) => b.id === bm)?.label}
              </span>
            ) : null}
          </h2>
          <p className="mt-0.5 text-xs text-ink-2">Sin dueño en Hecom. Marca las que vas a entregar.</p>
        </div>
        <button type="button" onClick={onReload} disabled={loading} className={buttonClass("outline", "sm")}>
          <PanelIcon name="refresh" />
          {loading ? "Leyendo TikTok…" : "Actualizar"}
        </button>
      </div>

      <div className="px-4 pt-3 sm:px-6">
        <label className="panel-search">
          <span className="sr-only">Buscar cuentas libres</span>
          <PanelIcon name="search" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, ID o miembro…"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
      </div>

      {loadError ? (
        <div className="px-4 pt-3 sm:px-6">
          <Note tone="warn">{loadError}</Note>
        </div>
      ) : null}

      <div className="mt-3 max-h-[420px] min-h-[120px] overflow-auto border-t border-line">
        {loading && !snap ? (
          <p role="status" className="px-4 py-8 text-center text-[13px] text-ink-2">
            Leyendo las cuentas de {BMS.find((b) => b.id === bm)?.label}…
          </p>
        ) : visible.length === 0 ? (
          <div className="grid justify-items-center gap-1 px-6 py-8 text-center">
            <span aria-hidden className="mb-2 grid size-10 place-items-center rounded-box bg-subtle text-ink">
              <PanelIcon name={accounts.length ? "search" : "layers"} className="size-[18px]" />
            </span>
            <p className="font-semibold text-ink">
              {accounts.length ? "Nada coincide con la búsqueda" : "No hay cuentas libres en este BM"}
            </p>
            <p className="text-[13px] text-ink-2">
              {accounts.length ? "Prueba con otro nombre, ID o miembro." : "Crea una tanda con el formulario de la izquierda."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {visible.map((a) => {
              const on = selected.has(a.advertiserId);
              const full = !on && selected.size >= maxPick;
              return (
                <li key={a.advertiserId}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-3 px-4 py-2.5 sm:px-6",
                      on ? "bg-accent-soft" : "hover:bg-field",
                      full && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={full}
                      onChange={() => toggle(a.advertiserId)}
                      className={cn(checkbox, "mt-0.5")}
                    />
                    <span className="grid min-w-0 flex-1 leading-[1.35]">
                      <span className="truncate text-sm font-semibold text-ink">{a.name}</span>
                      <span className="font-mono text-[11px] text-ink-3">{a.advertiserId}</span>
                      <span className="text-[11px] text-ink-2">
                        {a.members === null
                          ? "Acceso: no se pudo leer"
                          : a.members.length
                            ? `Acceso: ${a.members.map((m) => m.userName).join(", ")}`
                            : "Sin miembros asignados"}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-auto border-t border-line px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-ink">
            {picked.length ? `Entregar ${picked.length} marcada${picked.length > 1 ? "s" : ""}` : "Marca cuentas para asignar"}
          </p>
          <Segmented
            label="A quién"
            value={target}
            onChange={(id) => {
              setTarget(id);
              if (id === "cliente" && selected.size > (snap?.maxPerClienteAssign ?? 5)) setSelected(new Set());
            }}
            options={[
              { value: "member", label: "A un miembro" },
              { value: "cliente", label: "A un cliente" },
            ]}
          />
        </div>
        <div className="mt-3">
          {target === "member" ? (
            <AssignToMember bm={bm} members={snap?.members ?? []} picked={picked} onDone={done} />
          ) : (
            <AssignToCliente bm={bm} picked={picked} max={snap?.maxPerClienteAssign ?? 5} onDone={done} />
          )}
        </div>
      </div>
    </section>
  );
}

function AssignToMember({ bm, members, picked, onDone }: { bm: string; members: BcMember[]; picked: FreeAccount[]; onDone: () => void }) {
  const [userId, setUserId] = useState("");
  const [manualId, setManualId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const member: BcMember | undefined = manualId.length >= 6
    ? { userId: manualId, userName: `ID ${manualId}`, email: null, role: null }
    : members.find((m) => m.userId === userId);

  async function assign() {
    if (!member) return;
    if (!window.confirm(`¿Dar a ${member.userName} acceso de administrador a ${picked.length} cuenta(s)? Siguen libres (sin cliente).`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(routes.api.adAccountsTikTokFree, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "member", bm, userId: member.userId, advertiserIds: picked.map((p) => p.advertiserId) }),
      });
      const j = await readJson<{ results?: Array<{ advertiserId: string; ok: boolean; message: string }> }>(res);
      if (!res.ok) throw new Error(j.error || "No se pudo asignar.");
      const results = j.results ?? [];
      const bad = results.filter((r) => !r.ok);
      setMsg({
        ok: bad.length === 0,
        text: bad.length
          ? `${results.length - bad.length} de ${results.length} OK. Fallaron: ${bad.map((b) => `${b.advertiserId} (${b.message})`).join("; ")}`
          : `Listo: ${member.userName} ya tiene acceso a ${results.length} cuenta(s).`,
      });
      onDone();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "No se pudo asignar." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="min-w-0 sm:flex-1">
          <Select value={userId} onChange={(e) => setUserId(e.target.value)} aria-label="Miembro del BC">
            <option value="">{members.length ? "Elige un miembro del equipo" : "Aún no hay miembros en las libres"}</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.userName}
                {m.email ? ` · ${m.email}` : ""}
              </option>
            ))}
          </Select>
        </div>
        <Button onClick={() => void assign()} disabled={busy || !member || !picked.length}>
          {busy ? "Asignando…" : "Dar acceso"}
        </Button>
      </div>
      <Input
        value={manualId}
        onChange={(e) => setManualId(e.target.value.replace(/\D/g, ""))}
        placeholder="¿Miembro nuevo? Pega su user ID de TikTok (BC → Usuarios)"
        aria-label="User ID de TikTok del miembro"
        inputMode="numeric"
      />
      <p className={hint}>Administrador solo de esas cuentas, nunca del BM.</p>
      {msg ? (
        <Note tone={msg.ok ? "ok" : "warn"} icon={msg.ok ? "check-circle" : "alert"}>
          {msg.text}
        </Note>
      ) : null}
    </div>
  );
}

function AssignToCliente({ bm, picked, max, onDone }: { bm: string; picked: FreeAccount[]; max: number; onDone: () => void }) {
  const [clientes, setClientes] = useState<ClienteOption[] | null>(null);
  const [query, setQuery] = useState("");
  const [cliente, setCliente] = useState<ClienteOption | null>(null);
  const [users, setUsers] = useState<TikTokUser[] | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [manualUser, setManualUser] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [given, setGiven] = useState<GivenToCliente[] | null>(null);

  useEffect(() => {
    let alive = true;
    void fetch("/api/clientes", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((j: { clients?: ClienteOption[] }) => {
        if (alive) setClientes((j.clients ?? []).map((c) => ({ id: c.id, name: c.name })));
      })
      .catch(() => alive && setClientes([]));
    return () => {
      alive = false;
    };
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !clientes) return [];
    return clientes.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [clientes, query]);

  async function pickCliente(c: ClienteOption) {
    setCliente(c);
    setQuery(c.name);
    setUsers(null);
    setGiven(null);
    setError(null);
    try {
      const res = await fetch(`${routes.api.adAccountsTikTokFree}?clienteId=${encodeURIComponent(c.id)}`, { credentials: "include", cache: "no-store" });
      const j = await readJson<{ users?: TikTokUser[] }>(res);
      const list = j.users ?? [];
      setUsers(list);
      setChecked(new Set(list.filter((u) => u.suggested).map((u) => u.userId)));
    } catch {
      setUsers([]);
    }
  }

  async function assign() {
    if (!cliente) return;
    const accessUserIds = [...checked];
    if (manualUser.trim()) accessUserIds.push(manualUser.trim());
    const who = accessUserIds.length ? `y dar acceso a ${accessUserIds.length} usuario(s) suyo(s)` : "SIN dar acceso a nadie en TikTok";
    if (!window.confirm(`¿Entregar ${picked.length} cuenta(s) a ${cliente.name} ${who}?`)) return;
    setBusy(true);
    setError(null);
    setGiven(null);
    try {
      const res = await fetch(routes.api.adAccountsTikTokFree, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cliente", bm, clienteId: cliente.id, accessUserIds, advertiserIds: picked.map((p) => p.advertiserId) }),
      });
      const j = await readJson<{ created?: GivenToCliente[] }>(res);
      setGiven(j.created ?? []);
      if (j.error) setError(j.error);
      else if (!res.ok) setError("No se pudo entregar.");
      if (j.created?.length) onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo entregar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCliente(null);
          }}
          placeholder={clientes ? "Busca el cliente por nombre" : "Cargando clientes…"}
          aria-label="Cliente"
        />
        {!cliente && matches.length ? (
          <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-box border border-line bg-surface p-1 shadow-pop">
            {matches.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => void pickCliente(c)}
                  className="flex w-full items-center gap-2 rounded-ctl px-2 py-1.5 text-left text-sm text-ink hover:bg-hover"
                >
                  <Avatar name={c.name} size="sm" />
                  <span className="truncate">{c.name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {cliente ? (
        <div>
          <p className={label}>Darle acceso en TikTok (administrador solo de la cuenta)</p>
          {users === null ? (
            <p className="mt-1.5 text-[13px] text-ink-2">Buscando sus usuarios de TikTok…</p>
          ) : users.length ? (
            <ul className="mt-1.5 space-y-1.5">
              {users.map((u) => (
                <li key={u.userId}>
                  <label className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-ink">
                    <input
                      type="checkbox"
                      checked={checked.has(u.userId)}
                      onChange={() =>
                        setChecked((prev) => {
                          const s = new Set(prev);
                          if (s.has(u.userId)) s.delete(u.userId);
                          else s.add(u.userId);
                          return s;
                        })
                      }
                      className={checkbox}
                    />
                    <span className="font-medium">{u.userName}</span>
                    <span className="text-xs text-ink-3">
                      en {u.accounts} cuenta(s){u.suggested ? " · cliente" : ""}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-[13px] text-ink-2">No encontré usuarios en sus cuentas actuales.</p>
          )}
          <div className="mt-2 max-w-xs">
            <Input
              value={manualUser}
              onChange={(e) => setManualUser(e.target.value.replace(/\D/g, ""))}
              placeholder="Otro user ID de TikTok (opcional)"
              aria-label="Otro user ID de TikTok"
              inputMode="numeric"
            />
          </div>
          <p className={cn(hint, "mt-1.5")}>Desmarca al equipo: ellos ya ven todo por el BM.</p>
        </div>
      ) : null}

      <Button onClick={() => void assign()} disabled={busy || !cliente || !picked.length}>
        {busy ? "Entregando…" : `Entregar ${picked.length || ""} a ${cliente?.name ?? "cliente"}`.replace("  ", " ")}
      </Button>
      <p className={hint}>
        Hasta {max} por vez. Queda en su ficha de Hecom y en su panel al instante (BM 10/30 con cupo $0).
      </p>

      {error ? <Note tone="warn">{error}</Note> : null}
      {given && given.length ? (
        <div className="space-y-2">
          <TikTokRenameStatus accounts={given} />
          <ul className="space-y-2">
            {given.map((c) => (
              <li key={c.advertiserId} className="rounded-box border border-ok-line bg-ok-bg px-3 py-2.5 text-[13px] text-ok-fg">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {c.advertiserName} <CopyButton text={c.advertiserName} />
                </p>
                <p className="font-mono text-xs">{c.advertiserId}</p>
                <p className="text-xs">
                  Hecom {c.hecomLinked ? "✓" : "✗ (vincular a mano)"} · Panel {c.inPanel ? "✓" : "pendiente"}
                  {c.budgetZero === null ? "" : ` · Cupo $0 ${c.budgetZero ? "✓" : "✗"}`}
                  {c.access.length ? ` · Acceso ${c.access.filter((a) => a.ok).length}/${c.access.length}` : " · Sin acceso a cliente"}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
