"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { filterPaymentAccounts } from "@/lib/filter/payment-accounts";
import {
  sortPaymentAccounts,
  summarizePaymentAccounts,
  type PaymentAccountSortKey,
} from "@/lib/sort/payment-accounts";
import { useAdAccountLiveMetrics } from "@/features/ad-accounts/hooks/useAdAccountLiveMetrics";
import { isTikTokBudgetCupoBalance } from "@/features/ad-accounts/lib/classify-tiktok-live-balance";
import { formatMoney } from "@/lib/format-money";
import { PaymentToolbar } from "./PaymentToolbar.client";
import { AllocateBalanceModal } from "./AllocateBalanceModal.client";
import { EditTikTokIdsModal } from "./EditTikTokIdsModal.client";
import { ReclaimBalanceModal } from "./ReclaimBalanceModal.client";
import { TransferBalanceModal } from "./TransferBalanceModal.client";
import { PaymentsGerenteAccountsSummary } from "./PaymentsGerenteAccountsSummary.client";
import { PaymentsTable } from "./PaymentsTable";
import { AppealAccountModal } from "./AppealAccountModal.client";
import { FlushStat, FlushStats } from "./PaymentsFlushStats";
import { Button } from "@/components/ui/Button";
import { SquareIcon } from "@/components/ui/PanelKit";
import type { AppealStatus } from "@/lib/appeals/account-appeals.shared";
import type { PaymentAccountAllocation } from "@/types/payment";

interface PaymentsAssignmentPanelProps {
  accounts: PaymentAccountAllocation[];
  /** Explicit prop — avoid relying on context inside portaled modal. */
  agencyBmFunding?: boolean;
  allowForceLedger?: boolean;
  /** Cartera Holistic disponible para Asignar (modo cliente). */
  walletBalance?: number;
}

export function PaymentsAssignmentPanel({
  accounts,
  agencyBmFunding = false,
  allowForceLedger = false,
  walletBalance = 0,
}: PaymentsAssignmentPanelProps) {
  const t = useTranslations("payments");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<PaymentAccountSortKey>("recommended");
  const [selectedAccount, setSelectedAccount] =
    useState<PaymentAccountAllocation | null>(null);
  const [reclaimAccount, setReclaimAccount] =
    useState<PaymentAccountAllocation | null>(null);
  const [transferAccount, setTransferAccount] =
    useState<PaymentAccountAllocation | null>(null);
  const [editAccount, setEditAccount] =
    useState<PaymentAccountAllocation | null>(null);
  const [appealAccount, setAppealAccount] =
    useState<PaymentAccountAllocation | null>(null);
  const [appealStatus, setAppealStatus] = useState<Record<string, AppealStatus>>({});
  const hasSuspended = accounts.some((a) => a.status === "disabled");

  // Estado de apelación de las cuentas suspendidas (chip verde «en revisión»).
  useEffect(() => {
    if (!hasSuspended) return;
    let alive = true;
    void fetch("/api/appeals", { cache: "no-store" })
      .then((res) => res.json())
      .then((json: { appeals?: Array<{ advertiserId: string; status: AppealStatus }> }) => {
        if (!alive || !json.appeals) return;
        setAppealStatus(Object.fromEntries(json.appeals.map((a) => [a.advertiserId, a.status])));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [hasSuspended]);
  const [allocateToast, setAllocateToast] = useState<{
    amount: number;
    accountName: string;
    agencyBmFunding: boolean;
  } | null>(null);

  useEffect(() => {
    if (!allocateToast) return;
    const timer = window.setTimeout(() => setAllocateToast(null), 5600);
    return () => window.clearTimeout(timer);
  }, [allocateToast]);

  // Siempre: el Saldo de la tabla debe alinearse con TikTok Manager (cupo
  // gastable), no solo con el ledger Holistic. Antes solo se pedía en modo gerente.
  const {
    metricsByAdvertiser,
    loading,
    lastUpdatedAt,
    error: liveMetricsError,
    refreshAfterFundingChange,
  } = useAdAccountLiveMetrics(true);

  const accountSummary = useMemo(
    () => summarizePaymentAccounts(accounts),
    [accounts],
  );

  const liveTikTokSummary = useMemo(() => {
    let cash = 0;
    let cupo = 0;
    let cashCount = 0;
    let cupoCount = 0;
    let stale = false;
    const advertiserIds = Array.from(
      new Set(
        accounts
          .map((account) => account.externalAccountId?.trim())
          .filter((id): id is string => Boolean(id)),
      ),
    );

    for (const id of advertiserIds) {
      const metric = metricsByAdvertiser[id];
      if (metric?.balanceUsd == null) continue;
      stale ||= Boolean(metric.stale);
      if (isTikTokBudgetCupoBalance(metric)) {
        cupo += metric.balanceUsd;
        cupoCount += 1;
      } else {
        cash += metric.balanceUsd;
        cashCount += 1;
      }
    }

    return {
      cash: cashCount > 0 ? Math.round(cash * 100) / 100 : null,
      cupo: cupoCount > 0 ? Math.round(cupo * 100) / 100 : null,
      cashCount,
      cupoCount,
      expectedCount: advertiserIds.length,
      stale,
    };
  }, [accounts, metricsByAdvertiser]);

  const liveCreditTotalUsd =
    liveTikTokSummary.cash != null || liveTikTokSummary.cupo != null
      ? (liveTikTokSummary.cash ?? 0) + (liveTikTokSummary.cupo ?? 0)
      : null;

  const filteredAccounts = useMemo(() => {
    const filtered = filterPaymentAccounts(accounts, { search, status });
    return sortPaymentAccounts(filtered, sort);
  }, [accounts, search, status, sort]);

  return (
    <>
      {allocateToast ? (
        <div
          className="fixed bottom-5 left-1/2 z-[120] w-[min(92vw,420px)] -translate-x-1/2"
          role="status"
          aria-live="polite"
        >
          <div className="overflow-hidden rounded-box border border-line bg-surface shadow-pop">
            <div className="flex items-start gap-3 px-4 py-3">
              <SquareIcon icon="check-circle" tone="ok" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">
                  {allocateToast.agencyBmFunding
                    ? t("toast.reloadReady")
                    : t("toast.assignedOk")}
                </p>
                <p className="mt-0.5 break-words text-[13px] text-ink-2">
                  <span className="num">{formatMoney(allocateToast.amount)}</span> →{" "}
                  <span className="font-medium text-ink">
                    {allocateToast.accountName}
                  </span>
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setAllocateToast(null)}>
                {tCommon("close")}
              </Button>
            </div>
            <div className="h-1 bg-ok-bg">
              <div className="h-full w-full origin-left animate-[allocateToast_5.6s_linear_forwards] bg-ok-solid" />
            </div>
          </div>
        </div>
      ) : null}

      {agencyBmFunding ? (
        <PaymentsGerenteAccountsSummary
          summary={accountSummary}
          liveCreditTotalUsd={liveCreditTotalUsd}
          liveCashTotalUsd={liveTikTokSummary.cash}
          liveCupoTotalUsd={liveTikTokSummary.cupo}
          liveMetricsLoading={loading}
          lastUpdatedAt={lastUpdatedAt}
          variant="standalone"
        />
      ) : (
        <ClientBalanceComparison
          walletBalance={walletBalance}
          cashTotalUsd={liveTikTokSummary.cash}
          cupoTotalUsd={liveTikTokSummary.cupo}
          cashCount={liveTikTokSummary.cashCount}
          cupoCount={liveTikTokSummary.cupoCount}
          expectedCount={liveTikTokSummary.expectedCount}
          stale={liveTikTokSummary.stale}
          loading={loading}
          error={liveMetricsError}
        />
      )}

      <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <PaymentToolbar
          search={search}
          status={status}
          onSearchChange={setSearch}
          onStatusChange={setStatus}
          sort={sort}
          onSortChange={setSort}
          agencyBmFunding={agencyBmFunding}
        />
        <PaymentsTable
          accounts={filteredAccounts}
          onAllocate={setSelectedAccount}
          onReclaim={setReclaimAccount}
          onTransfer={setTransferAccount}
          onEditTikTokIds={setEditAccount}
          agencyBmFunding={agencyBmFunding}
          clientSelfService={!agencyBmFunding}
          liveMetricsByAdvertiser={metricsByAdvertiser}
          liveMetricsLoading={loading}
          appealStatusByAdvertiser={appealStatus}
          onAppeal={setAppealAccount}
        />
      </div>
      {appealAccount ? (
        <AppealAccountModal
          key={appealAccount.id}
          account={appealAccount}
          onClose={() => setAppealAccount(null)}
          onSubmitted={(advertiserId) =>
            setAppealStatus((prev) => ({ ...prev, [advertiserId]: "pending" }))
          }
        />
      ) : null}
      <AllocateBalanceModal
        account={selectedAccount}
        open={selectedAccount !== null}
        onClose={() => setSelectedAccount(null)}
        agencyBmFunding={agencyBmFunding}
        onFundingChanged={refreshAfterFundingChange}
        walletBalance={walletBalance}
        onAllocated={(info) => {
          setSelectedAccount(null);
          setAllocateToast(info);
        }}
      />
      <ReclaimBalanceModal
        account={reclaimAccount}
        open={reclaimAccount !== null}
        onClose={() => setReclaimAccount(null)}
        allowForceLedger={allowForceLedger}
        onFundingChanged={refreshAfterFundingChange}
      />
      <TransferBalanceModal
        sourceAccount={transferAccount}
        allAccounts={accounts}
        open={transferAccount !== null}
        onClose={() => setTransferAccount(null)}
        agencyBmFunding={agencyBmFunding}
        // Transferir en solo-ledger está prohibido en el servidor.
        allowForceLedger={false}
        clientSelfService={!agencyBmFunding}
        onFundingChanged={refreshAfterFundingChange}
        liveMetricsByAdvertiser={metricsByAdvertiser}
      />
      <EditTikTokIdsModal
        account={editAccount}
        open={editAccount !== null}
        onClose={() => setEditAccount(null)}
      />
    </>
  );
}

function ClientBalanceComparison({
  walletBalance,
  cashTotalUsd,
  cupoTotalUsd,
  cashCount,
  cupoCount,
  expectedCount,
  stale,
  loading,
  error,
}: {
  walletBalance: number;
  cashTotalUsd: number | null;
  cupoTotalUsd: number | null;
  cashCount: number;
  cupoCount: number;
  expectedCount: number;
  stale: boolean;
  loading: boolean;
  error: string | null;
}) {
  const t = useTranslations("payments");
  const accountsWithData = cashCount + cupoCount;
  const partial = accountsWithData > 0 && accountsWithData < expectedCount;

  const tiktokValue =
    loading && cashTotalUsd == null
      ? t("balanceCompare.updating")
      : cashTotalUsd != null
        ? formatMoney(cashTotalUsd)
        : error
          ? t("balanceCompare.unavailable")
          : cupoTotalUsd != null
            ? "$0"
            : t("balanceCompare.noData");

  const tiktokHint = (() => {
    if (cashTotalUsd != null) {
      const coverage = partial
        ? t("balanceCompare.partialCoverage", {
            with: accountsWithData,
            expected: expectedCount,
          })
        : t("balanceCompare.liveCoverage", {
            count: cashCount,
            accounts:
              cashCount === 1
                ? t("balanceCompare.accountOne")
                : t("balanceCompare.accountMany"),
          });
      const notes = [
        coverage,
        cupoTotalUsd != null ? t("balanceCompare.excludesCupo") : null,
        stale || error ? t("balanceCompare.includesStale") : null,
      ];
      return notes.filter(Boolean).join(" · ");
    }

    if (loading) return t("balanceCompare.querying");
    if (error) return t("balanceCompare.queryFailed");
    if (cupoTotalUsd != null) {
      return t("balanceCompare.cupoOnly", {
        amount: formatMoney(cupoTotalUsd),
      });
    }
    if (expectedCount === 0) return t("balanceCompare.noLinked");
    // No es un saldo de cero: es que TikTok no respondió. Decirlo así evita
    // que el cliente crea que se le perdió la plata.
    return t("balanceCompare.noResponse");
  })();

  return (
    <FlushStats
      label={t("balanceCompare.aria")}
      busy={loading}
      className="mb-4 grid-cols-2"
    >
      <FlushStat
        label={t("balanceCompare.holistic")}
        value={formatMoney(walletBalance)}
        sub={t("balanceCompare.holisticHint")}
      />
      <FlushStat
        label={t("balanceCompare.tiktok")}
        value={tiktokValue}
        sub={tiktokHint}
        live
      />
    </FlushStats>
  );
}

