"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  EmptyState,
  FilterBar,
  FilterButton,
  FilterChip,
  Note,
  SearchField,
  Segmented,
  ToneBadge,
} from "@/components/ui/PanelKit";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { PanelMenu, PanelPopover, usePopover } from "@/components/ui/PanelPopover.client";
import { routes } from "@/config/routes";
import { cn } from "@/lib/cn";
import { HecomClienteAvatar } from "@/features/clientes/components/HecomClienteAvatar.client";

type TiktokAccount = {
  advertiserId: string;
  advertiserName: string | null;
  bmBucket: string | null;
  fee: number | null;
  syncEnabled: boolean;
};

type ClientRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  contactName: string | null;
  contactEmail: string | null;
  biz?: string | null;
  phones?: string[];
  avatarUrl?: string | null;
  walletBalanceCents: number;
  walletCurrency: string;
  adAccountCount: number;
  activeMemberCount: number;
  tiktokAdvertiserId?: string | null;
  tiktokAccounts?: TiktokAccount[];
  billingModality?: "credito" | "prepago";
  /** % de comisión Hecom del cliente (se cambia en su ficha). */
  defaultFee?: number | null;
};

type ViewMode = "list" | "cards";
type SortKey = "az" | "za" | "tiktok" | "contacts" | "balance";
type ModalityFilter = "all" | "credito" | "prepago";
type TikTokFilter = "all" | "with" | "without";

const SORT_LABELS: Record<SortKey, string> = {
  az: "Nombre A → Z",
  za: "Nombre Z → A",
  tiktok: "Más cuentas TikTok",
  contacts: "Más contactos",
  balance: "Mayor saldo en cartera",
};

const MODALITY_OPTIONS: Array<[ModalityFilter, string]> = [
  ["all", "Todas"],
  ["credito", "Crédito"],
  ["prepago", "Prepago"],
];

const TIKTOK_OPTIONS: Array<[TikTokFilter, string]> = [
  ["all", "Todos"],
  ["with", "Con cuentas"],
  ["without", "Sin cuentas"],
];

/** Preferencias por persona (vista y orden); si el navegador no deja guardar, se usa el default. */
const PREFS_KEY = "clientes.list.prefs.v1";

type Prefs = { view: ViewMode; sort: SortKey };

// Sin almacenamiento (modo privado, bloqueado): la preferencia dura solo esta visita.
let memoryPrefs: string | null = null;
const prefsListeners = new Set<() => void>();

function subscribePrefs(listener: () => void) {
  prefsListeners.add(listener);
  return () => {
    prefsListeners.delete(listener);
  };
}

function readPrefsRaw(): string | null {
  try {
    return window.localStorage.getItem(PREFS_KEY) ?? memoryPrefs;
  } catch {
    return memoryPrefs;
  }
}

function parsePrefs(raw: string | null): Prefs {
  try {
    const parsed = JSON.parse(raw ?? "{}") as Partial<Prefs>;
    return {
      view: parsed.view === "cards" ? "cards" : "list",
      sort: parsed.sort && parsed.sort in SORT_LABELS ? parsed.sort : "az",
    };
  } catch {
    return { view: "list", sort: "az" };
  }
}

function writePrefs(prefs: Prefs) {
  memoryPrefs = JSON.stringify(prefs);
  try {
    window.localStorage.setItem(PREFS_KEY, memoryPrefs);
  } catch {
    // Queda en memoria.
  }
  prefsListeners.forEach((listener) => listener());
}

function displayName(client: ClientRow): string {
  return client.contactName?.trim() || client.contactEmail || client.name;
}

function hasTikTokAccounts(client: ClientRow): boolean {
  return Boolean(client.tiktokAdvertiserId) || (client.tiktokAccounts?.length ?? 0) > 0;
}

function feeLabel(client: ClientRow): string {
  return client.defaultFee != null ? `${client.defaultFee} %` : "—";
}

type ApiPayload = {
  ok: boolean;
  error?: string;
  source?: string;
  count?: number;
  clients?: ClientRow[];
  steps?: Array<{ step: string; ok: boolean; detail?: string }>;
  hint?: string;
  note?: string;
  scopedToEmail?: boolean;
};

/* Tabla v3: en pantallas angostas cada fila se apila y cada celda muestra su rótulo. */
const TH_BASE = "h-10 whitespace-nowrap border-b border-line px-2 text-sm font-medium text-ink";
const TH = `${TH_BASE} text-left`;
const TH_R = `${TH_BASE} text-right`;
const TD = "h-[59px] border-b border-line px-2 py-2 align-middle max-md:h-auto max-md:border-0 max-md:px-0";
/** Celda con rótulo (data-label) a la izquierda cuando la fila se apila. */
const TD_LABELED =
  "max-md:flex max-md:min-h-[30px] max-md:items-center max-md:justify-between max-md:gap-4 max-md:py-[3px] max-md:text-right max-md:before:flex-none max-md:before:text-left max-md:before:text-xs max-md:before:font-medium max-md:before:text-ink-3 max-md:before:content-[attr(data-label)]";

export function ClientesPageClient({
  mode = "staff",
}: {
  /** staff = lista CRM completa para fondear. */
  mode?: "staff" | "scoped";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<ApiPayload | null>(null);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  // Solo para mostrar «Entrando…» en el botón que se pulsó.
  const [selectingAsCliente, setSelectingAsCliente] = useState(false);
  const [selectError, setSelectError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const prefsRaw = useSyncExternalStore(subscribePrefs, readPrefsRaw, () => null);
  const { view, sort } = useMemo(() => parsePrefs(prefsRaw), [prefsRaw]);
  const [modality, setModality] = useState<ModalityFilter>("all");
  const [tiktok, setTikTok] = useState<TikTokFilter>("all");

  function changeView(next: ViewMode) {
    writePrefs({ view: next, sort });
  }

  function changeSort(next: SortKey) {
    writePrefs({ view, sort: next });
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/clientes", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        const json = (await res.json()) as ApiPayload;
        if (!cancelled) setPayload(json);
      } catch (err) {
        if (!cancelled) {
          setPayload({
            ok: false,
            error: err instanceof Error ? err.message : "Fetch falló",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Solo auto-elegir si el usuario es cliente scoped (1 cuenta propia).
    if (mode === "staff") return;
    if (!payload?.ok || !payload.scopedToEmail || selectingId) return;
    const only = payload.clients;
    if (!only || only.length !== 1) return;
    elegirCliente(only[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auto-scope 1 cliente
  }, [payload?.ok, payload?.scopedToEmail, payload?.clients?.length, selectingId, mode]);

  const filtered = useMemo(() => {
    const clients = payload?.clients ?? [];
    const query = q.trim().toLowerCase();
    const matches = clients.filter((client) => {
      if (modality !== "all" && client.billingModality !== modality) return false;
      if (tiktok === "with" && !hasTikTokAccounts(client)) return false;
      if (tiktok === "without" && hasTikTokAccounts(client)) return false;
      if (!query) return true;
      const haystack = [
        client.name,
        client.slug,
        client.contactName,
        client.contactEmail,
        client.biz,
        ...(client.phones ?? []),
        client.tiktokAdvertiserId,
        ...(client.tiktokAccounts ?? []).flatMap((a) => [
          a.advertiserId,
          a.advertiserName,
        ]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
    const byName = (a: ClientRow, b: ClientRow) =>
      displayName(a).localeCompare(displayName(b), "es", { sensitivity: "base" });
    return [...matches].sort((a, b) => {
      switch (sort) {
        case "za":
          return byName(b, a);
        case "tiktok":
          return b.adAccountCount - a.adAccountCount || byName(a, b);
        case "contacts":
          return b.activeMemberCount - a.activeMemberCount || byName(a, b);
        case "balance":
          return b.walletBalanceCents - a.walletBalanceCents || byName(a, b);
        default:
          return byName(a, b);
      }
    });
  }, [payload?.clients, q, modality, tiktok, sort]);

  const filtersActive = modality !== "all" || tiktok !== "all";

  function clearFilters() {
    setModality("all");
    setTikTok("all");
  }

  function elegirCliente(client: ClientRow, actAsCliente = false) {
    const contactName =
      client.contactName?.trim() || client.contactEmail || client.name;
    setSelectError(null);
    setSelectingId(client.id);
    setSelectingAsCliente(actAsCliente);
    startTransition(async () => {
      try {
        const res = await fetch("/api/clientes/seleccionar", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clienteId: client.id,
            name: contactName,
            actAsCliente,
          }),
        });
        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !json.ok) {
          setSelectError(json.error ?? "No se pudo seleccionar el cliente");
          setSelectingId(null);
          return;
        }
        // Gerente va directo a Pagos (fondear BM); scoped sigue a overview.
        router.push(actAsCliente ? routes.overview : mode === "staff" ? routes.payments : routes.overview);
        router.refresh();
      } catch (err) {
        setSelectError(
          err instanceof Error ? err.message : "No se pudo seleccionar",
        );
        setSelectingId(null);
      }
    });
  }

  const total = payload?.clients?.length ?? 0;
  const shown = filtered.length;
  const isStaffPicker = mode === "staff" || !payload?.scopedToEmail;

  function actionsFor(client: ClientRow) {
    const busy = pending && selectingId === client.id;
    return (
      <ClientActions
        client={client}
        staffPicker={isStaffPicker}
        busy={busy ? (selectingAsCliente ? "cliente" : "operar") : null}
        disabled={busy || pending}
        onPick={elegirCliente}
      />
    );
  }

  const modalityLabel = MODALITY_OPTIONS.find(([value]) => value === modality)?.[1] ?? "";
  const tiktokLabel = TIKTOK_OPTIONS.find(([value]) => value === tiktok)?.[1] ?? "";
  const activeChips = [
    modality !== "all" ? (
      <FilterChip key="modality" name="Modalidad" value={modalityLabel} removeLabel="Quitar filtro" onRemove={() => setModality("all")} />
    ) : null,
    tiktok !== "all" ? (
      <FilterChip key="tiktok" name="TikTok" value={tiktokLabel} removeLabel="Quitar filtro" onRemove={() => setTikTok("all")} />
    ) : null,
  ].filter(Boolean);

  return (
    <div className="min-w-0">
      <PageHeader
        eyebrow={isStaffPicker ? "CRM Hecom" : "Tu cuenta"}
        title={isStaffPicker ? "Clientes" : "Elegir cliente"}
        lede={
          isStaffPicker
            ? "Tu cartera de clientes. Opera la cuenta de uno como gerente o entra al panel como esa persona."
            : "Solo ves los clientes de tu cuenta."
        }
      />

      {selectError ? (
        <Note tone="danger" className="mb-4">
          {selectError}
        </Note>
      ) : null}

      {!loading && payload && !payload.ok ? (
        <Note tone="danger" title="No se pudieron cargar los clientes" className="mb-4">
          {payload.error ?? "Error desconocido. Reintenta en unos segundos."}
        </Note>
      ) : null}

      <FilterBar
        tools={
          <Segmented
            label="Forma de ver"
            value={view}
            onChange={changeView}
            options={[
              { value: "list", label: <><PanelIcon name="list" />Lista</> },
              { value: "cards", label: <><PanelIcon name="grid" />Tarjetas</> },
            ]}
          />
        }
        chips={
          activeChips.length ? (
            <>
              {activeChips}
              {activeChips.length > 1 ? (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Quitar filtros
                </Button>
              ) : null}
            </>
          ) : null
        }
      >
        <SearchField
          label="Buscar cliente"
          placeholder="Buscar por nombre, mail o advertiser…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <FilterMenu label="Modalidad" value={modality} options={MODALITY_OPTIONS} onChange={setModality} />
        <FilterMenu label="TikTok" value={tiktok} options={TIKTOK_OPTIONS} onChange={setTikTok} />
        <label className="sr-only" htmlFor="clientes-sort">
          Ordenar por
        </label>
        <Select
          id="clientes-sort"
          value={sort}
          onChange={(e) => changeSort(e.target.value as SortKey)}
          className="w-auto! text-[13px]"
        >
          {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
            <option key={key} value={key}>
              {SORT_LABELS[key]}
            </option>
          ))}
        </Select>
      </FilterBar>

      {loading || payload?.ok ? (
        <div className="mt-4 overflow-hidden rounded-card border border-line bg-surface p-2 shadow-card max-md:p-0">
          {loading ? (
            <LoadingRows />
          ) : filtered.length === 0 ? (
            q.trim() || filtersActive ? (
              <EmptyState
                icon="search"
                title="Ningún cliente coincide con la búsqueda o los filtros."
                description="Prueba con otro término o quita algún filtro."
                action={
                  <Button
                    variant="outline"
                    onClick={() => {
                      setQ("");
                      clearFilters();
                    }}
                  >
                    Quitar filtros
                  </Button>
                }
              />
            ) : (
              <EmptyState icon="users" title="No hay clientes Hecom para mostrar." />
            )
          ) : view === "list" ? (
            <ClientsTable clients={filtered} staffPicker={isStaffPicker} actionsFor={actionsFor} />
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-4 p-2 max-md:p-3">
              {filtered.map((client) => (
                <ClientTile key={client.id} client={client} staffPicker={isStaffPicker} actions={actionsFor(client)} />
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {!loading && payload?.ok ? (
        <p role="status" className="pt-4 text-sm text-ink-2">
          {shown === total ? (
            <>
              <b className="num font-normal">{total}</b> cliente{total === 1 ? "" : "s"}
            </>
          ) : (
            <>
              <b className="num font-normal">{shown}</b> de <b className="num font-normal">{total}</b> clientes
            </>
          )}
        </p>
      ) : null}
    </div>
  );
}

/** Filtro de una sola opción: botón v3 que abre un menú con las opciones. */
function FilterMenu<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<[T, string]>;
  onChange: (value: T) => void;
}) {
  const { anchorRef, open, toggle, close } = usePopover();
  const active = value !== options[0]?.[0];
  return (
    <>
      {/* El kit no reenvía `ref`: el ancla es el botón que queda dentro. */}
      <span
        className="contents"
        ref={(node) => {
          anchorRef.current = node?.querySelector("button") ?? null;
        }}
      >
        <FilterButton label={label} count={active ? 1 : 0} aria-haspopup="dialog" aria-expanded={open} onClick={toggle} />
      </span>
      <PanelPopover anchorRef={anchorRef} open={open} onClose={close} label={`Filtrar por ${label}`}>
        <PanelMenu
          label={label}
          items={options.map(([optionValue, optionLabel]) => ({
            label: optionLabel,
            checked: optionValue === value,
            onSelect: () => {
              onChange(optionValue);
              close();
              anchorRef.current?.focus({ preventScroll: true });
            },
          }))}
        />
      </PanelPopover>
    </>
  );
}

function LoadingRows() {
  return (
    <div aria-busy="true" className="max-md:px-4">
      <span className="sr-only">Cargando clientes…</span>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex h-[59px] items-center gap-2.5 border-b border-line px-2 last:border-0 max-md:px-0">
          <span className="size-8 shrink-0 animate-pulse rounded-full bg-subtle motion-reduce:animate-none" />
          <span className="grid gap-1.5">
            <span className="h-3 w-40 animate-pulse rounded bg-subtle motion-reduce:animate-none" />
            <span className="h-2.5 w-56 animate-pulse rounded bg-subtle motion-reduce:animate-none max-sm:w-32" />
          </span>
        </div>
      ))}
    </div>
  );
}

function ClientsTable({
  clients,
  staffPicker,
  actionsFor,
}: {
  clients: ClientRow[];
  staffPicker: boolean;
  actionsFor: (client: ClientRow) => ReactNode;
}) {
  return (
    <div className="overflow-x-auto" role="region" aria-label="Clientes" tabIndex={0}>
      <table className="w-full border-collapse text-sm max-md:block">
        <caption className="sr-only">Clientes</caption>
        <thead className="max-md:sr-only">
          <tr>
            <th scope="col" className={TH}>Cliente</th>
            <th scope="col" className={TH}>Modalidad</th>
            <th scope="col" className={TH_R}>Cuentas TikTok</th>
            <th scope="col" className={TH_R}>Contactos</th>
            {staffPicker ? <th scope="col" className={TH}>Comisión</th> : null}
            <th scope="col" className={cn(TH, "w-[1%]")}>
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody className="max-md:block">
          {clients.map((client) => (
            <tr
              key={client.id}
              className="hover:bg-field max-md:block max-md:border-b max-md:border-line max-md:px-4 max-md:py-3 max-md:last:border-0 [&:last-child>td]:border-b-0"
            >
              <td className={cn(TD, "max-md:block max-md:pb-2")}>
                <ClientIdentity client={client} />
              </td>
              <td className={cn(TD, TD_LABELED)} data-label="Modalidad">
                <ClientBadges client={client} />
              </td>
              <td className={cn(TD, TD_LABELED, "num text-right font-semibold")} data-label="Cuentas TikTok">
                {client.adAccountCount}
              </td>
              <td className={cn(TD, TD_LABELED, "num text-right")} data-label="Contactos">
                {client.activeMemberCount}
              </td>
              {staffPicker ? (
                <td className={cn(TD, TD_LABELED)} data-label="Comisión">
                  <FeeLink client={client} />
                </td>
              ) : null}
              <td className={cn(TD, "w-[1%] whitespace-nowrap text-right max-md:flex max-md:w-full max-md:justify-end max-md:pt-2.5")}>
                <div className="inline-flex flex-wrap items-center justify-end gap-1.5">{actionsFor(client)}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClientTile({
  client,
  staffPicker,
  actions,
}: {
  client: ClientRow;
  staffPicker: boolean;
  actions: ReactNode;
}) {
  return (
    <li className="grid min-w-0 content-start gap-3 rounded-box border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-2.5">
        <ClientIdentity client={client} />
        <ClientBadges client={client} />
      </div>
      <dl className="grid grid-cols-3 gap-2">
        <MiniStat label="Cuentas TikTok" value={client.adAccountCount} />
        <MiniStat label="Contactos" value={client.activeMemberCount} />
        <MiniStat label="Comisión" value={feeLabel(client)} />
      </dl>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <div className="flex flex-wrap items-center gap-1.5">{actions}</div>
        {staffPicker ? <FeeLink client={client} /> : null}
      </div>
    </li>
  );
}

function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-box border border-line bg-field px-3 py-2.5">
      <dt className="truncate text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-3">{label}</dt>
      <dd className="num mt-0.5 text-[15px] font-semibold leading-snug text-ink">{value}</dd>
    </div>
  );
}

function ClientIdentity({ client }: { client: ClientRow }) {
  const name = displayName(client);
  return (
    <div className="flex min-w-0 items-center gap-2.5 md:min-w-[190px]">
      <HecomClienteAvatar name={name} avatarUrl={client.avatarUrl} size="sm" />
      <div className="grid min-w-0 leading-[1.35]">
        <Link
          href={`/clientes/${client.id}`}
          className="max-w-[34ch] truncate font-semibold text-ink underline decoration-transparent underline-offset-[3px] hover:decoration-current"
        >
          {name}
        </Link>
        <small className="max-w-[38ch] truncate text-xs text-ink-3">
          {client.biz ? `${client.biz} · ` : ""}
          {client.contactEmail ?? client.slug}
        </small>
      </div>
    </div>
  );
}

function ClientBadges({ client }: { client: ClientRow }) {
  return (
    <span className="flex flex-wrap gap-1 md:flex-nowrap">
      {client.billingModality === "credito" ? (
        <ToneBadge tone="warn">Crédito</ToneBadge>
      ) : client.billingModality === "prepago" ? (
        <ToneBadge tone="neutral">Prepago</ToneBadge>
      ) : null}
      {hasTikTokAccounts(client) ? <ToneBadge tone="accent">TikTok</ToneBadge> : null}
    </span>
  );
}

/** Comisión del cliente (v3 «btn-soft»): lleva a su ficha para cambiarla. */
function FeeLink({ client }: { client: ClientRow }) {
  return (
    <Link
      href={`/clientes/${client.id}#comision`}
      aria-label={`Comisión de ${displayName(client)}: ${client.defaultFee != null ? `${client.defaultFee} %` : "sin porcentaje propio"}. Cambiar`}
      title="Cambiar la comisión de este cliente"
      className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-ctl border border-accent-line bg-accent-soft px-2.5 text-[13px] font-medium text-accent-text shadow-ctl hover:border-accent"
    >
      <span className="num">{feeLabel(client)}</span>
      <PanelIcon name="pencil" />
    </Link>
  );
}

/** Botones de una fila o tarjeta. */
function ClientActions({
  client,
  staffPicker,
  busy,
  disabled,
  onPick,
}: {
  client: ClientRow;
  staffPicker: boolean;
  /** Qué botón está esperando la selección. */
  busy: "operar" | "cliente" | null;
  disabled: boolean;
  onPick: (client: ClientRow, actAsCliente?: boolean) => void;
}) {
  const name = displayName(client);
  if (!staffPicker) {
    return (
      <Button size="sm" disabled={disabled} onClick={() => onPick(client)}>
        {busy ? "Eligiendo…" : "Operar este cliente"}
      </Button>
    );
  }
  return (
    <>
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => onPick(client, false)}>
        {busy === "operar" ? (
          "Entrando…"
        ) : (
          <>
            Operar<span className="sr-only"> como gerente: {name}</span>
          </>
        )}
      </Button>
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => onPick(client, true)}>
        {busy === "cliente" ? (
          "Entrando…"
        ) : (
          <>
            Vista de cliente<span className="sr-only">: entrar al panel como {name}</span>
          </>
        )}
      </Button>
    </>
  );
}
