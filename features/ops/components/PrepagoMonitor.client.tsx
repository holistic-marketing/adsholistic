"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { PageHeader, PanelCard } from "@/components/ui/PageHeader";
import { PanelDialog } from "@/components/ui/PanelDialog.client";
import { PanelIcon } from "@/components/ui/PanelIcon";
import {
  Avatar,
  EmptyState,
  FilterBar,
  FilterButton,
  FilterChip,
  Note,
  SearchField,
  Segmented,
  StatCard,
  ToneBadge,
  type Tone,
} from "@/components/ui/PanelKit";
import { PanelMenu, PanelPopover, usePopover } from "@/components/ui/PanelPopover.client";
import {
  VERDICT_META,
  VERDICT_ORDER,
  verdictFor,
  type Verdict,
  type VerdictKey,
} from "@/features/ops/lib/monitor-verdict";
import type {
  ClienteModalidad,
  ClienteModalidadEntry,
  MonitorAccount,
  MonitorCliente,
  MonitorEvent,
  MonitorSeverity,
  MonitorSignal,
  MonitorSnapshot,
} from "@/features/ops/types/prepago-monitor";
import { FrenarGasto } from "@/features/ops/components/FrenarGasto.client";

const AUTO_REFRESH_MS = 5 * 60_000;

type VerdictFilter = "all" | VerdictKey;
type Tab = "clientes" | "movimientos";
type Modalidades = Record<string, ClienteModalidadEntry>;

type Row = {
  cliente: MonitorCliente;
  modalidad: ClienteModalidad;
  modalidadEntry: ClienteModalidadEntry | null;
  verdict: Verdict;
};

/** Tono de cada gravedad de alerta o movimiento. */
const SEVERITY_TONE: Record<MonitorSeverity, Tone> = {
  critical: "danger",
  high: "accent",
  medium: "warn",
  info: "neutral",
};

const MODALIDAD_LABEL: Record<ClienteModalidad, string> = {
  prepago: "Prepago",
  acuerdo: "Paga después",
};

const usdFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const usdShort = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function usd(value: number | null | undefined): string {
  return usdFmt.format(Number(value) || 0);
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function relativeTime(iso: string, now: number): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.round(diff / 60_000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} día${d === 1 ? "" : "s"}`;
}

function limaDateTime(iso: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

async function fetchSnapshot(
  fresh: boolean,
  signal: AbortSignal,
): Promise<{ snapshot: MonitorSnapshot; modalidades: Modalidades }> {
  const res = await fetch(`/api/ops/monitor${fresh ? "?fresh=1" : ""}`, {
    cache: "no-store",
    signal,
  });
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    snapshot?: MonitorSnapshot;
    modalidades?: Modalidades;
    error?: string;
  };
  if (!res.ok || !json.ok || !json.snapshot) {
    throw new Error(json.error || "No se pudo cargar el monitoreo.");
  }
  return { snapshot: json.snapshot, modalidades: json.modalidades ?? {} };
}

function isAbort(err: unknown): boolean {
  return (err as { name?: string })?.name === "AbortError";
}

export function PrepagoMonitor({
  initialSnapshot = null,
  initialModalidades = {},
  initialTab = "clientes",
  initialOpenId = null,
}: {
  /** Si viene, se muestra sin esperar la primera carga (vista previa / tests). */
  initialSnapshot?: MonitorSnapshot | null;
  initialModalidades?: Modalidades;
  initialTab?: Tab;
  initialOpenId?: string | null;
} = {}) {
  const [snapshot, setSnapshot] = useState<MonitorSnapshot | null>(initialSnapshot);
  const [modalidades, setModalidades] = useState<Modalidades>(initialModalidades);
  const [loading, setLoading] = useState(initialSnapshot == null);
  const [error, setError] = useState<string | null>(null);
  const [auto, setAuto] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [tab, setTab] = useState<Tab>(initialTab);
  const [filter, setFilter] = useState<VerdictFilter>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(initialOpenId);
  const abortRef = useRef<AbortController | null>(null);

  /** Recarga pedida por el gerente o por el auto-refresh (fuera del render). */
  const load = useCallback(async (fresh: boolean) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSnapshot(fresh, controller.signal);
      setSnapshot(data.snapshot);
      setModalidades(data.modalidades);
    } catch (err) {
      if (isAbort(err)) return;
      setError(err instanceof Error ? err.message : "No se pudo cargar el monitoreo.");
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialSnapshot) return;
    const controller = new AbortController();
    abortRef.current = controller;
    fetchSnapshot(false, controller.signal)
      .then((data) => {
        setSnapshot(data.snapshot);
        setModalidades(data.modalidades);
      })
      .catch((err) => {
        if (!isAbort(err)) {
          setError(err instanceof Error ? err.message : "No se pudo cargar el monitoreo.");
        }
      })
      .finally(() => {
        if (abortRef.current === controller) setLoading(false);
      });
    return () => controller.abort();
  }, [initialSnapshot]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!auto) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [auto, load]);

  const rows = useMemo<Row[]>(() => {
    const list = (snapshot?.clientes ?? []).map((cliente) => {
      const entry = modalidades[cliente.id] ?? null;
      const modalidad: ClienteModalidad = entry?.modalidad ?? "prepago";
      return { cliente, modalidad, modalidadEntry: entry, verdict: verdictFor(cliente, modalidad) };
    });
    const weight = (r: Row) =>
      r.cliente.exposureUsd + Math.max(0, r.cliente.month.debtUsd);
    return list.sort(
      (a, b) =>
        VERDICT_ORDER.indexOf(a.verdict.key) - VERDICT_ORDER.indexOf(b.verdict.key) ||
        weight(b) - weight(a),
    );
  }, [snapshot, modalidades]);

  const counts = useMemo(() => {
    const out: Record<VerdictKey, number> = { quitar_saldo: 0, preguntar: 0, cobrar: 0, acuerdo: 0, ok: 0 };
    for (const r of rows) out[r.verdict.key] += 1;
    return out;
  }, [rows]);

  const modalidadById = useMemo(() => new Map(rows.map((r) => [r.cliente.id, r.modalidad])), [rows]);

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.verdict.key !== filter) return false;
      if (q && !r.cliente.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, filter, query]);

  const events = useMemo(() => {
    const list = snapshot?.events ?? [];
    const q = query.trim().toLowerCase();
    return list.filter((e) => !q || e.clienteName.toLowerCase().includes(q));
  }, [snapshot, query]);

  const saveModalidad = useCallback(
    async (clienteId: string, modalidad: ClienteModalidad, nota: string) => {
      const res = await fetch("/api/ops/cliente-modalidad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId, modalidad, nota }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        entry?: ClienteModalidadEntry;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.entry) throw new Error(json.error || "No se pudo guardar.");
      setModalidades((prev) => ({ ...prev, [clienteId]: json.entry! }));
    },
    [],
  );

  const header = (
    <PageHeader
      eyebrow="Gerencia"
      title="Monitoreo prepago"
      lede="Cada cliente tiene un color que dice qué hacer: quitar saldo, preguntar al gerente, cobrar, solo vigilar o nada. Abre un cliente para ver los pasos."
      actions={
        <>
          <AutoSwitch checked={auto} onChange={setAuto} />
          <Button variant="outline" onClick={() => void load(true)} disabled={loading}>
            <PanelIcon name="refresh" className={loading ? "animate-spin motion-reduce:animate-none" : undefined} />
            {loading ? "Revisando…" : "Actualizar"}
          </Button>
        </>
      }
    />
  );

  if (!snapshot && loading) {
    return (
      <div className="min-w-0">
        {header}
        <MonitorSkeleton />
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="min-w-0">
        {header}
        <section className="rounded-card border border-line bg-surface shadow-card">
          <EmptyState
            icon="alert"
            title="No se pudo cargar el monitoreo"
            description={<span className="text-danger-fg">{error}</span>}
            action={<Button onClick={() => void load(true)}>Reintentar</Button>}
          />
        </section>
      </div>
    );
  }

  const t = snapshot.totals;
  const prepagoExposure = rows
    .filter((r) => r.modalidad === "prepago")
    .reduce((s, r) => s + r.cliente.exposureUsd, 0);
  const acuerdoExposure = rows
    .filter((r) => r.modalidad === "acuerdo")
    .reduce((s, r) => s + r.cliente.exposureUsd, 0);
  const actionable = counts.quitar_saldo + counts.preguntar + counts.cobrar;
  const openRow = openId ? rows.find((r) => r.cliente.id === openId) ?? null : null;

  return (
    <div className="min-w-0">
      {header}

      <div className="flex min-w-0 flex-col gap-4">
        <RefreshBar active={loading} />

        <p role="status" className="-mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-2">
          <span aria-hidden className={cn("size-2 shrink-0 rounded-full", auto ? "bg-ok-solid" : "bg-line-strong")} />
          Actualizado {relativeTime(snapshot.generatedAt, now)} · {limaDateTime(snapshot.generatedAt)}
          <span className="text-ink-3">
            · {plural(t.clientes, "cliente", "clientes")} · {plural(t.accounts, "cuenta", "cuentas")}
          </span>
        </p>

        {error ? (
          <Note tone="danger">No se pudo actualizar: {error}. Se muestran los datos anteriores.</Note>
        ) : null}
        {snapshot.warnings.length ? (
          <Note tone="warn">Datos incompletos: {snapshot.warnings.join(" · ")}</Note>
        ) : null}

        <HowToRead />

        {/* Qué hay que hacer hoy */}
        <section
          aria-labelledby="monitor-hero"
          className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6"
        >
          <h2 id="monitor-hero" className="eyebrow">
            Hoy hay que revisar
          </h2>
          <p className="mt-2 text-[2.25rem] font-semibold leading-[1.1] tracking-[-0.035em] text-ink tabular-nums max-sm:text-[1.75rem]">
            {plural(actionable, "cliente", "clientes")}
          </p>
          <p className="mt-1.5 max-w-[56ch] text-sm text-ink-2">
            {actionable
              ? `Los clientes prepago pueden gastar ${usdShort.format(prepagoExposure)} sin haber pagado.`
              : "Sin pendientes. Todos gastan solo lo que pagaron."}
          </p>
          <div role="group" aria-label="Filtrar por qué hacer" className="mt-4 flex flex-wrap gap-1.5">
            {VERDICT_ORDER.map((key) => {
              const active = filter === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setFilter(active ? "all" : key);
                    setTab("clientes");
                  }}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-ctl border px-3 text-[13px] font-medium shadow-ctl",
                    active
                      ? "border-accent-line bg-accent-soft text-accent-text"
                      : "border-line bg-field text-ink hover:border-line-strong hover:bg-hover",
                  )}
                >
                  <ToneDot tone={VERDICT_META[key].tone} />
                  {VERDICT_META[key].short}
                  <b className={cn("font-mono text-xs font-medium", active ? "text-accent-text" : "text-ink-3")}>
                    {counts[key]}
                  </b>
                </button>
              );
            })}
          </div>
        </section>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-4">
          <StatCard
            label="Deuda del mes"
            value={<span className={t.monthDebtUsd > 0 ? "text-danger-fg" : undefined}>{usdShort.format(t.monthDebtUsd)}</span>}
            sub={`Gastaron más de lo que pagaron (${snapshot.month})`}
          />
          <StatCard
            label="Cargas directas en TikTok"
            value={<span className={t.manualLoadUsd > 0 ? "text-danger-fg" : undefined}>{usdShort.format(t.manualLoadUsd)}</span>}
            sub={`No pasaron por Ads Holistic · últimas ${snapshot.windows.manualLoadHours} h`}
          />
          <StatCard
            label="Recargas de gerente"
            value={<span className={t.staffRechargeUsd > 0 ? "text-warn-fg" : undefined}>{usdShort.format(t.staffRechargeUsd)}</span>}
            sub={`Sin pago del cliente · últimos ${snapshot.windows.staffMovesDays} días`}
          />
          <StatCard
            label="Saldo de clientes con acuerdo"
            value={usdShort.format(acuerdoExposure)}
            sub="Cargado a clientes que pagan después (es normal)"
          />
        </div>

        <Segmented<Tab>
          label="Qué ver"
          value={tab}
          onChange={setTab}
          className="mt-1 self-start"
          options={[
            { value: "clientes", label: <TabLabel label="Clientes" count={visibleRows.length} /> },
            { value: "movimientos", label: <TabLabel label="Movimientos raros" count={events.length} /> },
          ]}
        />

        <FilterBar
          chips={
            tab === "clientes" && filter !== "all" ? (
              <FilterChip
                name="Qué hacer"
                value={VERDICT_META[filter].short}
                removeLabel="Quitar filtro"
                onRemove={() => setFilter("all")}
              />
            ) : undefined
          }
        >
          <SearchField label="Buscar cliente" value={query} onChange={(e) => setQuery(e.target.value)} />
          {tab === "clientes" ? (
            <VerdictFilterButton filter={filter} counts={counts} total={rows.length} onChange={setFilter} />
          ) : null}
        </FilterBar>

        {tab === "clientes" ? (
          <ClientesTable rows={visibleRows} onOpen={setOpenId} />
        ) : (
          <EventsList events={events} now={now} modalidadById={modalidadById} />
        )}

        <p className="px-1 text-xs leading-5 text-ink-3">
          Para quitar saldo o congelar a un cliente, ábrelo y usa «Frenar gasto». Todo queda registrado con
          motivo y quién lo hizo.
        </p>
      </div>

      <PanelDialog
        open={openRow != null}
        onClose={() => setOpenId(null)}
        size="drawer"
        title={openRow?.cliente.name ?? ""}
        description={
          openRow
            ? `${MODALIDAD_LABEL[openRow.modalidad]} · ${plural(openRow.cliente.accounts.length, "cuenta", "cuentas")}`
            : undefined
        }
        closeLabel="Cerrar"
      >
        {openRow ? (
          <ClienteDetail
            key={openRow.cliente.id}
            row={openRow}
            onSaveModalidad={saveModalidad}
            onChanged={() => void load(true)}
          />
        ) : null}
      </PanelDialog>
    </div>
  );
}

/* --- Piezas pequeñas ---------------------------------------------------------- */

function ToneDot({ tone }: { tone: Tone }) {
  return <span aria-hidden className={cn("size-2 shrink-0 rounded-full bg-[var(--t-solid)]", `tone-${tone}`)} />;
}

function TabLabel({ label, count }: { label: string; count: number }) {
  return (
    <>
      {label}
      <span className="font-mono text-ink-3">{count}</span>
    </>
  );
}

/** Interruptor v3: casilla nativa con pista y bolita. */
function AutoSwitch({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="relative inline-flex cursor-pointer items-center gap-2 text-[13px] text-ink">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer absolute left-0 top-1/2 m-0 h-5 w-[34px] -translate-y-1/2 cursor-pointer opacity-0"
      />
      <span
        aria-hidden
        className="relative h-5 w-[34px] shrink-0 rounded-full bg-line-strong transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-on-accent after:shadow-ctl after:transition-transform peer-checked:bg-accent-btn peer-checked:after:translate-x-3.5 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus motion-reduce:transition-none motion-reduce:after:transition-none"
      />
      Actualizar cada 5 min
    </label>
  );
}

function VerdictFilterButton({
  filter,
  counts,
  total,
  onChange,
}: {
  filter: VerdictFilter;
  counts: Record<VerdictKey, number>;
  total: number;
  onChange: (value: VerdictFilter) => void;
}) {
  const { anchorRef, open, toggle, close } = usePopover();
  const pick = (value: VerdictFilter) => {
    onChange(value);
    close();
  };
  return (
    <>
      <FilterButton
        {...{ ref: anchorRef }}
        label="Qué hacer"
        count={filter === "all" ? 0 : 1}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
      />
      <PanelPopover anchorRef={anchorRef} open={open} onClose={close} label="Filtrar por qué hacer" minWidth={240}>
        <PanelMenu
          label="Qué hacer"
          items={[
            { label: "Todos", hint: plural(total, "cliente", "clientes"), checked: filter === "all", onSelect: () => pick("all") },
            ...VERDICT_ORDER.map((key) => ({
              label: VERDICT_META[key].label,
              hint: plural(counts[key], "cliente", "clientes"),
              checked: filter === key,
              onSelect: () => pick(key),
            })),
          ]}
        />
      </PanelPopover>
    </>
  );
}

/* --- Tabla de clientes -------------------------------------------------------- */

/* Tabla v3: en pantallas chicas cada fila se apila y cada celda muestra su
   rótulo (data-label) a la izquierda. */
const TH = "h-10 whitespace-nowrap border-b border-line px-2 text-left text-sm font-medium text-ink";
const TD =
  "h-[59px] border-b border-line px-2 py-2 align-middle max-md:flex max-md:h-auto max-md:min-h-[30px] max-md:items-center max-md:justify-between max-md:gap-4 max-md:border-0 max-md:px-0 max-md:py-[3px] max-md:text-right max-md:before:flex-none max-md:before:text-left max-md:before:text-xs max-md:before:font-medium max-md:before:text-ink-3 max-md:before:content-[attr(data-label)]";
const TD_MAIN = "max-md:block max-md:pb-2 max-md:text-left max-md:before:content-none";
const TD_WIDE = "max-md:block max-md:text-left max-md:before:mb-1 max-md:before:block";
const TD_NUM = "num text-right font-semibold";

function ClientesTable({ rows, onOpen }: { rows: Row[]; onOpen: (id: string) => void }) {
  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface shadow-card md:p-2">
      {rows.length === 0 ? (
        <EmptyState icon="search" title="Ningún cliente con ese filtro." />
      ) : (
        <div role="region" aria-label="Clientes en monitoreo" tabIndex={0} className="overflow-x-auto">
          <table className="w-full border-collapse text-sm max-md:block">
            <caption className="sr-only">Clientes en monitoreo</caption>
            <thead className="max-md:sr-only">
              <tr>
                <th scope="col" className={TH}>Cliente</th>
                <th scope="col" className={TH}>Qué pasa</th>
                <th scope="col" className={cn(TH, "text-right")}>Puede gastar sin pagar</th>
                <th scope="col" className={cn(TH, "text-right")}>Deuda del mes</th>
                <th scope="col" className={cn(TH, "text-right")}>Cartera</th>
              </tr>
            </thead>
            <tbody className="max-md:block">
              {rows.map((row) => (
                <ClienteRow key={row.cliente.id} row={row} onOpen={() => onOpen(row.cliente.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ClienteRow({ row, onOpen }: { row: Row; onOpen: () => void }) {
  const { cliente, verdict, modalidad } = row;
  const meta = VERDICT_META[verdict.key];
  const exposureStrong = cliente.exposureUsd > 1 && modalidad === "prepago";
  const debtStrong = cliente.month.debtUsd > 1 && modalidad === "prepago";
  return (
    <tr
      onClick={(event) => {
        if (!(event.target as HTMLElement).closest("button, a, input")) onOpen();
      }}
      className="cursor-pointer hover:bg-field [&:last-child>td]:border-b-0 max-md:block max-md:border-b max-md:border-line max-md:px-4 max-md:py-3 max-md:last:border-b-0"
    >
      <td data-label="Cliente" className={cn(TD, TD_MAIN)}>
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={cliente.name} />
          <div className="grid min-w-0 leading-snug">
            <button
              type="button"
              onClick={onOpen}
              className="max-w-[34ch] truncate text-left font-semibold text-ink underline decoration-transparent underline-offset-[3px] hover:decoration-current"
            >
              {cliente.name}
            </button>
            <small className="truncate text-xs text-ink-3">
              {MODALIDAD_LABEL[modalidad]} · {plural(cliente.accounts.length, "cuenta", "cuentas")}
            </small>
          </div>
        </div>
      </td>
      <td data-label="Qué pasa" className={cn(TD, TD_WIDE)}>
        <span className="grid max-w-[46ch] justify-items-start gap-1">
          <ToneBadge tone={meta.tone} dot>
            {meta.label}
          </ToneBadge>
          <span className="line-clamp-2 text-[13px] leading-5 text-ink-2">{verdict.headline}</span>
        </span>
      </td>
      <td data-label="Puede gastar sin pagar" className={cn(TD, TD_NUM, exposureStrong ? "text-danger-fg" : "text-ink")}>
        {usd(cliente.exposureUsd)}
      </td>
      <td data-label="Deuda del mes" className={cn(TD, TD_NUM, debtStrong ? "text-danger-fg" : "text-ink")}>
        {usd(Math.max(0, cliente.month.debtUsd))}
      </td>
      <td data-label="Cartera" className={cn(TD, TD_NUM, "text-ink")}>
        {usd(cliente.walletUsd)}
      </td>
    </tr>
  );
}

/* --- Detalle de un cliente (panel lateral) ------------------------------------ */

function ClienteDetail({
  row,
  onSaveModalidad,
  onChanged,
}: {
  row: Row;
  onSaveModalidad: (clienteId: string, modalidad: ClienteModalidad, nota: string) => Promise<void>;
  onChanged: () => void;
}) {
  const { cliente, verdict } = row;
  const meta = VERDICT_META[verdict.key];
  return (
    <div className="space-y-5">
      <Note tone={meta.tone} title={meta.label}>
        {verdict.headline}
      </Note>

      <dl className="grid grid-cols-3 gap-2">
        <MiniStat label="Gastó este mes (con fee)" value={usd(cliente.month.chargeUsd)} />
        <MiniStat label="Pagó este mes" value={usd(cliente.month.paidUsd)} />
        <MiniStat
          label="Diferencia"
          value={usd(cliente.month.debtUsd)}
          className={cliente.month.debtUsd > 1 ? "text-danger-fg" : undefined}
        />
      </dl>

      {verdict.steps.length ? (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-ink">Qué hacer</h3>
          <ol className="grid gap-2.5">
            {verdict.steps.map((step, i) => (
              <li key={step} className="grid grid-cols-[24px_1fr] items-start gap-2.5 text-[13px] leading-5 text-ink-2">
                <span
                  aria-hidden
                  className="grid size-[22px] place-items-center rounded-[6px] bg-subtle font-mono text-[11px] font-semibold text-ink"
                >
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <ModalidadEditor row={row} onSave={onSaveModalidad} />

      <FrenarGasto cliente={cliente} onDone={onChanged} />

      <Disclosure summary="Ver detalle técnico (alertas y cuentas TikTok)" icon="activity">
        <div className="space-y-3">
          {cliente.signals.length === 0 ? (
            <Note tone="ok" icon="check-circle">
              Sin alertas.
            </Note>
          ) : (
            cliente.signals.map((s, i) => <SignalCard key={`${s.kind}-${s.advertiserId ?? i}-${i}`} signal={s} />)
          )}
          <AccountsTable accounts={cliente.accounts} />
        </div>
      </Disclosure>
    </div>
  );
}

function MiniStat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="min-w-0 rounded-box border border-line bg-field px-3 py-2.5">
      <dt className="text-[10px] font-semibold uppercase leading-tight tracking-[0.06em] text-ink-3">{label}</dt>
      <dd className={cn("mt-0.5 font-mono text-[15px] font-semibold tracking-[-0.02em] text-ink [overflow-wrap:anywhere]", className)}>
        {value}
      </dd>
    </div>
  );
}

/** Acordeón v3 («details.acc»). */
function Disclosure({
  summary,
  icon = "info",
  children,
}: {
  summary: string;
  icon?: "info" | "activity";
  children: ReactNode;
}) {
  return (
    <details className="group rounded-box border border-line bg-field">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-[13px] font-medium text-ink [&::-webkit-details-marker]:hidden">
        <PanelIcon name={icon} className="shrink-0" />
        {summary}
        <PanelIcon
          name="chevron-down"
          className="ml-auto shrink-0 text-ink-3 transition-transform group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div className="px-3 pb-3 pt-0.5">{children}</div>
    </details>
  );
}

function ModalidadEditor({
  row,
  onSave,
}: {
  row: Row;
  onSave: (clienteId: string, modalidad: ClienteModalidad, nota: string) => Promise<void>;
}) {
  const [modalidad, setModalidad] = useState<ClienteModalidad>(row.modalidad);
  const [nota, setNota] = useState(row.modalidadEntry?.nota ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = modalidad !== row.modalidad || nota.trim() !== (row.modalidadEntry?.nota ?? "");

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      await onSave(row.cliente.id, modalidad, nota);
      setMessage({ ok: true, text: "Guardado." });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "No se pudo guardar." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h3 className="text-sm font-semibold text-ink">Tipo de cliente</h3>
      <p className="mt-0.5 text-xs text-ink-2">Lo decide gerencia. Cambia lo que esta pantalla recomienda.</p>
      <fieldset className="mt-2.5 grid grid-cols-2 gap-2">
        <legend className="sr-only">Tipo de cliente</legend>
        {(
          [
            ["prepago", "Prepago", "Paga antes de gastar"],
            ["acuerdo", "Paga después", "Tiene acuerdo"],
          ] as const
        ).map(([key, label, hint]) => (
          <label key={key} className="relative block cursor-pointer">
            <input
              type="radio"
              name={`modalidad-${row.cliente.id}`}
              value={key}
              checked={modalidad === key}
              onChange={() => setModalidad(key)}
              className="peer absolute inset-0 m-0 cursor-pointer opacity-0"
            />
            <span className="block h-full rounded-box border border-line bg-surface px-3.5 py-3 peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:ring-1 peer-checked:ring-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus">
              <b className="block text-sm font-semibold text-ink">{label}</b>
              <small className="mt-0.5 block text-xs leading-snug text-ink-2">{hint}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <label className="mt-3 grid gap-1.5">
        <span className="text-sm font-medium text-ink">
          Nota{" "}
          <span className="text-xs font-normal text-ink-3">
            {modalidad === "acuerdo" ? "(obligatoria: quién lo autorizó y cuándo paga)" : "(opcional)"}
          </span>
        </span>
        <Textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder={modalidad === "acuerdo" ? "Ej: Autorizado por gerencia, paga a fin de mes." : ""}
          className="resize-none"
        />
      </label>
      <div className="mt-2.5 flex items-center justify-between gap-3">
        <p className="min-w-0 text-xs leading-4 text-ink-3">
          {row.modalidadEntry
            ? `Marcado por ${row.modalidadEntry.updatedBy} · ${limaDateTime(row.modalidadEntry.updatedAt)}`
            : "Sin marcar: se trata como prepago."}
        </p>
        <Button size="sm" onClick={() => void save()} disabled={!dirty || saving} className="shrink-0">
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </div>
      {message ? (
        <p role="status" className={cn("mt-1.5 text-xs", message.ok ? "text-ok-fg" : "text-danger-fg")}>
          {message.text}
        </p>
      ) : null}
    </section>
  );
}

function SignalCard({ signal }: { signal: MonitorSignal }) {
  return (
    <div
      className={cn(
        "rounded-box border border-[var(--t-line)] bg-surface px-3.5 py-3",
        `tone-${SEVERITY_TONE[signal.severity]}`,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[var(--t-fg)]">{signal.title}</p>
          <p className="mt-0.5 text-[13px] leading-5 text-ink-2">{signal.detail}</p>
        </div>
        {signal.amountUsd != null ? (
          <span className="num shrink-0 text-[13px] font-semibold text-[var(--t-fg)]">{usd(signal.amountUsd)}</span>
        ) : null}
      </div>
    </div>
  );
}

function AccountsTable({ accounts }: { accounts: MonitorAccount[] }) {
  if (accounts.length === 0) {
    return <p className="text-[13px] text-ink-2">Sin cuentas vinculadas en TikTok.</p>;
  }
  const th = "h-9 whitespace-nowrap border-b border-line px-2 text-xs font-medium text-ink-2";
  const td = "h-11 border-b border-line px-2 py-1.5 align-middle";
  return (
    <div className="max-h-[22rem] overflow-auto rounded-box border border-line bg-surface">
      <table className="w-full border-collapse text-[13px]">
        <caption className="sr-only">Cuentas TikTok del cliente</caption>
        <thead className="sticky top-0 bg-surface">
          <tr>
            <th scope="col" className={cn(th, "text-left")}>Cuenta</th>
            <th scope="col" className={cn(th, "text-right")}>Puede gastar</th>
            <th scope="col" className={cn(th, "text-right")}>Cartera</th>
            <th scope="col" className={cn(th, "text-right")}>Sin pago</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => {
            const risky = a.unlimited || (a.excessUsd ?? 0) > 1;
            return (
              <tr
                key={a.advertiserId}
                className={cn("[&:last-child>td]:border-b-0", a.status === "banned" && "opacity-55")}
              >
                <td className={td}>
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="panel-badge tone-neutral num shrink-0">BM{a.bm}</span>
                    <span className="min-w-0 max-w-[14rem] truncate font-medium text-ink" title={a.name}>
                      {a.name}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-ink-3">
                    {a.status === "banned" ? "Baneada · " : ""}
                    {a.kind === "cash" ? "Cash" : "Cupo compartido"} · adv {a.advertiserId}
                  </p>
                </td>
                <td className={cn(td, "num whitespace-nowrap text-right text-ink")}>
                  {a.unlimited ? <span className="font-semibold text-danger-fg">Sin tope</span> : usd(a.spendableUsd)}
                </td>
                <td className={cn(td, "num whitespace-nowrap text-right text-ink")}>{usd(a.walletUsd)}</td>
                <td
                  className={cn(
                    td,
                    "num whitespace-nowrap text-right",
                    risky && a.status !== "banned" ? "font-semibold text-danger-fg" : "text-ink-3",
                  )}
                >
                  {a.unlimited ? "∞" : usd(a.excessUsd)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* --- Movimientos raros -------------------------------------------------------- */

function EventsList({
  events,
  now,
  modalidadById,
}: {
  events: MonitorEvent[];
  now: number;
  modalidadById: Map<string, ClienteModalidad>;
}) {
  if (events.length === 0) {
    return (
      <section className="rounded-card border border-line bg-surface shadow-card">
        <EmptyState icon="check-circle" title="Sin movimientos raros en la ventana revisada." />
      </section>
    );
  }
  return (
    <PanelCard bodyClassName="py-1 sm:py-2">
      <ul>
        {events.map((e) => {
          const acuerdo = modalidadById.get(e.clienteId) === "acuerdo";
          const tone: Tone = acuerdo ? VERDICT_META.acuerdo.tone : SEVERITY_TONE[e.severity];
          return (
            <li
              key={e.id}
              className={cn("flex items-start justify-between gap-3 border-b border-line py-3 last:border-b-0", `tone-${tone}`)}
            >
              <div className="flex min-w-0 gap-2.5">
                <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--t-solid)]" />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <b className="font-semibold text-ink">{e.clienteName}</b>
                    <ToneBadge tone={acuerdo ? "info" : "neutral"}>{MODALIDAD_LABEL[acuerdo ? "acuerdo" : "prepago"]}</ToneBadge>
                    <span className="font-medium text-[var(--t-fg)]">{e.title}</span>
                  </p>
                  <p className="mt-1 text-[13px] leading-5 text-ink-2">{e.detail}</p>
                  <p className="mt-1 text-xs text-ink-3">
                    {e.actor ? `Hecho por ${e.actor}. ` : ""}
                    {acuerdo
                      ? "Cliente con acuerdo: es normal, solo vigilar."
                      : "Cliente prepago: preguntar al gerente si estaba autorizado."}
                  </p>
                </div>
              </div>
              <span className="num shrink-0 whitespace-nowrap text-xs text-ink-3" title={limaDateTime(e.at)}>
                {relativeTime(e.at, now)}
              </span>
            </li>
          );
        })}
      </ul>
    </PanelCard>
  );
}

/* --- Cómo leer esta pantalla -------------------------------------------------- */

const VERDICT_HELP: Array<[VerdictKey, string]> = [
  ["quitar_saldo", "Puede gastar plata que no pagó. Es un error. Avisar al gerente para quitar ese saldo."],
  ["preguntar", "Alguien le cargó saldo sin que pagara. Preguntar al gerente si estaba autorizado."],
  ["cobrar", "Ya gastó más de lo que pagó este mes. Cobrarle y avisar al gerente."],
  ["acuerdo", "Paga después con acuerdo. Tener deuda es normal. Solo vigilar que pague."],
  ["ok", "Solo gasta lo que pagó. No hacer nada."],
];

function HowToRead() {
  return (
    <Disclosure summary="Cómo leer esta pantalla">
      <div className="grid gap-5 pt-1 lg:grid-cols-2">
        <div className="space-y-2.5">
          <p className="eyebrow">La regla</p>
          <p className="text-[13px] leading-5 text-ink">
            Un cliente <b>prepago</b> primero paga (recarga) y después gasta. Nunca debería gastar más de
            lo que pagó. Algunos clientes tienen un <b>acuerdo con gerencia</b> y pagan después: a ellos
            es normal verles deuda.
          </p>
          <p className="eyebrow pt-1">Palabras</p>
          <ul className="space-y-1.5 text-[13px] leading-5 text-ink">
            <li>
              <b>Cartera:</b> plata que el cliente pagó y todavía no gastó.
            </li>
            <li>
              <b>Puede gastar sin pagar:</b> lo que TikTok le deja gastar menos lo que tiene pagado. Si no es
              $0, puede gastar plata que no pagó.
            </li>
            <li>
              <b>Deuda del mes:</b> lo que gastó (con fee) menos lo que pagó este mes.
            </li>
            <li>
              <b>Carga directa:</b> alguien puso saldo en TikTok sin pasar por Ads Holistic.
            </li>
          </ul>
        </div>
        <div>
          <p className="eyebrow">Los colores</p>
          <ul className="mt-1">
            {VERDICT_HELP.map(([key, text]) => (
              <li
                key={key}
                className="flex items-start justify-between gap-3 border-b border-line py-2.5 last:border-b-0"
              >
                <ToneBadge tone={VERDICT_META[key].tone} dot className="shrink-0">
                  {VERDICT_META[key].label}
                </ToneBadge>
                <span className="text-right text-[13px] leading-5 text-ink-2">{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Disclosure>
  );
}

/* --- Carga -------------------------------------------------------------------- */

/** Pasos que sigue el servidor, en el orden en que suelen terminar (~15 s en total). */
const LOADING_STEPS: Array<{ at: number; label: string; short: string }> = [
  { at: 0, label: "Leyendo cartera y pagos de Ads Holistic…", short: "Cartera" },
  { at: 2_500, label: "Revisando cuentas TikTok BM10 y BM30…", short: "BM10/30" },
  { at: 6_000, label: "Revisando cuentas cash BM200 y BM300…", short: "BM200/300" },
  { at: 9_500, label: "Buscando cargas directas y recargas de gerente…", short: "Movimientos" },
  { at: 12_500, label: "Cruzando con Hecom y armando alertas…", short: "Alertas" },
];
const EXPECTED_MS = 15_000;

/** Progreso estimado: avanza rápido al inicio y se frena cerca del final (nunca llega a 100 sola). */
function useLoadingProgress(active: boolean) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) return;
    const started = Date.now();
    const id = window.setInterval(() => setElapsed(Date.now() - started), 200);
    return () => {
      window.clearInterval(id);
      setElapsed(0);
    };
  }, [active]);
  const ratio = elapsed / EXPECTED_MS;
  const percent = Math.min(96, Math.round((1 - Math.exp(-2.2 * ratio)) * 100));
  const step = [...LOADING_STEPS].reverse().find((s) => elapsed >= s.at) ?? LOADING_STEPS[0]!;
  return { percent, step: step.label, stepIndex: LOADING_STEPS.indexOf(step), slow: elapsed > EXPECTED_MS + 8_000 };
}

function ProgressBar({ percent, label, min, thin = false }: { percent: number; label: string; min: number; thin?: boolean }) {
  return (
    <div
      className={cn("w-full overflow-hidden rounded-full bg-subtle", thin ? "h-1" : "h-2")}
      role="progressbar"
      aria-label={label}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out motion-reduce:transition-none"
        style={{ width: `${Math.max(min, percent)}%` }}
      />
    </div>
  );
}

/** Barra fina mientras se actualiza con datos ya en pantalla. */
function RefreshBar({ active }: { active: boolean }) {
  const { percent } = useLoadingProgress(active);
  if (!active) return null;
  return <ProgressBar percent={percent} label="Actualizando monitoreo" min={6} thin />;
}

function MonitorSkeleton() {
  const { percent, step, stepIndex, slow } = useLoadingProgress(true);
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando monitoreo">
      <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="font-semibold text-ink">Revisando el sistema</p>
          <span className="num text-[13px] font-semibold text-accent-text">{percent} %</span>
        </div>
        <div className="mt-3">
          <ProgressBar percent={percent} label="Progreso de la revisión" min={4} />
        </div>
        <p className="mt-2.5 text-[13px] text-ink-2" aria-live="polite">
          {slow ? "Está tardando más de lo normal, TikTok responde lento. Sigue revisando…" : step}
        </p>
        <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {LOADING_STEPS.map((s, i) => (
            <li key={s.label} className="flex items-center gap-1.5 text-xs">
              <span
                className={cn(
                  "inline-grid size-4 shrink-0 place-items-center rounded-full font-mono text-[9px] font-semibold",
                  i < stepIndex
                    ? "bg-ok-solid text-on-accent"
                    : i === stepIndex
                      ? "bg-accent-btn text-on-accent"
                      : "bg-subtle text-ink-3",
                )}
                aria-hidden
              >
                {i < stepIndex ? <PanelIcon name="check" className="size-2.5" /> : i + 1}
              </span>
              <span className={i <= stepIndex ? "text-ink" : "text-ink-3"}>{s.short}</span>
            </li>
          ))}
        </ol>
      </section>
      <div className="flex animate-pulse flex-col gap-4 motion-reduce:animate-none" aria-hidden>
        <div className="h-44 rounded-card bg-subtle" />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-card border border-line bg-surface" />
          ))}
        </div>
        <div className="h-80 rounded-card border border-line bg-surface" />
      </div>
    </div>
  );
}
