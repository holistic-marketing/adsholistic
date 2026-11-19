"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { useAppFormatter } from "@/lib/i18n/use-app-formatter";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import { AdAccountsEmptyState } from "./AdAccountsEmptyState";
import { ConfigureAdAccountModal } from "./ConfigureAdAccountModal.client";
import { AdAccountLiveBalanceCell } from "./AdAccountLiveBalanceCell.client";
import { useAdAccountLiveMetrics } from "@/features/ad-accounts/hooks/useAdAccountLiveMetrics";
import { buildGastosUrlForAdvertiser } from "@/lib/hecom/gastos-url";
import type { AdAccount, AdAccountStatus } from "@/types/ad-account";

const statusStyles: Record<AdAccountStatus, string> = {
  active: "bg-subtle text-ok-fg ring-ok-line",
  pending: "bg-field text-accent-text ring-warn-line",
  disabled: "bg-subtle text-ink-2 ring-line",
  review: "bg-field text-info-fg ring-line",
  archived: "bg-subtle text-ink-2 ring-line",
};

const statusDot: Record<AdAccountStatus, string> = {
  active: "bg-ok-solid",
  pending: "bg-accent",
  disabled: "bg-line-strong",
  review: "bg-line-strong",
  archived: "bg-line-strong",
};

function StatusPill({ status }: { status: AdAccountStatus }) {
  const t = useTranslations("adAccounts");
  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-[11px] font-semibold ring-1 ring-inset ${statusStyles[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${statusDot[status]}`} />
      {t(`status.${status}`)}
    </span>
  );
}

function MetaChip({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "fee" | "mono";
}) {
  const cls =
    tone === "fee"
      ? "bg-accent-soft font-semibold text-accent-text"
      : tone === "mono"
        ? "bg-subtle font-mono text-ink-2"
        : "bg-subtle font-medium text-ink-2";
  return (
    <span className={`max-w-full break-words rounded px-1.5 py-0.5 text-[11px] md:text-[10px] ${cls}`}>{children}</span>
  );
}

/** ID de cuenta abreviado; un clic copia el ID completo para pegarlo. */
function CopyIdChip({ id }: { id: string | null | undefined }) {
  const t = useTranslations("adAccounts");
  const [copied, setCopied] = useState(false);
  if (!id) return <MetaChip tone="mono">—</MetaChip>;

  async function copy() {
    try {
      await navigator.clipboard.writeText(id!);
    } catch {
      // Navegadores sin Clipboard API (http, permisos): selección manual.
      const area = document.createElement("textarea");
      area.value = id!;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={`${t("table.copyId")}: ${id}`}
      aria-label={`${t("table.copyId")} ${id}`}
      className={`inline-flex max-w-full items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] transition-colors md:text-[10px] ${
        copied
          ? "bg-subtle text-ok-fg"
          : "bg-subtle text-ink-2 hover:bg-hover hover:text-ink"
      }`}
    >
      <span className="break-all">{copied ? t("table.idCopied") : shortId(id)}</span>
      <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5">
        {copied ? (
          <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <>
            <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
            <path d="M10.5 5.5V3.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" />
          </>
        )}
      </svg>
    </button>
  );
}

function PlatformMark({ platform }: { platform: AdAccount["platform"] }) {
  if (platform === "tiktok") {
    return (
      <span
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#16161a] text-[8px] font-bold tracking-wide text-white"
        title="TikTok"
      >
        <span className="text-[#25f4ee]">T</span>
        <span className="text-[#fe2c55]">T</span>
      </span>
    );
  }
  if (platform === "meta") {
    return (
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#1877f2] text-[9px] font-bold text-white">
        M
      </span>
    );
  }
  if (platform === "google") {
    return (
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-subtle text-[9px] font-bold text-ink-2 ring-1 ring-line">
        G
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-subtle text-[9px] font-bold text-ink-2 ring-1 ring-line">
      Ad
    </span>
  );
}

function shortId(id: string | null | undefined) {
  if (!id) return "—";
  if (id.length <= 14) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function parseAccountDisplay(account: AdAccount, defaultName: string) {
  const raw = (account.name || account.externalAccountName || defaultName).trim();
  const match = raw.match(/^(.*?)\s+(\d+(?:\.\d+)?\s*USD)\s*[-–]\s*(.+)$/i);
  const title = match ? match[1].trim() : raw;
  const balanceHint = match ? match[2].replace(/\s+/g, " ").trim() : null;
  const tag = match ? match[3].trim() : null;

  const secondaryRaw = account.externalAccountName?.trim() ?? "";
  const secondaryDistinct =
    Boolean(secondaryRaw) &&
    secondaryRaw.toLowerCase() !== raw.toLowerCase() &&
    secondaryRaw.toLowerCase() !== title.toLowerCase();

  const feeMatch = account.thresholdInfo?.match(/(\d+(?:\.\d+)?)\s*%/);
  const fee = feeMatch ? feeMatch[1] : null;
  const bm =
    account.externalBusinessId ||
    (account.bcId && account.bcId !== account.externalAccountId
      ? account.bcId
      : null);

  return {
    title,
    tag,
    balanceHint: balanceHint && account.balance === 0 ? balanceHint : null,
    secondary: secondaryDistinct ? secondaryRaw : null,
    accountId: account.externalAccountId || account.bcId,
    fee,
    bm: bm ? (String(bm).startsWith("BM") ? String(bm) : `BM ${bm}`) : null,
  };
}

function Head({ children }: { children: ReactNode }) {
  return (
    <TableHead className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
      {children}
    </TableHead>
  );
}

interface AdAccountsTableProps {
  accounts: AdAccount[];
  /** Hecom-scoped accounts: view only (no configure / archive in Ecomdy). */
  readOnly?: boolean;
}

export function AdAccountsTable({
  accounts,
  readOnly = false,
}: AdAccountsTableProps) {
  const t = useTranslations("adAccounts");
  const { formatMoney } = useAppFormatter();
  const router = useRouter();
  // Siempre: saldo TikTok en vivo (cliente y gerente). Antes solo readOnly.
  const live = useAdAccountLiveMetrics(true);
  const [selectedAccount, setSelectedAccount] = useState<AdAccount | null>(null);
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isEmpty = accounts.length === 0;
  const defaultName = t("table.defaultName");

  async function runAccountAction(
    account: AdAccount,
    action: "disable" | "reactivate" | "archive",
  ) {
    setLoadingActionId(`${account.id}:${action}`);
    setError(null);
    setMessage(null);
    try {
      await apiClient(`/api/ad-accounts/${account.id}/${action}`, {
        method: "POST",
      });
      setMessage(
        action === "archive"
          ? t("table.archivedMsg")
          : action === "disable"
            ? t("table.disabledMsg")
            : t("table.reactivatedMsg"),
      );
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : t("table.actionError"),
      );
    } finally {
      setLoadingActionId(null);
    }
  }

  function GastosLinkButton({
    account,
    compact = false,
    inline = false,
  }: {
    account: AdAccount;
    compact?: boolean;
    /** Botón chico al lado del saldo (tarjeta móvil). */
    inline?: boolean;
  }) {
    const advertiserId = account.externalAccountId?.trim();
    if (!advertiserId) return null;
    const bm =
      account.externalBusinessId?.replace(/^BM\s*/i, "") ??
      account.bcId?.replace(/^BM\s*/i, "") ??
      null;
    const href = buildGastosUrlForAdvertiser({
      advertiserId,
      bmBucket: bm,
      days: 14,
    });
    return (
      <Link
        href={href}
        className={
          inline
            ? "inline-flex h-9 shrink-0 items-center rounded-lg border border-accent/30 bg-surface px-3 text-[12px] font-semibold text-accent-text transition hover:bg-accent-soft"
            : compact
            ? "inline-flex h-10 w-full items-center justify-center rounded-lg border border-accent/30 bg-field px-3 text-[12px] font-semibold text-accent-text transition hover:bg-accent-soft"
            : "inline-flex h-8 items-center rounded-lg border border-accent/30 bg-field px-3 text-[12px] font-semibold text-accent-text transition hover:bg-accent-soft"
        }
      >
        {t("table.viewProfit")}
      </Link>
    );
  }

  function AccountActions({
    account,
    compact = false,
  }: {
    account: AdAccount;
    compact?: boolean;
  }) {
    if (readOnly) {
      return (
        <div className={compact ? "flex flex-col gap-2" : "flex flex-col items-start gap-2"}>
          <GastosLinkButton account={account} compact={compact} />
          <p className="text-[11px] font-normal uppercase tracking-[0.08em] text-ink-3 md:text-[10px]">
            {t("table.pollHint", { seconds: live.pollSeconds })}
          </p>
        </div>
      );
    }

    return (
      <div className={compact ? "flex flex-col gap-2" : "flex flex-wrap gap-1.5"}>
        <Button
          variant={compact ? undefined : "ghost"}
          size="sm"
          className={
            compact
              ? "h-11 w-full rounded-lg bg-accent text-[13px] font-medium hover:bg-accent-btn-hover"
              : "text-accent-text"
          }
          onClick={() => setSelectedAccount(account)}
        >
          {t("table.configure")}
        </Button>
        <div className={compact ? "grid grid-cols-2 gap-2" : "contents"}>
          {account.status === "active" ? (
            <Button
              variant="ghost"
              size="sm"
              className={
                compact
                  ? "h-10 rounded-lg border border-[rgb(20_18_16_/_0.1)]"
                  : undefined
              }
              disabled={loadingActionId === `${account.id}:disable`}
              onClick={() => runAccountAction(account, "disable")}
            >
              {t("table.disable")}
            </Button>
          ) : account.status !== "archived" ? (
            <Button
              variant="ghost"
              size="sm"
              className={
                compact
                  ? "h-10 rounded-lg border border-[rgb(20_18_16_/_0.1)]"
                  : undefined
              }
              disabled={loadingActionId === `${account.id}:reactivate`}
              onClick={() => runAccountAction(account, "reactivate")}
            >
              {t("table.reactivate")}
            </Button>
          ) : null}
          {account.status !== "archived" ? (
            <Button
              variant="ghost"
              size="sm"
              className={
                compact
                  ? "h-10 rounded-lg border border-[rgb(20_18_16_/_0.1)]"
                  : undefined
              }
              disabled={loadingActionId === `${account.id}:archive`}
              onClick={() => runAccountAction(account, "archive")}
            >
              {t("table.archive")}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className={
                compact
                  ? "h-10 rounded-lg border border-[rgb(20_18_16_/_0.1)]"
                  : undefined
              }
              disabled={loadingActionId === `${account.id}:reactivate`}
              onClick={() => runAccountAction(account, "reactivate")}
            >
              {t("table.restore")}
            </Button>
          )}
        </div>
      </div>
    );
  }

  function AccountCell({ account }: { account: AdAccount }) {
    const display = parseAccountDisplay(account, defaultName);
    return (
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <PlatformMark platform={account.platform} />
        <div className="min-w-0">
          <p className="line-clamp-2 break-words text-[14px] font-semibold tracking-[-0.02em] text-ink md:truncate">
            {display.title}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {display.tag ? <MetaChip>{display.tag}</MetaChip> : null}
            {display.balanceHint ? (
              <MetaChip tone="fee">{display.balanceHint}</MetaChip>
            ) : null}
            {display.secondary ? (
              <span className="min-w-0 max-w-full truncate text-[11px] text-ink-3">
                {display.secondary}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {readOnly && !isEmpty ? (
        <div className="mx-3 mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-[rgb(20_18_16_/_0.08)] bg-field px-3 py-2 text-[12px] leading-5 text-ink-2 md:mx-4 md:mb-3 md:px-4 md:py-3">
          <p>
            <span className="font-semibold text-ink">{t("live.title")}</span>
            {" · "}
            {t("live.autoRefresh", { seconds: live.pollSeconds })}.
          </p>
          {live.error ? (
            <span className="text-[11px] font-medium text-danger-fg">{live.error}</span>
          ) : (
            <button
              type="button"
              onClick={() => void live.refresh()}
              className="-mx-2 inline-flex min-h-9 items-center px-2 text-[12px] font-semibold text-accent-text hover:underline md:min-h-0 md:text-[11px]"
            >
              {t("live.refreshNow")}
            </button>
          )}
        </div>
      ) : null}

      {(message || error) && (
        <div
          className={`mx-4 mb-3 rounded-lg border px-4 py-3 text-[13px] ${
            error
              ? "border-danger-line bg-danger-bg text-danger-fg"
              : "border-ok-line bg-ok-bg text-ok-fg"
          }`}
          role="status"
        >
          {error ?? message}
        </div>
      )}

      {!isEmpty ? (
        <div className="space-y-2.5 px-3 pb-4 pt-1 md:hidden">
          {accounts.map((account) => {
            const display = parseAccountDisplay(account, defaultName);
            return (
              <article
                key={account.id}
                className="rounded-box border border-[rgb(20_18_16_/_0.08)] bg-surface p-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <AccountCell account={account} />
                  <StatusPill status={account.status} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <CopyIdChip id={display.accountId} />
                  {display.bm ? <MetaChip>{display.bm}</MetaChip> : null}
                  {display.fee ? (
                    <MetaChip tone="fee">
                      {t("table.fee")} {display.fee}%
                    </MetaChip>
                  ) : account.thresholdInfo ? (
                    <MetaChip>{account.thresholdInfo}</MetaChip>
                  ) : null}
                </div>
                {readOnly ? (
                  // Saldo y "Ver Profit" en una sola fila; el aviso de 45 s ya está arriba.
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-field px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[11px] text-ink-3">{t("live.mobileLabel")}</p>
                      <AdAccountLiveBalanceCell
                        advertiserId={account.externalAccountId}
                        metric={
                          account.externalAccountId
                            ? live.metricsByAdvertiser[account.externalAccountId]
                            : undefined
                        }
                        loading={live.loading}
                      />
                    </div>
                    <GastosLinkButton account={account} inline />
                  </div>
                ) : (
                  <>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                      <div>
                        <dt className="text-ink-3">{t("table.balance")}</dt>
                        <dd className="tabular-nums text-ink">
                          {formatMoney(account.balance)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-ink-3">{t("table.timezone")}</dt>
                        <dd className="text-ink-2">
                          {account.timezone || "—"}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-3">
                      <AccountActions account={account} compact />
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </div>
      ) : null}

      {!isEmpty ? (
        <div className="hidden md:block overflow-x-auto">
          <Table embedded className="rounded-none">
            <TableHeader>
              <TableRow className="border-b border-[rgb(20_18_16_/_0.07)] bg-field hover:bg-field">
                <Head>{t("table.account")}</Head>
                <Head>{t("table.colId")}</Head>
                <Head>{t("table.status")}</Head>
                {readOnly ? (
                  <>
                    <Head>{t("live.column")}</Head>
                    <Head>{t("table.fee")}</Head>
                  </>
                ) : (
                  <>
                    <Head>{t("table.budgets")}</Head>
                    <Head>{t("table.balance")}</Head>
                    <Head>{t("table.recharge")}</Head>
                  </>
                )}
                {!readOnly ? <Head>{t("table.timezone")}</Head> : null}
                <Head>{t("table.actions")}</Head>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => {
                const display = parseAccountDisplay(account, defaultName);
                return (
                    <TableRow
                      key={account.id}
                      className="border-b border-[rgb(20_18_16_/_0.05)] transition-colors hover:bg-field"
                    >
                      <TableCell className="max-w-[280px]">
                        <AccountCell account={account} />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          <CopyIdChip id={display.accountId} />
                          {display.bm ? <MetaChip>{display.bm}</MetaChip> : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusPill status={account.status} />
                      </TableCell>
                      {readOnly ? (
                        <>
                          <TableCell>
                            <AdAccountLiveBalanceCell
                              advertiserId={account.externalAccountId}
                              metric={
                                account.externalAccountId
                                  ? live.metricsByAdvertiser[
                                      account.externalAccountId
                                    ]
                                  : undefined
                              }
                              loading={live.loading}
                            />
                          </TableCell>
                          <TableCell>
                            {display.fee ? (
                              <MetaChip tone="fee">
                                {t("table.fee")} {display.fee}%
                              </MetaChip>
                            ) : (
                              <span className="text-[12px] text-ink-2">
                                {account.thresholdInfo}
                              </span>
                            )}
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-[12px] tabular-nums text-ink-2">
                            <div>
                              {t("table.daily", {
                                amount: formatMoney(account.dailyBudget),
                              })}
                            </div>
                            <div className="text-ink-3">
                              {t("table.monthly", {
                                amount: formatMoney(account.monthlyLimit),
                              })}
                            </div>
                          </TableCell>
                          <TableCell className="text-[14px] font-semibold tabular-nums tracking-[-0.02em] text-ink">
                            {formatMoney(account.balance)}
                          </TableCell>
                          <TableCell>
                            <span
                              className={
                                account.autoRecharge
                                  ? "text-[12px] font-semibold text-ok-fg"
                                  : "text-[12px] text-ink-2"
                              }
                            >
                              {account.autoRecharge
                                ? t("table.rechargeOn")
                                : t("table.rechargeOff")}
                            </span>
                            <div className="mt-1">
                              {display.fee ? (
                                <MetaChip tone="fee">
                                  {t("table.fee")} {display.fee}%
                                </MetaChip>
                              ) : (
                                <span className="text-[11px] text-ink-3">
                                  {account.thresholdInfo}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-[12px] text-ink-2">
                            {account.timezone || "—"}
                          </TableCell>
                        </>
                      )}
                      <TableCell>
                        <AccountActions account={account} />
                      </TableCell>
                    </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {isEmpty && !readOnly ? <AdAccountsEmptyState /> : null}
      {isEmpty && readOnly ? (
        <div className="px-6 py-12 text-center">
          <p className="text-[14px] font-medium text-ink">
            {t("table.noFilterMatch")}
          </p>
          <p className="mt-1 text-[13px] text-ink-2">
            {t("table.noFilterHint")}
          </p>
        </div>
      ) : null}
      {selectedAccount && !readOnly ? (
        <ConfigureAdAccountModal
          account={selectedAccount}
          onClose={() => setSelectedAccount(null)}
        />
      ) : null}
    </div>
  );
}
