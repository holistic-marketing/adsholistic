"use client";
import { useEffect, useRef, useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { Note, StatCard, ToneBadge } from "@/components/ui/PanelKit";
import { creditRepayment, type CreditAssessment, type CreditTerms } from "@/lib/business-simulator/credit-proposal";
import { cn } from "@/lib/cn";
import type { FeeReference } from "./ClientImpact.client";
import { BlockTitle, Disclosure, FieldHint, Loading, Spinner, fieldLabel, footnote, statGrid } from "./ui";

function value(raw:string,factor:number,max:number){if(!/^\d+(\.\d{1,2})?$/.test(raw))return null;const n=Number(raw)*factor;return Number(raw)<=max&&Number.isSafeInteger(Math.round(n))&&Math.abs(n-Math.round(n))<0.0001?Math.round(n):null;}
export function CreditProposal({clientId,clientName,currency,feeReference}:{clientId:string;clientName:string;currency:"USD"|"PEN";feeReference:FeeReference|null}){
  const [amount,setAmount]=useState("");const [fee,setFee]=useState<string|null>(null);const [days,setDays]=useState("7");
  const [assessment,setAssessment]=useState<{key:string;data:CreditAssessment}|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  const controller=useRef<AbortController|null>(null);useEffect(()=>()=>controller.current?.abort(),[]);
  const feeRaw=fee??(feeReference?.feeHolisticPercent!=null?String(feeReference.feeHolisticPercent):"");
  const principal=value(amount,100,1_000_000_000),bps=value(feeRaw,100,100),term=value(days,1,3650);
  const terms:CreditTerms|null=principal!==null&&principal>0&&bps!==null&&term!==null&&term>0?{principalCents:principal,feeBps:bps,days:term,currency}:null;
  const repayment=terms?creditRepayment(terms):null;const key=JSON.stringify({clientId,terms});const current=assessment?.key===key?assessment.data:null;
  const money=(n:number)=>new Intl.NumberFormat("es-PE",{style:"currency",currency}).format(n/100);
  const invalidAmount=amount!==""&&(principal===null||principal<=0),invalidFee=feeRaw!==""&&bps===null,invalidDays=days!==""&&(term===null||term<=0);
  async function evaluate(){if(!terms)return;setBusy(true);setError("");setAssessment(null);const c=new AbortController();controller.current=c;
    try{const response=await fetch("/api/simulator/credit-analysis",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({clientId,...terms}),signal:AbortSignal.any([c.signal,AbortSignal.timeout(120000)])});if(!response.headers.get("content-type")?.includes("application/json"))throw Error("Vuelve a iniciar sesión para evaluar.");const data=await response.json();if(!response.ok)throw Error(data.error||"No se pudo evaluar. Reintenta.");if(data.clientId!==clientId)throw Error("Cambió el cliente. Vuelve a cargarlo.");if(!c.signal.aborted)setAssessment({key,data});}catch(cause){if(!c.signal.aborted)setError(cause instanceof Error?cause.message:"No se pudo evaluar.");}finally{if(!c.signal.aborted)setBusy(false);}}
  function download(){if(!repayment||!current)return;const text=[`Evaluación de crédito · ${clientName}`,`Moneda: ${currency}`,`Crédito: ${money(repayment.principalCents)}`,`FEE: ${repayment.feeBps/100}% = ${money(repayment.feeCents)}`,`Devolución: ${money(repayment.totalDueCents)} al finalizar ${repayment.days} días. Un ciclo, sin renovación automática.`,"",current.headline,...current.signals.map(s=>`${s.label}: ${s.value}`),"",current.aiSummary?`Resumen del agente IA:\n${current.aiSummary}`:"", "Pendiente de verificar:",...current.pending,"","Fuentes:",...current.sources,`Consultado: ${current.checkedAt}`,"Decisión pendiente de gerencia. No se desembolsó dinero."].join("\n");const url=URL.createObjectURL(new Blob([text],{type:"text/plain;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="evaluacion-credito.txt";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  return <section aria-label="Propuesta de crédito" className="grid gap-6">
    <div>
      <p className="mb-4 text-ink-2">¿Cuánto crédito quieres simular? Ingresa el monto y verás la comisión y el total a devolver.</p>
      <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
        <legend className="sr-only">Condiciones del crédito para {clientName}</legend>
        <label className={fieldLabel}>Monto del crédito ({currency})
          <Input type="number" min="0.01" max="1000000000" step="0.01" inputMode="decimal" placeholder="Ej. 1000" value={amount} onChange={e=>setAmount(e.target.value)} aria-invalid={invalidAmount} aria-describedby="credit-amount-help" className="num"/>
          <FieldHint id="credit-amount-help" error={invalidAmount}>{invalidAmount?"Ingresa un monto mayor que 0, con hasta 2 decimales.":"Capital que se prestaría al cliente para sus anuncios."}</FieldHint>
        </label>
        <label className={fieldLabel}>Comisión de Holistic · fee (%)
          <Input type="number" min="0" max="100" step="0.01" inputMode="decimal" value={feeRaw} onChange={e=>setFee(e.target.value)} aria-invalid={invalidFee} aria-describedby="credit-fee-help" className="num"/>
          <FieldHint id="credit-fee-help" error={invalidFee}>{invalidFee?"Usa un porcentaje de 0 a 100.":fee===null&&feeReference?.feeHolisticPercent!=null?"Usamos el fee actual. Puedes cambiarlo aquí.":"Se cobra una sola vez sobre el crédito."}</FieldHint>
        </label>
        <div className="grid content-start gap-2">
          <label className={fieldLabel}>Devolución en (días)
            <Input type="number" min="1" max="3650" step="1" inputMode="numeric" value={days} onChange={e=>setDays(e.target.value)} aria-invalid={invalidDays} aria-describedby={invalidDays?"credit-days-error":undefined} className="num"/>
            {invalidDays&&<FieldHint id="credit-days-error" error>Usa un número entero de 1 a 3650.</FieldHint>}
          </label>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Plazos frecuentes">{[7,15,30].map(day=><button key={day} type="button" aria-pressed={days===String(day)} onClick={()=>setDays(String(day))} className={cn(buttonClass("outline","sm"),"aria-pressed:border-accent-line aria-pressed:bg-accent-soft aria-pressed:text-accent-text")}>{day} días</button>)}</div>
        </div>
      </fieldset>
      {feeReference?.warnings?.length ? <Disclosure summary="Revisar de dónde sale el fee actual" className="mt-4"><ul className="list-disc space-y-1.5 pl-5">{feeReference.warnings.map(w=><li key={w}>{w}</li>)}</ul></Disclosure>:null}
    </div>

    <div aria-live="polite" aria-label="Resultado de la simulación de crédito">
      <BlockTitle aside={currency}>Así se devuelve el crédito</BlockTitle>
      {repayment?<>
        <div className={statGrid}>
          <StatCard flat label="Capital para el cliente" value={money(repayment.principalCents)} />
          <StatCard flat label={`Comisión de Holistic (${repayment.feeBps/100}%)`} value={`+ ${money(repayment.feeCents)}`} />
          <StatCard flat label="Total a devolver" value={money(repayment.totalDueCents)} sub={`Al finalizar ${repayment.days} días`} />
        </div>
        <Note tone="info" className="mt-3">El cliente devolvería <strong>{money(repayment.totalDueCents)}</strong> al finalizar <strong>{repayment.days} días</strong>. De ese total, {money(repayment.feeCents)} corresponden al fee de Holistic.</Note>
      </>:<p className="rounded-box border border-dashed border-line-strong px-4 py-5 text-[13px] text-ink-2">Completa el monto{bps===null?", el fee":""}{term===null||term<=0?" y el plazo":""} para ver el capital, la comisión y la devolución total.</p>}
      <p className={cn(footnote,"mt-3")}>Un solo ciclo, sin renovación automática. Este cálculo no acredita ni desembolsa dinero.</p>
    </div>

    <div className="border-t border-line pt-5">
      <BlockTitle>Análisis del cliente</BlockTitle>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={evaluate} disabled={!terms||busy} className={buttonClass("primary","md")}>{busy?<Spinner onAccent/>:<PanelIcon name="sparkle"/>}{busy?"Consultando historial…":current?"Actualizar análisis del cliente":"Analizar cliente con IA"}</button>
        <p className="text-[13px] text-ink-2">Consulta su historial para valorar esta propuesta.</p>
      </div>
      {error&&<Note tone="danger" className="mt-3">{error}</Note>}
      {busy&&<Loading title="Preparando el análisis del cliente" detail="Consultando pagos, anuncios, ventas y costos disponibles."/>}
      {current&&<section className="mt-5 grid gap-4" aria-label="Evaluación automática">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold tracking-[-0.01em] text-ink">{current.headline}</h3>
            <p className="mt-0.5 text-xs text-ink-3">Consulta del {new Date(current.checkedAt).toLocaleString("es-PE")}</p>
          </div>
          <button type="button" onClick={download} className={buttonClass("outline","sm")}><PanelIcon name="download"/>Descargar evaluación</button>
        </div>
        <p className="text-[13px] text-ink-2">Propuesta evaluada para {clientName}: <strong className="text-ink">{money(current.terms.principalCents)}</strong> de capital · fee {current.terms.feeBps / 100}% · {current.terms.days} días · devolución total <strong className="text-ink">{money(current.totalDueCents)}</strong>.</p>
        {current.aiSummary&&<p className="max-w-[75ch] whitespace-pre-line leading-relaxed text-ink">{current.aiSummary}</p>}
        {current.aiNotice&&<Note tone="neutral">{current.aiNotice}</Note>}
        <dl className="grid gap-x-6 sm:grid-cols-2">{current.signals.map(s=><div key={s.label} className="border-b border-line py-3">
          <dt className="flex flex-wrap items-center gap-2 text-xs text-ink-2">{s.label}{s.tone==="attention"?<ToneBadge tone="warn">Revisar</ToneBadge>:null}</dt>
          <dd className="mt-1 text-sm leading-relaxed text-ink">{s.value}</dd>
        </div>)}</dl>
        {current.pending.length>0&&<Note tone="warn" title="Antes de decidir, falta confirmar"><ul className="list-disc space-y-1 pl-5">{current.pending.map(p=><li key={p}>{p}</li>)}</ul></Note>}
        <Disclosure summary="Ver fuentes y alcance del análisis"><ul className="list-disc space-y-1.5 pl-5">{current.sources.map(s=><li key={s}>{s}</li>)}</ul></Disclosure>
        <p className={footnote}>La decisión corresponde a gerencia. El análisis no aprueba el crédito ni garantiza su devolución.</p>
      </section>}
    </div>
  </section>;
}
