"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { Note, StatCard } from "@/components/ui/PanelKit";
import { feeImpact } from "@/lib/business-simulator/client-impact";
import { cn } from "@/lib/cn";
import type { Snapshot } from "./CreditBehavior.client";
import { BlockTitle, Disclosure, FieldHint, fieldLabel, footnote, statGrid, textButton } from "./ui";

export type FeeReference = {
  feeHolisticPercent: number | null; feeSource: string; hecomClienteId: string;
  warnings?: string[]; checkedAt?: string; verifiedPayments?: number;
  history?: { paymentId: string; date: string; feePercent: number; source: string; paidCents: number; paidCurrency: string; creditUsdCents: number; grossUsdCents: number; fxRate: number | null; surchargePercent: number }[];
};

function parse(raw: string, factor = 100, max = 1_000_000_000) {
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  const value = Number(raw);
  return value <= max && Number.isSafeInteger(Math.round(value * factor)) && Math.abs(value * factor - Math.round(value * factor)) < 0.0001 ? Math.round(value * factor) : null;
}

export function ClientImpact({ snapshot, feeReference, currency, clientId, clientName }: {
  snapshot: Snapshot | null; feeReference: FeeReference | null; currency: string; clientId: string; clientName: string;
}) {
  const observed = currency === "USD" && snapshot && Number.isFinite(snapshot.analysis.spendInRange) && snapshot.analysis.spendInRange >= 0
    ? Math.round(snapshot.analysis.spendInRange * 100) : null;
  const [baseRaw, setBaseRaw] = useState("");
  const [currentRaw, setCurrentRaw] = useState("");
  const [newFee, setNewFee] = useState("");
  const [newBase, setNewBase] = useState("");
  const [reason, setReason] = useState("");
  const [editBase, setEditBase] = useState(false);
  const [editFee, setEditFee] = useState(false);
  const [notice, setNotice] = useState("");
  const base = editBase ? parse(baseRaw) : observed;
  const current = editFee ? parse(currentRaw, 100, 100) : feeReference?.feeHolisticPercent != null ? Math.round(feeReference.feeHolisticPercent * 100) : null;
  const proposed = parse(newFee, 100, 100);
  const volume = newBase === "" ? base : parse(newBase);
  const fee = base !== null && current !== null && proposed !== null && volume !== null ? feeImpact(base, current, proposed, volume) : null;
  const money = (cents: number) => new Intl.NumberFormat("es-PE", { style: "currency", currency }).format(cents / 100);
  const invalidFee = newFee !== "" && proposed === null;

  function download() {
    if (!fee) return;
    const report = { version: "client-decision-v1", clientId, clientName, currency, decision: "fee", reason,
      reference: { from: snapshot?.from, to: snapshot?.to, observedSpendCents: observed, fee: feeReference, baseIsManual: editBase, feeIsManual: editFee },
      assumptions: { base, currentFeeBps: current, proposedFeeBps: proposed, proposedBase: volume }, result: fee,
      risk: snapshot?.staffOps?.score ?? null, createdAt: new Date().toISOString(), status: "Evaluación gerencial; no aplicada" };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `decision-fee-${clientId.replace(/[^a-z0-9-]/gi, "_")}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice("Propuesta descargada. La tarifa del cliente sigue igual.");
  }

  const referenceFields = <>
    <label className={fieldLabel}>Fee actual para comparar (%)
      <Input type="number" min="0" max="100" step="0.01" inputMode="decimal" value={editFee ? currentRaw : current === null ? "" : current / 100} onChange={(e) => { setEditFee(true); setCurrentRaw(e.target.value); }} className="num" aria-invalid={editFee && currentRaw !== "" && current === null}/>
      {editFee && <button type="button" className={cn(textButton, "justify-self-start")} onClick={() => { setEditFee(false); setCurrentRaw(""); }}>Usar fee registrado</button>}
    </label>
    <label className={fieldLabel}>Inversión publicitaria del período ({currency})
      <Input type="number" min="0" max="1000000000" step="0.01" inputMode="decimal" value={editBase ? baseRaw : base === null ? "" : base / 100} onChange={(e) => { setEditBase(true); setBaseRaw(e.target.value); }} className="num" aria-invalid={editBase && baseRaw !== "" && base === null}/>
      <FieldHint>{currency === "PEN" ? "Ingresa una referencia en soles; el gasto en dólares no se convierte automáticamente." : "Usa un monto para el mismo período que estás comparando."}</FieldHint>
      {editBase && observed !== null && <button type="button" className={cn(textButton, "justify-self-start")} onClick={() => { setEditBase(false); setBaseRaw(""); }}>Usar gasto observado</button>}
    </label>
  </>;

  return <section aria-label="Impacto para Holistic" className="grid gap-6">
    <div>
      <p className="mb-4 text-ink-2">¿Qué fee quieres ofrecer a {clientName}? Esta propuesta es solo para este cliente. No cambia el fee general ni el de otros clientes.</p>
      <div className={statGrid}>
        <StatCard flat label={`Fee actual${editFee ? " · referencia manual" : ""}`} value={current === null ? "Por completar" : `${current / 100}%`} />
        <StatCard flat label={`Inversión de referencia${editBase ? " · manual" : ""}`} value={base === null ? "Por completar" : money(base)} />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className={fieldLabel}>Nuevo fee (%)
          <Input autoComplete="off" type="number" min="0" max="100" step="0.01" inputMode="decimal" value={newFee} onChange={(e) => setNewFee(e.target.value)} placeholder="Escribe el porcentaje propuesto" aria-invalid={invalidFee} aria-describedby={invalidFee ? "fee-proposal-error" : undefined} className="num"/>
          {invalidFee && <FieldHint id="fee-proposal-error" error>Ingresa un porcentaje de 0 a 100, con hasta 2 decimales.</FieldHint>}
        </label>
        {(observed === null || feeReference?.feeHolisticPercent == null) && referenceFields}
      </div>
    </div>

    <div aria-live="polite" aria-label="Resultado del cambio de fee">
      <BlockTitle aside={currency}>Ingreso por fee de este cliente</BlockTitle>
      {fee ? <>
        <div className={statGrid}>
          <StatCard flat label={`Con el fee actual (${current! / 100}%)`} value={money(fee.current)} />
          <StatCard flat label={`Con el nuevo fee (${proposed! / 100}%)`} value={money(fee.proposed)} />
          <StatCard flat label={fee.difference < 0 ? "Ingresaríamos menos" : fee.difference > 0 ? "Ingresaríamos más" : "Sin diferencia"} value={<span className={fee.difference < 0 ? "text-danger-fg" : fee.difference > 0 ? "text-ok-fg" : undefined}>{money(Math.abs(fee.difference))}</span>} />
        </div>
        <Note tone={fee.needed === null || fee.difference < 0 ? "warn" : "ok"} className="mt-3">{fee.needed === null ? "Con un fee de 0% no se recupera el ingreso actual aumentando la inversión." : fee.difference < 0 ? <>Para mantener el ingreso actual con este fee, el cliente tendría que invertir <strong>{money(fee.needed)}</strong> en un período equivalente.</> : "La propuesta mantiene o aumenta el ingreso por fee con la inversión ingresada."}</Note>
        {newBase !== "" && <p className={cn(footnote, "mt-3")}>La propuesta usa una inversión esperada de {money(volume!)}. Al mantener la inversión actual, el fee sería {money(fee.sameVolume)}.</p>}
      </> : <p className="rounded-box border border-dashed border-line-strong px-4 py-5 text-[13px] text-ink-2">Ingresa el nuevo fee{current === null ? ", el fee actual" : ""}{base === null ? " y la inversión de referencia" : ""} para ver la comparación.</p>}
      <p className={cn(footnote, "mt-3")}>Ingreso bruto por comisión. No descuenta costos operativos ni impuestos.</p>
      <p className={cn(footnote, "mt-1")}>Propuesta para {clientName}. Su fee registrado no cambia al simular o descargar.</p>
    </div>

    <div className="grid gap-3">
      {observed !== null && feeReference?.feeHolisticPercent != null && <Disclosure summary="Ajustar el fee actual o la inversión de referencia"><div className="grid gap-4 sm:grid-cols-2">{referenceFields}</div></Disclosure>}
      <Disclosure summary="¿Esperas que el cliente invierta más?">
        <label className={fieldLabel}>Inversión esperada en un período equivalente ({currency})<Input type="number" min="0" max="1000000000" step="0.01" inputMode="decimal" value={newBase} onChange={(e) => setNewBase(e.target.value)} placeholder="Vacío = mantener la inversión actual" className="num" aria-invalid={newBase !== "" && volume === null}/></label>
        <p>Es tu expectativa comercial, no una predicción automática.</p>
      </Disclosure>
      <Disclosure summary="Datos usados en esta comparación">
        <p>{editBase ? "Inversión ingresada manualmente." : snapshot && observed !== null ? `Gasto observado del ${snapshot.from} al ${snapshot.to}. Se usa como referencia; no equivale a comisiones facturadas.` : "No hay gasto disponible en esta moneda. Completa la referencia manual."}</p>
        <p>{editFee ? "Fee ingresado manualmente para esta propuesta." : feeReference?.feeSource === "hecom_cliente" ? "Fee del acuerdo registrado para el cliente." : feeReference?.feeSource === "hecom_account" ? "Fee del acuerdo registrado en su cuenta." : feeReference?.feeSource?.startsWith("payment_") ? "Fee respaldado por recargas confirmadas." : "El origen del fee requiere verificación."}</p>
        {feeReference?.warnings?.map(warning => <p key={warning}>{warning}</p>)}
        {!!feeReference?.history?.length && <ul className="divide-y divide-line">{feeReference.history.map(row => <li key={row.paymentId} className="py-2.5">
          <strong className="font-semibold text-ink">{new Date(row.date).toLocaleDateString("es-PE")} · Fee {row.feePercent}%</strong><p className="num text-xs">Pago: {new Intl.NumberFormat("es-PE", { style: "currency", currency: row.paidCurrency }).format(row.paidCents / 100)} · A cartera: USD {(row.creditUsdCents / 100).toFixed(2)}{row.fxRate ? ` · Cambio: ${row.fxRate} PEN/USD` : ""}{row.surchargePercent ? ` · Pasarela excluida: ${row.surchargePercent}%` : ""}</p>
          <button type="button" className={textButton} onClick={() => { setEditFee(true); setCurrentRaw(String(row.feePercent)); }}>Usar {row.feePercent}% como referencia</button>
        </li>)}</ul>}
      </Disclosure>
      <label className={cn(fieldLabel, "mt-2")}><span>Motivo de la propuesta <span className="font-normal text-ink-3">· Opcional, se incluye al descargar</span></span><Textarea rows={2} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. Mantener al cliente a cambio de mayor inversión"/></label>
    </div>

    <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
      <button type="button" disabled={!fee} onClick={download} className={buttonClass("outline", "md")}><PanelIcon name="download" />Descargar propuesta</button>
      {notice && <p role="status" className="text-[13px] text-ok-fg">{notice}</p>}
    </div>
  </section>;
}
