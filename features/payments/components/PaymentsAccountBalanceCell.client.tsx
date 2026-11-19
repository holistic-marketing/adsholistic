"use client";

import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/format-money";
import type { AdAccountLiveMetricsClient } from "@/features/ad-accounts/hooks/useAdAccountLiveMetrics";
import {
  formatTikTokBudgetLimitLine,
  formatTikTokBudgetLimitParts,
} from "@/features/ad-accounts/lib/format-tiktok-budget-limit";
import { tikTokLiveBalanceLabel } from "@/features/ad-accounts/lib/classify-tiktok-live-balance";

function useFormatUpdatedAgo() {
  const t = useTranslations("payments");
  return (fetchedAt: string | null | undefined): string => {
    if (!fetchedAt) return t("accountBalance.updating");
    const ms = Date.now() - Date.parse(fetchedAt);
    if (!Number.isFinite(ms) || ms < 0) return t("accountBalance.now");
    if (ms < 15_000) return t("accountBalance.now");
    const sec = Math.round(ms / 1000);
    if (sec < 60) return t("accountBalance.agoSeconds", { sec });
    const min = Math.round(sec / 60);
    return t("accountBalance.agoMinutes", { min });
  };
}

interface PaymentsAccountBalanceCellProps {
  ledgerBalance: number;
  advertiserId?: string | null;
  metric?: AdAccountLiveMetricsClient;
  loading?: boolean;
  agencyBmFunding?: boolean;
  compact?: boolean;
}

export function PaymentsAccountBalanceCell({
  ledgerBalance,
  advertiserId,
  metric,
  loading = false,
  agencyBmFunding = false,
  compact = false,
}: PaymentsAccountBalanceCellProps) {
  const t = useTranslations("payments");
  const formatUpdatedAgo = useFormatUpdatedAgo();
  const ledger = Number(ledgerBalance) || 0;
  const hasLedger = ledger > 0.005;

  if (!advertiserId) {
    return (
      <div className={compact ? "min-w-0" : "min-w-[6.5rem]"}>
        {hasLedger ? (
          <>
            <p className="num text-sm font-semibold text-ink">
              {formatMoney(ledger)}
            </p>
            <p className="mt-0.5 text-[11px] text-ink-3">
              {t("accountBalance.assignedHolistic")}
            </p>
          </>
        ) : (
          <span className="text-xs text-ink-3">
            {t("accountBalance.noTikTokId")}
          </span>
        )}
      </div>
    );
  }

  if (loading && !metric) {
    return (
      <span className="animate-pulse text-xs text-ink-3 motion-reduce:animate-none">
        {t("accountBalance.tiktokLoading")}
      </span>
    );
  }

  const creditUsd = metric?.balanceUsd;
  const spendToday = metric?.spendTodayUsd;
  const budgetParts = compact ? formatTikTokBudgetLimitParts(metric) : null;
  const budgetLimitLine = compact ? null : formatTikTokBudgetLimitLine(metric);
  const balanceLabel = tikTokLiveBalanceLabel(metric, { agencyBmFunding });
  const ledgerDiffers =
    creditUsd != null && Math.abs(creditUsd - ledger) > 0.5;

  return (
    <div className={compact ? "min-w-0 w-full" : "min-w-[7.5rem]"}>
      <div
        className={
          compact
            ? "flex items-baseline justify-between gap-3"
            : undefined
        }
      >
        <div className="min-w-0">
          <p
            className={`num font-semibold text-ink ${
              compact ? "text-base" : "text-sm"
            }`}
          >
            {creditUsd != null
              ? formatMoney(creditUsd)
              : hasLedger
                ? formatMoney(ledger)
                : "—"}
          </p>
          <p className="mt-0.5 text-[11px] leading-4 text-ink-3">
            {creditUsd != null
              ? balanceLabel
              : t("accountBalance.assignedHolistic")}
            {metric?.error ? (
              <span className="ml-1 text-warn-fg" title={metric.error}>
                · {t("accountBalance.noData")}
              </span>
            ) : null}
          </p>
        </div>
        {compact && agencyBmFunding && spendToday != null ? (
          <p className="shrink-0 text-right text-[11px] leading-4 text-ink-3">
            {t("accountBalance.spendToday")}
            <br />
            <span className="num font-semibold text-accent-text">
              {formatMoney(spendToday)}
            </span>
          </p>
        ) : null}
      </div>

      {budgetParts?.kind === "unlimited" ? (
        <p className="mt-1.5 text-[11px] leading-4 text-ink-2">
          {t("accountBalance.budgetUnlimited")}
        </p>
      ) : null}
      {budgetParts?.kind === "limited" ? (
        <div className="mt-1.5 grid grid-cols-3 gap-px overflow-hidden rounded-ctl border border-line bg-line text-center">
          <div className="min-w-0 bg-surface px-1.5 py-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-3">
              {t("accountBalance.budgetCap")}
            </p>
            <p className="num mt-0.5 truncate text-[11px] font-semibold text-ink-2">
              {budgetParts.budget}
            </p>
          </div>
          <div className="min-w-0 bg-surface px-1.5 py-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-3">
              {t("accountBalance.budgetSpent")}
            </p>
            <p className="num mt-0.5 truncate text-[11px] font-semibold text-ink-2">
              {budgetParts.used}
            </p>
          </div>
          <div className="min-w-0 bg-surface px-1.5 py-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-3">
              {t("accountBalance.budgetLeft")}
            </p>
            <p className="num mt-0.5 truncate text-[11px] font-semibold text-ink-2">
              {budgetParts.left}
            </p>
          </div>
        </div>
      ) : null}

      {budgetLimitLine ? (
        <p className="num mt-0.5 text-[11px] leading-4 text-ink-2">
          {budgetLimitLine}
        </p>
      ) : null}

      {!compact && agencyBmFunding && spendToday != null ? (
        <p className="mt-0.5 text-[11px] leading-4 text-ink-3">
          {t("accountBalance.spendToday")}{" "}
          <span className="num font-medium text-accent-text">
            {formatMoney(spendToday)}
          </span>
        </p>
      ) : null}

      {hasLedger &&
      creditUsd != null &&
      (agencyBmFunding || ledgerDiffers) ? (
        <p
          className={`num text-[11px] leading-4 text-ink-3 ${
            compact ? "mt-1.5" : "mt-0.5"
          }`}
        >
          {t("accountBalance.holisticPrefix", {
            amount: formatMoney(ledger),
          })}
        </p>
      ) : null}

      {!compact && metric?.fetchedAt ? (
        <p className="mt-0.5 text-[11px] leading-4 text-ink-3">
          {formatUpdatedAgo(metric.fetchedAt)}
        </p>
      ) : null}
    </div>
  );
}
