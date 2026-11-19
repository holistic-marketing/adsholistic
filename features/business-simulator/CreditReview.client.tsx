"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { PanelCard } from "@/components/ui/PageHeader";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { Avatar, EmptyState, Note, Segmented } from "@/components/ui/PanelKit";
import { cn } from "@/lib/cn";
import { CreditBehavior, type Snapshot } from "./CreditBehavior.client";
import { ClientImpact, type FeeReference } from "./ClientImpact.client";
import { CreditProposal } from "./CreditProposal.client";
import { Loading, fieldLabel } from "./ui";

const STEPS = ["Elige un cliente", "Define la propuesta", "Revisa el resultado"];

export function CreditReview() {
  const [mode, setMode] = useState<"fee" | "credit">("credit");
  const [feeReference, setFeeReference] = useState<FeeReference | null>(null);
  const [evaluationRevision, setEvaluationRevision] = useState(0);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [clientId, setClientId] = useState("");
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [listBusy, setListBusy] = useState(true);
  const [listAttempt, setListAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [currency, setCurrency] = useState<"USD" | "PEN">("USD");
  const [notice, setNotice] = useState("");
  const activeRequest = useRef<AbortController | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const client = clients.find((item) => item.id === clientId);
  const matchingClients = clients.filter((item) => item.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/api/clientes", { signal: controller.signal }),
      fetch("/api/clientes/seleccionar", { signal: controller.signal }),
    ]).then(async ([list, selected]) => {
      if (!list.ok) throw new Error("No se pudieron cargar los clientes. Vuelve a intentarlo.");
      const data = await list.json();
      if (!data.ok || !Array.isArray(data.clients)) throw new Error("No se pudieron cargar los clientes.");
      const selection = selected.ok ? await selected.json() : null;
      if (!controller.signal.aborted) { setClients(data.clients); setClientId(selection?.selected?.id ?? ""); }
    }).catch((cause) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Error al cargar clientes.");
    }).finally(() => { if (!controller.signal.aborted) setListBusy(false); });
    return () => controller.abort();
  }, [listAttempt]);

  useEffect(() => { if (pickerOpen) searchInput.current?.focus(); }, [pickerOpen]);
  const clearEvaluation = useCallback(() => {
    setSnapshot(null); setFeeReference(null); setEvaluationRevision((n) => n + 1); setNotice(""); setError("");
  }, []);
  const evaluate = useCallback(async () => {
    if (!client) return;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(90000)]);
    clearEvaluation(); setBusy(true);
    try {
      const selected = await fetch("/api/clientes/seleccionar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clienteId: client.id }), signal });
      if (!selected.ok) throw new Error("No se pudo seleccionar el cliente. Vuelve a intentarlo.");
      const read = async (url: string) => {
        const response = await fetch(url, { cache: "no-store", signal });
        if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("La sesión venció. Inicia sesión nuevamente.");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No se pudo consultar la información.");
        return data;
      };
      const [profit, fee] = await Promise.allSettled([read("/api/profit"), read("/api/simulator/client-fee")]);
      if (controller.signal.aborted) return;
      const notices: string[] = [];
      if (fee.status === "fulfilled" && fee.value.hecomClienteId === client.id) setFeeReference(fee.value);
      else notices.push("El fee actual no está disponible. Puedes ingresar una referencia manual.");
      if (profit.status === "fulfilled" && profit.value.cliente?.id === client.id && profit.value.analysis) setSnapshot(profit.value);
      else notices.push("No se pudo cargar el contexto de Profit. Puedes reintentar la consulta.");
      setNotice(notices.join(" "));
    } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "No se pudo consultar el cliente."); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }, [client, clearEvaluation]);
  useEffect(() => {
    if (!client) return;
    const timer = setTimeout(() => { void evaluate(); }, 150);
    return () => { clearTimeout(timer); activeRequest.current?.abort(); };
  }, [client, evaluate]);

  function pick(id: string) {
    if (id !== clientId) { activeRequest.current?.abort(); clearEvaluation(); setBusy(true); setClientId(id); }
    setPickerOpen(false); setSearch("");
  }

  const fee = feeReference?.feeHolisticPercent;

  return (
    <section aria-label="Evaluación del cliente">
      <ol className="mb-4 grid auto-cols-fr grid-flow-col gap-2" aria-label="Cómo usar el simulador">
        {STEPS.map((step, index) => (
          <li
            key={step}
            className={cn(
              "border-t-2 pt-2 text-xs font-medium",
              index === 0 || client ? "border-accent text-ink" : "border-line-strong text-ink-3",
            )}
          >
            {index + 1}. {step}
          </li>
        ))}
      </ol>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(280px,380px)_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-4">
          <PanelCard>
            <p className="eyebrow">Cliente de la simulación</p>
            <h2 className="mb-3 mt-0.5 text-base font-semibold tracking-[-0.01em] text-ink">¿A quién evaluamos?</h2>

            {client && !pickerOpen ? (
              <div className="grid gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={client.name} />
                  <div className="grid min-w-0 leading-snug">
                    <b className="truncate font-semibold text-ink">{client.name}</b>
                    <small className="truncate text-[11px] text-ink-3">
                      {busy ? "Consultando sus datos…" : fee != null ? `Fee actual ${fee} %` : "Fee actual por confirmar"}
                    </small>
                  </div>
                </div>
                <label className={fieldLabel}>
                  Simular en
                  <Select
                    value={currency}
                    disabled={busy}
                    onChange={(e) => { setCurrency(e.target.value as "USD" | "PEN"); setEvaluationRevision((n) => n + 1); }}
                  >
                    <option value="USD">Dólares · USD</option>
                    <option value="PEN">Soles · PEN</option>
                  </Select>
                </label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={buttonClass("outline", "sm")} onClick={() => { setPickerOpen(true); setSearch(""); }}>
                    Cambiar cliente
                  </button>
                  <button type="button" className={buttonClass("ghost", "sm")} disabled={busy} onClick={evaluate}>
                    <PanelIcon name="refresh" />
                    Actualizar datos
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <label className="panel-search">
                  <span className="sr-only">Busca por nombre</span>
                  <PanelIcon name="search" />
                  <input
                    ref={searchInput}
                    id="simulator-client-search"
                    type="search"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="Busca un cliente por nombre"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-controls="simulator-client-list"
                    disabled={listBusy}
                  />
                </label>
                {listBusy ? (
                  <Loading title="Cargando clientes…" />
                ) : (
                  <ul
                    id="simulator-client-list"
                    aria-label="Clientes disponibles"
                    className="ui-scroll mt-2 max-h-80 overflow-y-auto rounded-box border border-line bg-surface"
                  >
                    {matchingClients.map((item) => (
                      <li key={item.id} className="border-b border-line last:border-b-0">
                        <button
                          type="button"
                          onClick={() => pick(item.id)}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-hover focus-visible:bg-hover"
                        >
                          <Avatar name={item.name} size="sm" />
                          <span className="min-w-0 flex-1 truncate font-semibold text-ink">{item.name}</span>
                          <span className="shrink-0 text-xs text-ink-3">{item.id === clientId ? "Seleccionado" : "Elegir"}</span>
                        </button>
                      </li>
                    ))}
                    {!matchingClients.length ? (
                      <li className="px-4 py-6 text-center text-[13px] text-ink-2">
                        {clients.length ? "No encontramos ese nombre. Prueba con otro." : "No hay clientes disponibles para esta cuenta."}
                      </li>
                    ) : null}
                  </ul>
                )}
                {client ? (
                  <button type="button" className={cn(buttonClass("ghost", "sm"), "mt-2")} onClick={() => { setPickerOpen(false); setSearch(""); }}>
                    Cerrar búsqueda
                  </button>
                ) : null}
              </div>
            )}

            {error ? (
              <Note tone="danger" className="mt-3">
                {error}{" "}
                <button
                  type="button"
                  className="font-semibold underline underline-offset-4"
                  onClick={() => { if (client) void evaluate(); else { setError(""); setListBusy(true); setListAttempt((n) => n + 1); } }}
                >
                  Reintentar
                </button>
              </Note>
            ) : null}
          </PanelCard>

          {client && snapshot && !busy && !pickerOpen ? (
            <PanelCard title="Score de riesgo" description="Historial del cliente para la decisión">
              <CreditBehavior snapshot={snapshot} />
            </PanelCard>
          ) : null}
        </div>

        <PanelCard className="min-w-0">
          {!client ? (
            <EmptyState
              icon="scale"
              title="Una decisión, con los números claros"
              description="Elige un cliente. Podrás comparar su fee o calcular cuánto debe devolver por un crédito."
            />
          ) : busy ? (
            <Loading title={`Consultando los datos de ${client.name}`} detail="Reuniendo fee actual, anuncios e historial disponible." />
          ) : (
            <div>
              <h2 className="mb-3 text-base font-semibold tracking-[-0.01em] text-ink">Propuesta</h2>
              <Segmented
                label="Qué quieres simular"
                value={mode}
                onChange={setMode}
                block
                className="max-w-[360px]"
                options={[
                  { value: "credit", label: "Simular crédito" },
                  { value: "fee", label: "Cambiar fee" },
                ]}
              />
              {notice ? <Note tone="warn" className="mt-4">{notice}</Note> : null}
              <div className="mt-5">
                <div hidden={mode !== "credit"}><CreditProposal key={`${clientId}:${currency}:${evaluationRevision}`} clientId={clientId} clientName={client.name} currency={currency} feeReference={feeReference}/></div>
                <div hidden={mode !== "fee"}><ClientImpact key={`${clientId}:${currency}:${evaluationRevision}`} clientId={clientId} clientName={client.name} snapshot={snapshot} feeReference={feeReference} currency={currency}/></div>
              </div>
            </div>
          )}
        </PanelCard>
      </div>
    </section>
  );
}
