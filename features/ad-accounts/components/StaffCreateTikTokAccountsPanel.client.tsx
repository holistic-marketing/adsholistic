"use client";
import { dispatchAdAccountsUpdated } from "@/lib/events/modal-events";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { Note, Segmented } from "@/components/ui/PanelKit";
import { routes } from "@/config/routes";
import { cn } from "@/lib/cn";
import { TikTokRenameStatus } from "./TikTokRenameStatus.client";

type TikTokUser = { userId: string; userName: string; accounts: number; suggested: boolean };
type Created = {
  advertiserId: string;
  advertiserName: string;
  bmBucket: string;
  hecomLinked: boolean;
  inPanel: boolean;
  budgetZero: boolean | null;
  access: Array<{ userId: string; ok: boolean; message: string }>;
  renameRequested?: boolean | null;
  renameManual?: boolean;
  renameMessage?: string;
};

const BMS: Array<{ id: string; label: string; hint: string }> = [
  { id: "300", label: "BM 300", hint: "Cash · se recarga por transferencia" },
  { id: "200", label: "BM 200", hint: "Cash · se recarga por transferencia" },
  { id: "30", label: "BM 30", hint: "Crédito compartido · nace con cupo $0" },
  { id: "10", label: "BM 10", hint: "Crédito compartido · nace con cupo $0" },
];

/** Solo gerencia: crear cuentas TikTok para el cliente seleccionado en cualquier BM. */
export function StaffCreateTikTokAccountsPanel({ clienteName }: { clienteName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [bm, setBm] = useState("300");
  const [count, setCount] = useState(1);
  const [users, setUsers] = useState<TikTokUser[] | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [manualUser, setManualUser] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created[] | null>(null);
  // "free": entrega cuentas de reserva ("gian libre 151"…) que ya existen en el BM.
  const [mode, setMode] = useState<"create" | "free">("create");
  const [freeByBm, setFreeByBm] = useState<Record<string, number | null>>({});
  const freeHere = freeByBm[bm] ?? null;

  async function loadUsers() {
    setLoadingUsers(true);
    setError(null);
    try {
      const res = await fetch(routes.api.adAccountsTikTokStaffCreate, { credentials: "include", cache: "no-store" });
      const j = (await res.json()) as { users?: TikTokUser[]; freeByBm?: Record<string, number | null>; error?: string };
      if (!res.ok) throw new Error(j.error || "No se pudo leer los usuarios de TikTok.");
      setFreeByBm(j.freeByBm ?? {});
      const list = j.users ?? [];
      setUsers(list);
      setChecked(new Set(list.filter((u) => u.suggested).map((u) => u.userId)));
    } catch (e) {
      setUsers([]);
      setError(e instanceof Error ? e.message : "No se pudo leer los usuarios de TikTok.");
    } finally {
      setLoadingUsers(false);
    }
  }

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && users === null) void loadUsers();
  }

  function toggleUser(id: string) {
    setChecked((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  async function create() {
    const accessUserIds = [...checked];
    const manual = manualUser.trim();
    if (manual) accessUserIds.push(manual);
    const bmLabel = BMS.find((b) => b.id === bm)?.label ?? bm;
    const who = accessUserIds.length ? `y dar acceso a ${accessUserIds.length} usuario(s)` : "SIN dar acceso a nadie";
    const verb = mode === "free" ? "Dar" : "Crear";
    const kind = mode === "free" ? "cuenta(s) libre(s)" : "cuenta(s)";
    if (!window.confirm(`¿${verb} ${count} ${kind} en ${bmLabel} para ${clienteName} ${who}?`)) return;
    setBusy(true);
    setError(null);
    setCreated(null);
    try {
      const res = await fetch(routes.api.adAccountsTikTokStaffCreate, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bmBucket: bm, count, accessUserIds, mode }),
      });
      const j = (await res.json()) as { created?: Created[]; error?: string | null };
      setCreated(j.created ?? []);
      if (j.error) setError(j.error);
      else if (!res.ok) setError("No se pudo crear.");
      if (j.created?.length) {
        router.refresh();
        dispatchAdAccountsUpdated();
        if (mode === "free") setFreeByBm((prev) => ({ ...prev, [bm]: Math.max(0, (prev[bm] ?? 0) - (j.created?.length ?? 0)) }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-card border border-line bg-surface shadow-card">
      <button
        type="button"
        onClick={toggleOpen}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left sm:px-6 sm:py-5"
        aria-expanded={open}
        aria-controls="staff-create-tiktok-body"
      >
        <span className="min-w-0">
          <span className="eyebrow block">Solo gerencia</span>
          <span className="mt-0.5 block text-base font-semibold leading-6 tracking-[-0.01em] text-ink">
            Crear o dar cuentas TikTok a {clienteName}
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-accent-text">
          {open ? "Cerrar" : "Abrir"}
          <PanelIcon name="chevron-down" className={cn("size-3.5 transition-transform", open && "rotate-180")} />
        </span>
      </button>

      {open ? (
        <div id="staff-create-tiktok-body" className="space-y-4 border-t border-line px-4 pb-6 pt-4 sm:px-6">
          <p className="text-[13px] leading-5 text-ink-2">
            Sin límite de cupo. La cuenta queda vinculada a su ficha de Hecom y en su panel al instante, con el nombre
            correlativo del BM (ej. 303.0 USD - Agencia).
          </p>

          <Segmented
            label="Qué quieres hacer"
            value={mode}
            onChange={setMode}
            options={[
              { value: "create", label: "Crear nuevas" },
              { value: "free", label: "Dar cuentas libres" },
            ]}
          />
          {mode === "free" ? (
            <p className="text-[13px] leading-5 text-ink-2">
              Usa cuentas de reserva existentes. Se entregan con cupo cero y se asignan al cliente en Hecom y en su panel,
              con acceso para sus usuarios y el nombre del cliente en TikTok.
            </p>
          ) : null}

          <div role="group" aria-labelledby="staff-create-bm-label">
            <p id="staff-create-bm-label" className="text-sm font-medium text-ink">
              Business Center
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {BMS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBm(b.id)}
                  aria-pressed={bm === b.id}
                  className={cn(
                    "rounded-box border px-3.5 py-3 text-left",
                    bm === b.id
                      ? "border-accent bg-accent-soft ring-1 ring-accent"
                      : "border-line bg-surface hover:border-line-strong",
                  )}
                >
                  <span className="block text-sm font-semibold text-ink">{b.label}</span>
                  <span className="mt-0.5 block text-xs leading-4 text-ink-2">
                    {mode === "free"
                      ? freeByBm[b.id] == null
                        ? "Contando libres…"
                        : `${freeByBm[b.id]} libre${freeByBm[b.id] === 1 ? "" : "s"}`
                      : b.hint}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-1.5">
            <label htmlFor="staff-create-count" className="text-sm font-medium text-ink">
              Cantidad
            </label>
            <div className="w-28">
              <Select id="staff-create-count" value={count} onChange={(e) => setCount(Number(e.target.value))}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-ink">Dar acceso en TikTok (administrador solo de la cuenta, nunca del BM)</p>
            {loadingUsers ? (
              <p className="mt-2 text-[13px] text-ink-2">Buscando sus usuarios de TikTok…</p>
            ) : users && users.length ? (
              <ul className="mt-2 space-y-1.5">
                {users.map((u) => (
                  <li key={u.userId}>
                    <label className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-ink">
                      <input
                        type="checkbox"
                        checked={checked.has(u.userId)}
                        onChange={() => toggleUser(u.userId)}
                        className="size-4 accent-accent-btn"
                      />
                      <span className="font-medium">{u.userName}</span>
                      <span className="text-xs text-ink-3">
                        <span className="font-mono">{u.userId}</span> · en {u.accounts} cuenta(s){u.suggested ? " · cliente" : ""}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[13px] text-ink-2">No encontré usuarios en sus cuentas actuales.</p>
            )}
            <div className="mt-2 max-w-xs">
              <Input
                value={manualUser}
                onChange={(e) => setManualUser(e.target.value.replace(/\D/g, ""))}
                placeholder="Otro user ID de TikTok (opcional)"
                aria-label="Otro user ID de TikTok (opcional)"
                inputMode="numeric"
              />
            </div>
            <p className="mt-1.5 text-xs text-ink-3">Desmarca al equipo (Sebas, Atter, etc.): ellos ya ven todo por el BM.</p>
          </div>

          <Button
            onClick={() => void create()}
            disabled={busy || (mode === "free" && (freeHere ?? 0) < count)}
          >
            <PanelIcon name="plus" />
            {busy
              ? mode === "free" ? "Entregando…" : "Creando en TikTok…"
              : mode === "free"
                ? (freeHere ?? 0) < count
                  ? `No hay ${count} libre${count > 1 ? "s" : ""} en este BM`
                  : `Dar ${count} cuenta${count > 1 ? "s" : ""} libre${count > 1 ? "s" : ""}`
                : `Crear ${count} cuenta${count > 1 ? "s" : ""}`}
          </Button>

          {error ? <Note tone="warn">{error}</Note> : null}

          {created && created.length ? <TikTokRenameStatus accounts={created} /> : null}

          {created && created.length ? (
            <ul className="space-y-2">
              {created.map((c) => (
                <li key={c.advertiserId} className="rounded-box border border-ok-line bg-ok-bg px-3 py-2.5 text-[13px] text-ok-fg">
                  <p className="font-semibold">{c.advertiserName}</p>
                  <p className="font-mono text-xs">{c.advertiserId}</p>
                  <p className="mt-1 text-xs">
                    Hecom {c.hecomLinked ? "✓" : "✗ (vincular a mano)"} · Panel {c.inPanel ? "✓" : "pendiente"}
                    {c.budgetZero === null ? "" : ` · Cupo $0 ${c.budgetZero ? "✓" : "✗ revisar en TikTok"}`}
                    {c.access.length
                      ? ` · Acceso ${c.access.filter((a) => a.ok).length}/${c.access.length}`
                      : " · Sin acceso a cliente"}
                  </p>
                  {c.access.filter((a) => !a.ok).map((a) => (
                    <p key={a.userId} className="text-xs text-warn-fg">
                      Acceso {a.userId}: {a.message}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
