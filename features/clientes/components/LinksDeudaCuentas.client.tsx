"use client";

import { useEffect, useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { routes } from "@/config/routes";
import { Button } from "@/components/ui/Button";
import { Note } from "@/components/ui/PanelKit";
import { PanelIcon } from "@/components/ui/PanelIcon";
import type { AdAccountLiveMetricsClient } from "@/features/ad-accounts/hooks/useAdAccountLiveMetrics";
import { isTikTokBudgetCupoBalance } from "@/features/ad-accounts/lib/classify-tiktok-live-balance";
import { PaymentsGerenteAccountsSummary } from "@/features/payments/components/PaymentsGerenteAccountsSummary.client";
import { PaymentToolbar } from "@/features/payments/components/PaymentToolbar.client";
import { PaymentsTable } from "@/features/payments/components/PaymentsTable";
import { filterPaymentAccounts } from "@/lib/filter/payment-accounts";
import {
  sortPaymentAccounts,
  summarizePaymentAccounts,
  type PaymentAccountSortKey,
} from "@/lib/sort/payment-accounts";
import type { PaymentAccountAllocation } from "@/types/payment";

type CuentasPayload = {
  ok: boolean;
  error?: string;
  accounts?: PaymentAccountAllocation[];
  live?: AdAccountLiveMetricsClient[];
  updatedAt?: string | null;
  liveError?: string | null;
};

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      accounts: PaymentAccountAllocation[];
      live: Record<string, AdAccountLiveMetricsClient>;
      updatedAt: string | null;
    };

/**
 * Pulso de cuentas del cliente elegido en Links deuda (solo lectura).
 * Recargar / Cambiar ID / Recuperar abren Pagos con ese cliente: ahí están
 * los modales de siempre y la sesión queda en el cliente correcto.
 */
export function LinksDeudaCuentas({
  clienteId,
  clienteName,
}: {
  clienteId: string;
  clienteName: string;
}) {
  const router = useRouter();
  const uid = useId();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<PaymentAccountSortKey>("recommended");
  const [opening, startOpening] = useTransition();
  const [openError, setOpenError] = useState<string | null>(null);

  useEffect(() => {
    // El panel monta este componente con key={clienteId}: cada cliente arranca limpio.
    let cancelled = false;
    fetch(`/api/links-deuda/${encodeURIComponent(clienteId)}/cuentas`, {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (res) => {
        const json = (await res.json()) as CuentasPayload;
        if (cancelled) return;
        if (!res.ok || !json.ok) {
          setState({ status: "error", message: json.error ?? "No se pudieron cargar las cuentas." });
          return;
        }
        const live: Record<string, AdAccountLiveMetricsClient> = {};
        for (const row of json.live ?? []) {
          if (row?.advertiserId) live[row.advertiserId] = row;
        }
        setState({
          status: "ready",
          accounts: json.accounts ?? [],
          live,
          updatedAt: json.updatedAt ?? null,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setState({ status: "error", message: "No se pudieron cargar las cuentas." });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [clienteId]);

  const accounts = useMemo(
    () => (state.status === "ready" ? state.accounts : []),
    [state],
  );
  const live = useMemo(
    () => (state.status === "ready" ? state.live : {}),
    [state],
  );

  const summary = useMemo(() => summarizePaymentAccounts(accounts), [accounts]);

  const liveTotals = useMemo(() => {
    let cash = 0;
    let cupo = 0;
    let cashCount = 0;
    let cupoCount = 0;
    const ids = new Set(
      accounts
        .map((account) => account.externalAccountId?.trim())
        .filter((id): id is string => Boolean(id)),
    );
    for (const id of ids) {
      const metric = live[id];
      if (metric?.balanceUsd == null) continue;
      if (isTikTokBudgetCupoBalance(metric)) {
        cupo += metric.balanceUsd;
        cupoCount += 1;
      } else {
        cash += metric.balanceUsd;
        cashCount += 1;
      }
    }
    const cashTotal = cashCount > 0 ? Math.round(cash * 100) / 100 : null;
    const cupoTotal = cupoCount > 0 ? Math.round(cupo * 100) / 100 : null;
    return {
      cash: cashTotal,
      cupo: cupoTotal,
      total: cashTotal != null || cupoTotal != null ? (cashTotal ?? 0) + (cupoTotal ?? 0) : null,
    };
  }, [accounts, live]);

  const filtered = useMemo(
    () => sortPaymentAccounts(filterPaymentAccounts(accounts, { search, status }), sort),
    [accounts, search, status, sort],
  );

  function openInPagos() {
    setOpenError(null);
    startOpening(async () => {
      try {
        const res = await fetch("/api/clientes/seleccionar", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clienteId, name: clienteName, actAsCliente: false }),
        });
        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !json.ok) {
          setOpenError(json.error ?? "No se pudo abrir Pagos.");
          return;
        }
        router.push(`${routes.payments}#asignar-saldo`);
        router.refresh();
      } catch {
        setOpenError("No se pudo abrir Pagos.");
      }
    });
  }

  return (
    <section aria-labelledby={`${uid}-title`} className="min-w-0 overflow-hidden rounded-box border border-line">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5">
        <div className="min-w-0">
          <h3 id={`${uid}-title`} className="text-sm font-semibold text-ink">
            Cuentas del cliente
          </h3>
          <p className="mt-0.5 text-xs text-ink-2">Recargar y los demás cambios se hacen en Pagos con este cliente.</p>
        </div>
        <Button variant="outline" size="sm" className="shrink-0" onClick={openInPagos} disabled={opening}>
          {opening ? "Abriendo…" : "Gestionar en Pagos"}
          <PanelIcon name="arrow-right" />
        </Button>
      </div>

      {openError ? (
        <Note tone="danger" className="mx-4 mt-3">
          {openError}
        </Note>
      ) : null}

      {state.status === "loading" ? (
        <div className="space-y-2 p-4" aria-busy="true">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-box bg-subtle motion-reduce:animate-none" />
            ))}
          </div>
          <div className="h-24 animate-pulse rounded-box bg-field motion-reduce:animate-none" />
        </div>
      ) : state.status === "error" ? (
        <div className="p-4">
          <Note tone="danger">{state.message}</Note>
        </div>
      ) : (
        <>
          <PaymentsGerenteAccountsSummary
            summary={summary}
            liveCreditTotalUsd={liveTotals.total}
            liveCashTotalUsd={liveTotals.cash}
            liveCupoTotalUsd={liveTotals.cupo}
            lastUpdatedAt={state.updatedAt}
          />
          {accounts.length > 0 ? (
            <PaymentToolbar
              search={search}
              status={status}
              onSearchChange={setSearch}
              onStatusChange={setStatus}
              sort={sort}
              onSortChange={setSort}
              agencyBmFunding
            />
          ) : null}
          <PaymentsTable
            accounts={filtered}
            onAllocate={openInPagos}
            onReclaim={openInPagos}
            onTransfer={openInPagos}
            onEditTikTokIds={openInPagos}
            agencyBmFunding
            liveMetricsByAdvertiser={live}
          />
        </>
      )}
    </section>
  );
}
