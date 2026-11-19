"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format-money";
import type { summarizePaymentAccounts } from "@/lib/sort/payment-accounts";
import { FlushStat, FlushStats } from "./PaymentsFlushStats";

type Summary = ReturnType<typeof summarizePaymentAccounts>;

interface PaymentsGerenteAccountsSummaryProps {
  summary: Summary;
  liveCreditTotalUsd: number | null;
  liveCashTotalUsd?: number | null;
  liveCupoTotalUsd?: number | null;
  liveMetricsLoading?: boolean;
  lastUpdatedAt?: string | null;
  /** `band`: franja dentro de una tarjeta (por defecto). `standalone`: suelto sobre la tabla. */
  variant?: "band" | "standalone";
}

export function PaymentsGerenteAccountsSummary({
  summary,
  liveCreditTotalUsd,
  liveCashTotalUsd = null,
  liveCupoTotalUsd = null,
  liveMetricsLoading = false,
  lastUpdatedAt,
  variant = "band",
}: PaymentsGerenteAccountsSummaryProps) {
  const t = useTranslations("payments");
  const creditHint = (() => {
    const parts: string[] = [];
    if (liveCashTotalUsd != null) {
      parts.push(t("gerenteSummary.cash", { amount: formatMoney(liveCashTotalUsd) }));
    }
    if (liveCupoTotalUsd != null) {
      parts.push(t("gerenteSummary.cupo", { amount: formatMoney(liveCupoTotalUsd) }));
    }
    if (parts.length === 0) {
      return t("gerenteSummary.cashCupoDefault");
    }
    return parts.join(" · ");
  })();

  const items = [
    {
      label: t("gerenteSummary.accounts"),
      value: String(summary.totalAccounts),
      hint: t("gerenteSummary.accountsHint", {
        active: summary.activeCount,
        pending: summary.pendingCount,
      }),
      hintMobile: t("gerenteSummary.accountsHintMobile", {
        active: summary.activeCount,
        pending: summary.pendingCount,
      }),
    },
    {
      label: t("gerenteSummary.tiktokLive"),
      value:
        liveMetricsLoading && liveCreditTotalUsd == null
          ? "…"
          : liveCreditTotalUsd != null
            ? formatMoney(liveCreditTotalUsd)
            : "—",
      hint: creditHint,
      hintMobile:
        liveCupoTotalUsd != null
          ? t("gerenteSummary.cupo", { amount: formatMoney(liveCupoTotalUsd) })
          : liveCashTotalUsd != null
            ? t("gerenteSummary.cash", { amount: formatMoney(liveCashTotalUsd) })
            : t("gerenteSummary.cashCupoShort"),
    },
    {
      label: t("gerenteSummary.assigned"),
      value: formatMoney(summary.totalLedgerUsd),
      hint: t("gerenteSummary.assignedHint"),
      hintMobile: t("gerenteSummary.assignedHintMobile"),
      muted: true,
    },
    {
      label: t("gerenteSummary.reclaimable"),
      value: String(summary.reclaimableCount),
      hint:
        summary.reclaimableCount > 0
          ? t("gerenteSummary.reclaimableHint")
          : t("gerenteSummary.reclaimableOk"),
      hintMobile:
        summary.reclaimableCount > 0
          ? t("gerenteSummary.reclaimableHintMobile")
          : t("gerenteSummary.reclaimableOkMobile"),
      warn: summary.reclaimableCount > 0,
    },
  ];

  return (
    <div className={cn(variant === "band" ? "border-b border-line px-4 py-3.5 sm:px-5" : "mb-4")}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <p className="eyebrow">{t("gerenteSummary.pulse")}</p>
        {lastUpdatedAt ? (
          <p className="text-xs text-ink-3">
            {t("gerenteSummary.updated", {
              time: new Date(lastUpdatedAt).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              }),
            })}
          </p>
        ) : null}
      </div>
      <FlushStats
        label={t("gerenteSummary.pulse")}
        busy={liveMetricsLoading}
        className="grid-cols-2 lg:grid-cols-4"
      >
        {items.map((item) => (
          <FlushStat
            key={item.label}
            label={item.label}
            value={item.value}
            valueClassName={item.warn ? "text-accent-text" : item.muted ? "text-ink-2" : undefined}
            sub={
              <>
                <span className="sm:hidden">{item.hintMobile}</span>
                <span className="hidden sm:inline">{item.hint}</span>
              </>
            }
          />
        ))}
      </FlushStats>
    </div>
  );
}
