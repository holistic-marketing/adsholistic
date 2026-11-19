"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PanelIcon } from "@/components/ui/PanelIcon";
import type { MonitorAccount, MonitorCliente } from "@/features/ops/types/prepago-monitor";

type Result = {
  advertiserId: string;
  ok: boolean;
  removedUsd: number;
  leftUsd: number | null;
  pausedCampaigns?: number;
  message: string;
};
type Action = "bajar" | "cero" | "congelar";

const usdFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const usd = (v: number | null | undefined) => usdFmt.format(Number(v) || 0);

/**
 * Gerencia le quita saldo a un cliente o lo congela (no puede gastar más).
 * Ver app/api/ops/frenar-gasto/route.ts.
 */
export function FrenarGasto({ cliente, onDone }: { cliente: MonitorCliente; onDone: () => void }) {
  const [motivo, setMotivo] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nameOf = new Map(cliente.accounts.map((a) => [a.advertiserId, a.name]));
  const accounts = [...cliente.accounts].sort(
    (a, b) => Number(a.status === "banned") - Number(b.status === "banned") || spendable(b) - spendable(a),
  );
  const total = cliente.accounts.reduce((s, a) => s + (a.status === "banned" ? 0 : spendable(a)), 0);

  async function run(action: Action, account?: MonitorAccount) {
    setError(null);
    if (motivo.trim().length < 3) {
      setError("Primero escribe el motivo y quién lo ordenó.");
      return;
    }
    const amount = account ? Number(amounts[account.advertiserId]) : NaN;
    if (action === "bajar" && !(amount > 0)) {
      setError("Escribe cuánto quieres bajar.");
      return;
    }
    const question =
      action === "congelar"
        ? `¿Congelar a ${cliente.name}? Se pausan sus campañas y sus ${cliente.accounts.length} cuenta(s) quedan en $0 para gastar.`
        : action === "cero"
          ? `¿Dejar ${account!.name} en $0 para gastar?`
          : `¿Bajar ${usd(amount)} a ${account!.name}?`;
    if (!window.confirm(question)) return;

    setBusy(account ? `${action}:${account.advertiserId}` : action);
    setResults(null);
    try {
      const res = await fetch("/api/ops/frenar-gasto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId: cliente.id,
          action,
          advertiserId: account?.advertiserId,
          amountUsd: action === "bajar" ? amount : undefined,
          motivo: motivo.trim(),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { results?: Result[]; error?: string };
      if (!res.ok && !j.results) throw new Error(j.error || "No se pudo aplicar.");
      setResults(j.results ?? []);
      if (account) setAmounts((prev) => ({ ...prev, [account.advertiserId]: "" }));
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo aplicar.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby={`frenar-${cliente.id}`} className="rounded-card border border-danger-line bg-surface p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-[1_1_240px]">
          <h3 id={`frenar-${cliente.id}`} className="eyebrow text-danger-fg">
            Frenar gasto
          </h3>
          <p className="mt-1 text-[13px] leading-5 text-ink-2">
            Quita saldo de sus cuentas en TikTok. En BM 10/30 baja el cupo; en BM 200/300 devuelve el cash al BM.
            Lo que pagó sigue a su favor en Hecom.
          </p>
        </div>
        <p className="shrink-0 text-right text-xs text-ink-3">
          Hoy puede gastar
          <span className="num block text-[15px] font-semibold text-ink">
            {cliente.unlimitedAccounts ? "Sin tope" : usd(total)}
          </span>
        </p>
      </div>

      <label className="mt-4 grid gap-1.5">
        <span className="text-sm font-medium text-ink">Motivo y quién lo ordenó (obligatorio)</span>
        <Input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={300}
          placeholder="Ej: Debe setiembre, ordenó gerencia"
        />
      </label>

      <ul className="mt-3 rounded-box border border-line">
        {accounts.map((a) => {
          const banned = a.status === "banned";
          const key = a.advertiserId;
          return (
            <li
              key={key}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-3 py-2.5 last:border-b-0"
            >
              <div className="min-w-0 flex-[1_1_180px]">
                <p className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-ink">
                  <span className="panel-badge tone-neutral num shrink-0">BM{a.bm}</span>
                  <span className="truncate">{a.name}</span>
                  {banned ? <span className="panel-badge tone-danger shrink-0">Castigada</span> : null}
                </p>
                <p className="mt-0.5 text-xs text-ink-2">
                  Puede gastar{" "}
                  <span className="num font-semibold text-ink">{a.unlimited ? "sin tope" : usd(a.spendableUsd)}</span>
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-20">
                  <Input
                    inputMode="decimal"
                    aria-label={`Monto a bajar de ${a.name}`}
                    value={amounts[key] ?? ""}
                    onChange={(e) => setAmounts((prev) => ({ ...prev, [key]: e.target.value.replace(/[^\d.]/g, "") }))}
                    placeholder="$"
                    className="num h-8! px-2! text-right"
                  />
                </span>
                <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => void run("bajar", a)}>
                  {busy === `bajar:${key}` ? "Bajando…" : "Bajar"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => void run("cero", a)}
                  className="text-danger-fg!"
                >
                  {busy === `cero:${key}` ? "Aplicando…" : "Dejar en $0"}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-[1_1_220px] text-xs leading-4 text-ink-3">
          Congelar pausa sus campañas y deja todas sus cuentas en $0. Para habilitarlo otra vez, recárgale como siempre.
        </p>
        <Button
          variant="danger"
          size="sm"
          disabled={busy !== null || cliente.accounts.length === 0}
          onClick={() => void run("congelar")}
        >
          {busy === "congelar" ? "Congelando…" : "Congelar: no puede gastar más"}
        </Button>
      </div>

      {error ? (
        <p role="alert" className="mt-2 flex items-start gap-1.5 text-xs text-danger-fg">
          <PanelIcon name="alert" className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      ) : null}
      {results ? (
        <ul className="mt-3 space-y-1 rounded-box border border-line bg-field px-3 py-2.5 text-xs leading-5">
          {results.map((r) => (
            <li key={r.advertiserId} className={`flex items-start gap-1.5 ${r.ok ? "text-ok-fg" : "text-danger-fg"}`}>
              <PanelIcon name={r.ok ? "check" : "x"} className="mt-0.5 size-3.5 shrink-0" />
              <span className="min-w-0">
                <span className="font-semibold">{nameOf.get(r.advertiserId) ?? r.advertiserId}</span>
                {r.ok && r.removedUsd > 0 ? ` · quitado ${usd(r.removedUsd)}` : ""}
                {r.ok && r.leftUsd != null ? ` · queda ${usd(r.leftUsd)}` : ""} · {r.message}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function spendable(a: MonitorAccount): number {
  return Number(a.spendableUsd) || 0;
}
