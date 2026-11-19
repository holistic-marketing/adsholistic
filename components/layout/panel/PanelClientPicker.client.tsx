"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { PanelDialog } from "@/components/ui/PanelDialog.client";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { initialsOf, usePanel } from "./panel-context.client";
import { normalizeSearch } from "./use-quick-actions.client";

interface ClienteRow {
  id: string;
  name: string;
  slug?: string | null;
  contactEmail?: string | null;
  biz?: string | null;
  tiktokAdvertiserId?: string | null;
  adAccountCount?: number;
}

type LoadState = { status: "idle" | "loading" | "error" } | { status: "ready"; clients: ClienteRow[] };

/** «Elige un cliente»: lista con búsqueda; al elegir, el panel queda filtrado. */
export function PanelClientPicker({
  open,
  asClient,
  onClose,
}: {
  open: boolean;
  asClient: boolean;
  onClose: () => void;
}) {
  const ts = useTranslations("nav.shell");
  return (
    <PanelDialog
      open={open}
      onClose={onClose}
      title={ts("pickClientTitle")}
      description={asClient ? ts("pickClientDescAs") : ts("pickClientDesc")}
      closeLabel={ts("close")}
    >
      {open ? <ClientPickerList asClient={asClient} onDone={onClose} autoFocus /> : null}
    </PanelDialog>
  );
}

// La lista se pide una vez por sesión de la pestaña.
let cache: ClienteRow[] | null = null;

/** Buscador con la lista de clientes. Se usa en el diálogo y en las páginas que piden un cliente. */
export function ClientPickerList({
  asClient = false,
  onDone,
  autoFocus = false,
}: {
  asClient?: boolean;
  onDone?: () => void;
  autoFocus?: boolean;
}) {
  const ts = useTranslations("nav.shell");
  const panel = usePanel();
  const [state, setState] = useState<LoadState>(cache ? { status: "ready", clients: cache } : { status: "idle" });
  const [query, setQuery] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (cache) return;
    let cancelled = false;
    fetch("/api/clientes", { credentials: "include", cache: "no-store" })
      .then((res) => res.json())
      .then((json: { ok?: boolean; clients?: ClienteRow[] }) => {
        if (cancelled) return;
        if (!json.ok || !json.clients) {
          setState({ status: "error" });
          return;
        }
        cache = json.clients;
        setState({ status: "ready", clients: json.clients });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const q = normalizeSearch(query);
  const clients = state.status === "ready" ? state.clients : [];
  const results = clients
    .filter((c) => !q || normalizeSearch([c.name, c.contactEmail, c.slug, c.biz, c.tiktokAdvertiserId].filter(Boolean).join(" ")).includes(q))
    .slice(0, 200);

  function pick(client: ClienteRow) {
    onDone?.();
    panel.selectCliente({ id: client.id, name: client.name }, asClient ? { asClient: true } : {});
  }

  return (
    <>
      <label className="panel-search w-full max-w-none">
        <span className="sr-only">{ts("pickClientSearch")}</span>
        <PanelIcon name="search" />
        <input
          type="search"
          autoFocus={autoFocus}
          value={query}
          placeholder={ts("pickClientSearch")}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && results[0]) {
              event.preventDefault();
              pick(results[0]);
            }
          }}
        />
      </label>
      <ul className="mt-2 max-h-80 overflow-y-auto rounded-box border border-line bg-surface text-left">
        {state.status === "idle" || state.status === "loading" ? (
          <li className="p-4 text-ink-3">{ts("pickClientLoading")}</li>
        ) : null}
        {state.status === "error" ? (
          <li className="flex items-center justify-between gap-3 p-4 text-danger-fg">
            {ts("pickClientError")}
            <button
              type="button"
              className="panel-btn panel-btn--sm"
              onClick={() => {
                setState({ status: "loading" });
                setAttempt((n) => n + 1);
              }}
            >
              {ts("retry")}
            </button>
          </li>
        ) : null}
        {state.status === "ready" && results.length === 0 ? <li className="p-4 text-ink-3">{ts("pickClientNone")}</li> : null}
        {results.map((client) => {
          const current = client.id === panel.selectedCliente?.id;
          return (
            <li key={client.id} className="border-b border-line last:border-b-0">
              <button
                type="button"
                onClick={() => pick(client)}
                aria-current={current ? "true" : undefined}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left outline-none hover:bg-hover focus-visible:bg-hover"
              >
                <span className="panel-avatar panel-avatar--sm" aria-hidden>
                  {initialsOf(client.name)}
                </span>
                <span className="grid min-w-0 flex-1 leading-tight">
                  <b className="truncate font-semibold">{client.name}</b>
                  <small className="truncate text-xs text-ink-3">
                    {[client.biz, client.contactEmail].filter(Boolean).join(" · ") || client.slug}
                  </small>
                </span>
                {current ? <PanelIcon name="check" className="text-accent-text" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
