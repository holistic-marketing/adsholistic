"use client";
import Link from "next/link";
import { ToneBadge, type Tone } from "@/components/ui/PanelKit";
import type { ClienteScore } from "@/lib/realprofit/client-score";
import { cn } from "@/lib/cn";
import { Disclosure } from "./ui";

export type Snapshot = {
  cliente: { id: string; name: string }; from: string; to: string;
  analysis: {
    spendInRange: number; daysWithActivity: number; dataThroughDate: string | null;
    cpaCollected: number | null; hasCodLink: boolean; roasCollected: number | null;
    perf: { available: boolean; avgCpm: number | null; error: string | null; fetchedAt: string | null };
  };
  staffOps?: { score?: ClienteScore | null; walletAvailableUsd: number | null; collections?: { deposits90d: number | null; failedDeposits90d: number | null } };
};
const verdicts = { green: "Riesgo bajo", yellow: "Riesgo moderado", orange: "Riesgo alto", red: "Riesgo muy alto", no_base: "Sin base suficiente" };
const verdictTone: Record<keyof typeof verdicts, Tone> = { green: "ok", yellow: "warn", orange: "warn", red: "danger", no_base: "neutral" };
const factors = { ads: "Publicidad", credit: "Uso del crédito", collections: "Depósitos", tickets: "Soporte" };

/** Score de riesgo de gerencia y datos de cobro del cliente evaluado. */
export function CreditBehavior({ snapshot }: { snapshot: Snapshot }) {
  const score = snapshot.staffOps?.score;
  const verdict = score?.verdict ?? "no_base";
  const tone = verdictTone[verdict];
  const usd = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? "Sin datos" : new Intl.NumberFormat("es-PE", { style: "currency", currency: "USD" }).format(value);
  const facts: [string, string | number][] = [
    ["Depósitos confirmados · 90 días",snapshot.staffOps?.collections?.deposits90d ?? "Sin datos"],
    ["Cartera disponible", usd(snapshot.staffOps?.walletAvailableUsd)],
    ["CPA por venta cobrada", snapshot.analysis.hasCodLink ? usd(snapshot.analysis.cpaCollected) : "Sin tienda vinculada"],
    ["ROAS cobrado", snapshot.analysis.hasCodLink && snapshot.analysis.roasCollected != null ? `${snapshot.analysis.roasCollected.toFixed(2)}×` : "Sin datos"],
  ];
  return <section aria-label="Score del cliente" className="grid gap-4">
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[1.75rem] font-semibold leading-tight tracking-[-0.03em] text-ink tabular-nums">
          {score?.score ?? "—"}<span className="ml-1 text-base font-normal text-ink-3">/ 100</span>
        </p>
        <ToneBadge tone={tone} dot>{verdicts[verdict]}</ToneBadge>
      </div>
      {score?.score != null ? <div className={cn("mt-3", `tone-${tone}`)}>
        <div className="h-1.5 overflow-hidden rounded-full bg-subtle" role="img" aria-label={`Score ${score.score} de 100`}>
          <i className="block h-full rounded-full bg-[var(--t-solid)]" style={{ width: `${score.score}%` }} />
        </div>
        <div className="mt-1.5 flex justify-between gap-1 text-[11px] text-ink-3"><span>0 · Bajo</span><span>30 · Moderado</span><span>60 · Alto</span><span>80 · Muy alto</span></div>
      </div> : null}
      <p className="mt-2 text-xs text-ink-2">Menor score = menor riesgo. No equivale a una aprobación de crédito.</p>
    </div>
    <dl className="grid grid-cols-2 gap-2">{facts.map(([label, value]) => <div key={label} className="min-w-0 rounded-box border border-line bg-field px-3 py-2.5">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-3">{label}</dt>
      <dd className="num mt-0.5 text-[15px] font-semibold text-ink [overflow-wrap:anywhere]">{value}</dd>
    </div>)}</dl>
    <Disclosure summary="Cómo se calcula y qué datos incluye">
      <p className="text-xs">Modelo existente: publicidad 45%, uso del crédito 30%, depósitos 15% y soporte 10%. Los factores sin datos se excluyen y se redistribuyen los pesos. No mide una probabilidad de impago.</p>
      {score?.factors.length ? <dl className="grid grid-cols-2 gap-2">{score.factors.map((factor) => <div key={factor.id}><dt className="text-xs text-ink-3">{factors[factor.id]}</dt><dd className="font-medium text-ink">{factor.points === null ? "Sin datos" : `${factor.points}/100 de salud`}</dd></div>)}</dl> : null}
      <p className="text-xs">Score: anuncios de 30 días, crédito y depósitos de 90 días. CPA y ROAS: {snapshot.from} a {snapshot.to}. Gasto actualizado hasta {snapshot.analysis.dataThroughDate ?? "fecha desconocida"}. Depósitos: hasta 200 movimientos del ledger; los intentos fallidos no equivalen a mora. La cartera registrada no prueba capacidad de pago.</p>
      <div className="flex flex-wrap gap-4 font-medium text-accent-text"><Link href="/profit" className="underline underline-offset-4">Ver anuncios en Profit</Link><Link href="/payments/profit" className="underline underline-offset-4">Ver pagos y comprobantes</Link></div>
    </Disclosure>
  </section>;
}
