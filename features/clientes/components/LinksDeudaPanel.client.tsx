"use client";

import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Avatar, EmptyState, SquareIcon } from "@/components/ui/PanelKit";
import { PanelIcon, type PanelIconName } from "@/components/ui/PanelIcon";
import { cn } from "@/lib/cn";
import { LinksDeudaCuentas } from "@/features/clientes/components/LinksDeudaCuentas.client";

type DebtLinkClient = {
  id: string;
  name: string;
  url: string;
};

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

const LINK_FEATURES: Array<{ title: string; body: string; icon: PanelIconName }> = [
  {
    title: "Cuánto debe",
    body: "Saldo del mes con gasto + fee, lo cobrado y el gasto de cada cuenta ads.",
    icon: "chart",
  },
  {
    title: "Pagos y gastos",
    body: "Día a día, historial y comprobantes.",
    icon: "ledger",
  },
  {
    title: "Paga o reporta",
    body: "Sube voucher o avisa si falta un pago.",
    icon: "upload",
  },
];

/* Links de deuda (sistema visual v3 «split»): lista de clientes a la izquierda
   y, a la derecha, el link público del elegido con sus cuentas. */
export function LinksDeudaPanel({ clients }: { clients: DebtLinkClient[] }) {
  const uid = useId();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const filtered = useMemo(() => {
    const q = fold(query);
    if (!q) return clients;
    return clients.filter((row) => fold(row.name).includes(q));
  }, [clients, query]);

  const selected = clients.find((row) => row.id === selectedId) ?? null;

  async function copyLink() {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(selected.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(280px,380px)_minmax(0,1fr)]">
      <section
        aria-labelledby={`${uid}-list`}
        className="min-w-0 overflow-hidden rounded-card border border-line bg-surface shadow-card lg:sticky lg:top-16"
      >
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 pb-3.5 pt-4">
          <h2 id={`${uid}-list`} className="text-base font-semibold leading-6 tracking-[-0.01em] text-ink">
            Clientes
          </h2>
          <span className="panel-badge num">
            {filtered.length} de {clients.length}
          </span>
        </div>
        <div className="border-b border-line px-4 py-3">
          <label className="panel-search">
            <span className="sr-only">Buscar cliente</span>
            <PanelIcon name="search" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Busca por nombre"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        </div>
        <ul className="ui-scroll max-h-[62vh] overflow-y-auto overscroll-y-contain">
          {filtered.length === 0 ? (
            <li className="px-4 py-10 text-center text-[13px] text-ink-2">Ningún cliente con ese nombre.</li>
          ) : (
            filtered.map((row) => {
              const active = row.id === selectedId;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(row.id);
                      setCopied(false);
                    }}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "relative flex w-full items-center gap-2.5 border-b border-line px-4 py-2.5 text-left",
                      active
                        ? "bg-active before:absolute before:left-0 before:top-1/2 before:-mt-2.5 before:h-5 before:w-[3px] before:rounded-r-[3px] before:bg-accent"
                        : "hover:bg-field",
                    )}
                  >
                    <Avatar name={row.name} size="sm" />
                    <span className={cn("min-w-0 flex-1 truncate text-ink", active ? "font-semibold" : "font-medium")}>
                      {row.name}
                    </span>
                    {active ? <PanelIcon name="chevron-right" className="text-ink-3" /> : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </section>

      <section aria-label="Link público" className="min-w-0 rounded-card border border-line bg-surface shadow-card">
        {selected ? (
          <>
            <div className="flex items-center gap-2.5 px-4 pt-4 sm:px-6 sm:pt-5">
              <Avatar name={selected.name} />
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold leading-6 tracking-[-0.01em] text-ink">
                  {selected.name}
                </h2>
                <p className="text-xs text-ink-2">Link público</p>
              </div>
            </div>

            <div className="space-y-6 px-4 pb-4 pt-4 sm:px-6 sm:pb-6">
              <div>
                <p className="mb-1.5 text-sm font-medium text-ink">Link público de deuda</p>
                {/* v3 «linkbox»: el link en mono y sus acciones al lado. */}
                <div className="flex items-center gap-1.5 rounded-ctl border border-line bg-field py-1 pl-3 pr-1">
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink" title={selected.url}>
                    {selected.url}
                  </span>
                  <a
                    href={selected.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Abrir el link en otra pestaña"
                    title="Abrir"
                    className="inline-grid size-8 shrink-0 place-items-center rounded-ctl text-ink hover:bg-hover"
                  >
                    <PanelIcon name="external" />
                  </a>
                  <Button size="sm" className="shrink-0" onClick={() => void copyLink()}>
                    <PanelIcon name={copied ? "check" : "copy"} />
                    {copied ? "Copiado" : "Copiar link"}
                  </Button>
                </div>
                <span className="sr-only" role="status">
                  {copied ? "Link copiado" : ""}
                </span>
                <p className="mt-1.5 text-xs text-ink-3">
                  Abre en el mes ya cerrado (en octubre, setiembre). Arriba puede pasar a otro mes, pagar o subir un
                  comprobante.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-ink">Qué ve el cliente</h3>
                <ul className="mt-2.5 grid gap-2 sm:grid-cols-3">
                  {LINK_FEATURES.map((item) => (
                    <li key={item.title} className="rounded-box border border-line bg-field px-3.5 py-3">
                      <SquareIcon icon={item.icon} tone="accent" />
                      <p className="mt-2.5 text-[13px] font-semibold text-ink">{item.title}</p>
                      <p className="mt-0.5 text-xs text-ink-3">{item.body}</p>
                    </li>
                  ))}
                </ul>
              </div>

              <LinksDeudaCuentas key={selected.id} clienteId={selected.id} clienteName={selected.name} />
            </div>
          </>
        ) : (
          <EmptyState
            icon="link"
            title="Link público"
            description="Elige un cliente de la lista para ver su link de deuda."
          />
        )}
      </section>
    </div>
  );
}
