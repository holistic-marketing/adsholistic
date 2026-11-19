"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PanelCard } from "@/components/ui/PageHeader";
import { Note } from "@/components/ui/PanelKit";
import { cn } from "@/lib/cn";

type Scope = "month" | "from_today";
type Preview =
  | {
      scope: "month";
      month: string;
      feePercent: number;
      rows: number;
      spend: number;
      currentFees: number[];
      feeBefore: number;
      feeAfter: number;
      delta: number;
      pastMonth: boolean;
      currentMonth: boolean;
      clienteDefaultFee: number | null;
    }
  | { scope: "from_today"; feePercent: number; clienteDefaultFee: number | null; currentFees: number[]; accounts: number };
type Log = { at: string; by: string; scope: Scope; month: string | null; feePercent: number; from: number[]; delta: number | null };

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${MONTHS[Number(m) - 1] ?? m} ${y}`;
}

function limaMonth(offset = 0): string {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Lima" }));
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const usd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const pcts = (list: number[]) => (list.length ? list.map((p) => `${p}%`).join(" / ") : "sin %");

const SCOPES = [
  ["month", "Un mes", "Cambia el cobro de ese mes"],
  ["from_today", "Desde hoy", "Lo de antes no cambia"],
] as const;

/** Solo gerencia: cambiar el % del cliente para un mes o desde hoy, con vista previa e historial. */
export function ClienteFeeCard({ clienteId, currentFee }: { clienteId: string; currentFee: number | null }) {
  const api = `/api/clientes/${clienteId}/fee`;
  const [fee, setFee] = useState<number | null>(currentFee);
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<Scope>("month");
  const [month, setMonth] = useState(() => limaMonth(-1));
  const [pct, setPct] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [history, setHistory] = useState<Log[] | null>(null);

  const loadHistory = useCallback(() => {
    fetch(api, { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((j: { history?: Log[] }) => setHistory(j.history ?? []))
      .catch(() => setHistory([]));
  }, [api]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  function reset() {
    setPreview(null);
    setError(null);
  }

  async function check() {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const q = new URLSearchParams({ scope, fee: pct.replace(",", ".") });
      if (scope === "month") q.set("month", month);
      const res = await fetch(`${api}?${q}`, { credentials: "include", cache: "no-store" });
      const j = (await res.json().catch(() => ({}))) as { preview?: Preview; error?: string };
      if (!res.ok || !j.preview) throw new Error(j.error || "No se pudo calcular.");
      setPreview(j.preview);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo calcular.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(api, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: preview.scope, fee: preview.feePercent, month: preview.scope === "month" ? preview.month : undefined }),
      });
      const j = (await res.json().catch(() => ({}))) as { updated?: number; error?: string };
      if (!res.ok) throw new Error(j.error || "No se guardó.");
      setDone(
        preview.scope === "month"
          ? `Listo: ${monthLabel(preview.month)} quedó en ${preview.feePercent}% (${j.updated ?? 0} filas de gasto).`
          : `Listo: desde hoy se cobra ${preview.feePercent}% (cliente y ${j.updated ?? 0} cuenta(s)).`,
      );
      if (preview.scope === "from_today") setFee(preview.feePercent);
      setPreview(null);
      setOpen(false);
      setPct("");
      loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se guardó.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PanelCard
      title="Comisión (%)"
      description={
        <>
          Hoy se le cobra <strong className="font-semibold text-ink">{fee != null ? `${fee}%` : "10% (sin % propio)"}</strong> sobre su gasto.
        </>
      }
      action={
        open ? null : (
          <Button
            size="sm"
            onClick={() => {
              setOpen(true);
              setDone(null);
            }}
          >
            Cambiar %
          </Button>
        )
      }
    >
      {done ? (
        <Note tone="ok" icon="check-circle">
          {done}
        </Note>
      ) : null}

      {open ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Desde cuándo">
            {SCOPES.map(([value, title, hint]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={scope === value}
                onClick={() => {
                  setScope(value);
                  reset();
                }}
                className={cn(
                  "rounded-box border px-3.5 py-3 text-left transition-colors",
                  scope === value ? "border-accent bg-accent-soft ring-1 ring-accent" : "border-line bg-surface hover:border-line-strong",
                )}
              >
                <b className="block text-sm font-semibold text-ink">{title}</b>
                <small className="mt-0.5 block text-xs leading-snug text-ink-3">{hint}</small>
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {scope === "month" ? (
              <label className="grid min-w-0 gap-1.5">
                <span className="text-sm font-medium text-ink">Mes</span>
                <Input
                  type="month"
                  value={month}
                  max={limaMonth(0)}
                  onChange={(e) => {
                    setMonth(e.target.value);
                    reset();
                  }}
                />
              </label>
            ) : null}
            <label className="grid min-w-0 gap-1.5">
              <span className="text-sm font-medium text-ink">Nuevo %</span>
              <Input
                inputMode="decimal"
                value={pct}
                placeholder="ej. 7"
                className="num"
                onChange={(e) => {
                  setPct(e.target.value.replace(/[^\d.,]/g, ""));
                  reset();
                }}
              />
            </label>
          </div>

          {preview ? (
            <div className="space-y-2 rounded-box border border-line bg-field px-3.5 py-3 text-[13px] leading-relaxed text-ink">
              {preview.scope === "month" ? (
                <>
                  <p>
                    <strong className="font-semibold">{monthLabel(preview.month)}</strong>: gasto{" "}
                    <span className="tabular-nums">{usd(preview.spend)}</span> en {preview.rows} filas, hoy a {pcts(preview.currentFees)}.
                  </p>
                  <p>
                    Comisión del mes: <span className="tabular-nums">{usd(preview.feeBefore)}</span> →{" "}
                    <strong className="font-semibold tabular-nums">{usd(preview.feeAfter)}</strong> ({preview.feePercent}%).{" "}
                    {preview.delta === 0 ? "Sin cambio." : preview.delta > 0 ? `Le suma ${usd(preview.delta)}.` : `Le baja ${usd(-preview.delta)}.`}
                  </p>
                  {preview.rows === 0 ? <p className="text-warn-fg">Ese mes no tiene gasto registrado: no hay nada que cambiar.</p> : null}
                  {preview.pastMonth && preview.delta !== 0 ? (
                    <Note tone="warn">
                      Ojo: si este mes ya se le cobró o ya lo pagó, su deuda cambia en {usd(Math.abs(preview.delta))}
                      {preview.delta > 0 ? " (le quedará debiendo eso)" : " (le quedará saldo a favor)"}.
                    </Note>
                  ) : null}
                  {preview.currentMonth ? (
                    <p className="text-xs text-ink-2">
                      Este mes sigue en curso: los días que falten entran con su % actual ({preview.clienteDefaultFee ?? 10}%). Si quieres que siga
                      así, cambia también «Desde hoy».
                    </p>
                  ) : null}
                </>
              ) : (
                <p>
                  Pasa de {pcts(preview.currentFees)} a <strong className="font-semibold">{preview.feePercent}%</strong> en el cliente y sus{" "}
                  {preview.accounts} cuenta(s). Lo gastado hasta ayer no cambia; el gasto de hoy en adelante y sus recargas usan{" "}
                  {preview.feePercent}%.
                </p>
              )}
            </div>
          ) : null}

          {error ? <Note tone="warn">{error}</Note> : null}

          <div className="flex flex-wrap gap-2">
            {preview && !(preview.scope === "month" && preview.rows === 0) ? (
              <Button disabled={busy} onClick={() => void save()}>
                {busy ? "Guardando…" : `Confirmar ${preview.feePercent}%`}
              </Button>
            ) : (
              <Button disabled={busy || !pct} onClick={() => void check()}>
                {busy ? "Calculando…" : "Ver cómo queda"}
              </Button>
            )}
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setPct("");
                reset();
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      {history && history.length ? (
        <div className={cn((open || done) && "mt-5 border-t border-line pt-4")}>
          <h3 className="text-sm font-semibold text-ink">Historial</h3>
          <ul className="mt-1">
            {history.map((h) => (
              <li
                key={h.at}
                className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-line py-2.5 text-[13px] last:border-0"
              >
                <span className="min-w-0">
                  <b className="font-semibold text-ink">
                    {h.scope === "month" && h.month ? monthLabel(h.month) : "Desde hoy"}: {pcts(h.from)} → {h.feePercent}%
                  </b>
                  {h.delta ? (
                    <span className="tabular-nums text-ink-2">{` (${h.delta > 0 ? "+" : "−"}${usd(Math.abs(h.delta))})`}</span>
                  ) : null}
                  <small className="block text-xs text-ink-3">{h.by}</small>
                </span>
                <span className="num shrink-0 text-xs text-ink-3">
                  {new Date(h.at).toLocaleString("es-PE", { timeZone: "America/Lima", dateStyle: "short", timeStyle: "short" })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : history && !open && !done ? (
        <p className="text-[13px] text-ink-3">Sin cambios de comisión registrados.</p>
      ) : null}
    </PanelCard>
  );
}
