"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, buttonClass } from "@/components/ui/Button";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { EmptyState, Note, ToneBadge, type Tone } from "@/components/ui/PanelKit";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { cn } from "@/lib/cn";
import { useAppFormatter } from "@/lib/i18n/use-app-formatter";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import { AdAccountsEmptyState } from "./AdAccountsEmptyState";
import { ConfigureAdAccountModal } from "./ConfigureAdAccountModal.client";
import { AdAccountLiveBalanceCell } from "./AdAccountLiveBalanceCell.client";
import { useAdAccountLiveMetrics } from "@/features/ad-accounts/hooks/useAdAccountLiveMetrics";
import { buildGastosUrlForAdvertiser } from "@/lib/hecom/gastos-url";
import type { AdAccount, AdAccountStatus } from "@/types/ad-account";

const STATUS_TONE: Record<AdAccountStatus, Tone> = {
  active: "ok",
  pending: "warn",
  disabled: "neutral",
  review: "info",
  archived: "neutral",
};

function StatusBadge({ status }: { status: AdAccountStatus }) {
  const t = useTranslations("adAccounts");
  return (
    <ToneBadge tone={STATUS_TONE[status]} dot>
      {t(`status.${status}`)}
    </ToneBadge>
  );
}

/** ID de cuenta abreviado (v3 «idc») con su botón para copiar el ID completo. */
function CopyIdChip({ id }: { id: string | null | undefined }) {
  const t = useTranslations("adAccounts");
  const [copied, setCopied] = useState(false);
  if (!id) return <span className="text-ink-3">—</span>;

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
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-ink-2">
      <span className={cn("font-mono text-xs tracking-[-0.01em]", copied && "text-ok-fg")} aria-live="polite">
        {copied ? t("table.idCopied") : shortId(id)}
      </span>
      <button
        type="button"
        onClick={copy}
        title={`${t("table.copyId")}: ${id}`}
        aria-label={`${t("table.copyId")} ${id}`}
        className="inline-grid size-6 shrink-0 place-items-center rounded-[6px] text-ink-3 hover:bg-hover hover:text-ink"
      >
        <PanelIcon name={copied ? "check" : "copy"} className="size-[13px]" />
      </button>
    </span>
  );
}

/** Logo de la plataforma (colores de marca, no de tema). */
function PlatformMark({ platform }: { platform: AdAccount["platform"] }) {
  if (platform === "tiktok") {
    return (
      <span
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-ctl bg-[#16161a] text-[9px] font-bold tracking-wide text-white"
        title="TikTok"
      >
        <span className="text-[#25f4ee]">T</span>
        <span className="text-[#fe2c55]">T</span>
      </span>
    );
  }
  if (platform === "meta") {
    return (
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-ctl bg-[#1877f2] text-[10px] font-bold text-white">
        M
      </span>
    );
  }
  return (
    <span className="panel-sqi" aria-hidden>
      {platform === "google" ? "G" : "Ad"}
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

interface AdAccountsTableProps {
  accounts: AdAccount[];
  /** Hecom-scoped accounts: view only (no configure / archive in Ecomdy). */
  readOnly?: boolean;
  /** Nombre de la tabla para lectores de pantalla. */
  caption?: string;
}

export function AdAccountsTable({
  accounts,
  readOnly = false,
  caption,
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
  }: {
    account: AdAccount;
    /** Ancho completo (tarjeta móvil sin saldo en vivo). */
    compact?: boolean;
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
      <Link href={href} className={buttonClass("outline", "sm", compact ? "w-full" : "shrink-0")}>
        <PanelIcon name="chart" />
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
      return <GastosLinkButton account={account} compact={compact} />;
    }

    const secondary = compact ? "outline" : "ghost";
    return (
      <div className={compact ? "grid gap-2" : "flex justify-end gap-1.5"}>
        <Button
          variant={compact ? "primary" : "outline"}
          size="sm"
          className={compact ? "w-full" : undefined}
          onClick={() => setSelectedAccount(account)}
        >
          {t("table.configure")}
        </Button>
        <div className={compact ? "grid grid-cols-2 gap-2" : "contents"}>
          {account.status === "active" ? (
            <Button
              variant={secondary}
              size="sm"
              disabled={loadingActionId === `${account.id}:disable`}
              onClick={() => runAccountAction(account, "disable")}
            >
              {t("table.disable")}
            </Button>
          ) : account.status !== "archived" ? (
            <Button
              variant={secondary}
              size="sm"
              disabled={loadingActionId === `${account.id}:reactivate`}
              onClick={() => runAccountAction(account, "reactivate")}
            >
              {t("table.reactivate")}
            </Button>
          ) : null}
          {account.status !== "archived" ? (
            <Button
              variant={secondary}
              size="sm"
              disabled={loadingActionId === `${account.id}:archive`}
              onClick={() => runAccountAction(account, "archive")}
            >
              {t("table.archive")}
            </Button>
          ) : (
            <Button
              variant={secondary}
              size="sm"
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

  /** Celda de cuenta (v3 «who-cell»): logo, nombre y una línea con BM, etiqueta y nombre externo. */
  function AccountCell({ account }: { account: AdAccount }) {
    const display = parseAccountDisplay(account, defaultName);
    const meta: ReactNode[] = [
      display.bm ? <span key="bm" className="font-mono">{display.bm}</span> : null,
      display.tag ? <span key="tag">{display.tag}</span> : null,
      display.balanceHint ? (
        <span key="usd" className="font-medium text-accent-text">
          {display.balanceHint}
        </span>
      ) : null,
      display.secondary ? <span key="sec">{display.secondary}</span> : null,
    ].filter(Boolean);
    return (
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <PlatformMark platform={account.platform} />
        <div className="grid min-w-0 leading-[1.35]">
          <p className="truncate font-semibold text-ink md:max-w-[34ch]">{display.title}</p>
          {meta.length ? (
            <p className="truncate text-[11px] text-ink-3 md:max-w-[38ch]">
              {meta.map((node, i) => (
                <span key={i}>
                  {i ? " · " : null}
                  {node}
                </span>
              ))}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  function FeeValue({ account }: { account: AdAccount }) {
    const display = parseAccountDisplay(account, defaultName);
    if (display.fee) return <span className="num font-semibold text-ink">{display.fee}%</span>;
    return account.thresholdInfo ? (
      <span className="text-xs font-normal text-ink-2">{account.thresholdInfo}</span>
    ) : (
      <span className="text-ink-3">—</span>
    );
  }

  function liveMetric(account: AdAccount) {
    return account.externalAccountId
      ? live.metricsByAdvertiser[account.externalAccountId]
      : undefined;
  }

  return (
    <div className="space-y-4">
      {readOnly && !isEmpty ? (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-box border border-line bg-field px-3 py-2 text-[13px] leading-snug text-ink-2">
          <p className="flex min-w-0 items-center gap-2">
            <PanelIcon name="activity" className="text-ink-3" />
            <span>
              <span className="font-medium text-ink">{t("live.title")}</span>
              {" · "}
              {t("live.autoRefresh", { seconds: live.pollSeconds })}.
            </span>
          </p>
          {live.error ? (
            <span className="text-xs font-medium text-danger-fg">{live.error}</span>
          ) : (
            <button
              type="button"
              onClick={() => void live.refresh()}
              className="-my-1 inline-flex min-h-8 items-center gap-1.5 rounded-ctl px-2 font-medium text-accent-text hover:bg-hover"
            >
              <PanelIcon name="refresh" />
              {t("live.refreshNow")}
            </button>
          )}
        </div>
      ) : null}

      {message || error ? (
        <Note tone={error ? "danger" : "ok"} icon={error ? "alert" : "check-circle"}>
          {error ?? message}
        </Note>
      ) : null}

      {!isEmpty ? (
        <div className="space-y-3 md:hidden">
          {accounts.map((account) => {
            const display = parseAccountDisplay(account, defaultName);
            return (
              <article
                key={account.id}
                className="rounded-card border border-line bg-surface p-4 shadow-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <AccountCell account={account} />
                  <StatusBadge status={account.status} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px]">
                  <CopyIdChip id={display.accountId} />
                  {display.fee ? (
                    <span className="text-ink-2">
                      {t("table.fee")} <FeeValue account={account} />
                    </span>
                  ) : account.thresholdInfo ? (
                    <FeeValue account={account} />
                  ) : null}
                </div>
                {readOnly ? (
                  // Saldo y "Ver Profit" en una sola fila; el aviso de actualización ya está arriba.
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-box bg-field px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-xs text-ink-3">{t("live.mobileLabel")}</p>
                      <AdAccountLiveBalanceCell
                        advertiserId={account.externalAccountId}
                        metric={liveMetric(account)}
                        loading={live.loading}
                      />
                    </div>
                    <GastosLinkButton account={account} />
                  </div>
                ) : (
                  <>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-[13px]">
                      <div>
                        <dt className="text-xs text-ink-3">{t("table.balance")}</dt>
                        <dd className="num font-semibold text-ink">
                          {formatMoney(account.balance)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-ink-3">{t("table.timezone")}</dt>
                        <dd className="text-ink-2">{account.timezone || "—"}</dd>
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
        <div className="hidden md:block">
          <Table>
            {caption ? <caption className="sr-only">{caption}</caption> : null}
            <TableHeader>
              <tr>
                <TableHead>{t("table.account")}</TableHead>
                <TableHead>{t("table.colId")}</TableHead>
                <TableHead>{t("table.status")}</TableHead>
                {readOnly ? (
                  <>
                    <TableHead className="text-right">{t("live.column")}</TableHead>
                    <TableHead className="text-right">{t("table.fee")}</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead>{t("table.budgets")}</TableHead>
                    <TableHead className="text-right">{t("table.balance")}</TableHead>
                    <TableHead>{t("table.recharge")}</TableHead>
                    <TableHead>{t("table.timezone")}</TableHead>
                  </>
                )}
                <TableHead className="w-px text-right">
                  <span className="sr-only">{t("table.actions")}</span>
                </TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => {
                const display = parseAccountDisplay(account, defaultName);
                return (
                  <TableRow key={account.id}>
                    <TableCell className="max-w-[320px]">
                      <AccountCell account={account} />
                    </TableCell>
                    <TableCell>
                      <CopyIdChip id={display.accountId} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={account.status} />
                    </TableCell>
                    {readOnly ? (
                      <>
                        <TableCell className="text-right">
                          <AdAccountLiveBalanceCell
                            advertiserId={account.externalAccountId}
                            metric={liveMetric(account)}
                            loading={live.loading}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <FeeValue account={account} />
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="text-xs text-ink-2">
                          <div className="num">
                            {t("table.daily", {
                              amount: formatMoney(account.dailyBudget),
                            })}
                          </div>
                          <div className="num text-ink-3">
                            {t("table.monthly", {
                              amount: formatMoney(account.monthlyLimit),
                            })}
                          </div>
                        </TableCell>
                        <TableCell className="num text-right font-semibold">
                          {formatMoney(account.balance)}
                        </TableCell>
                        <TableCell>
                          <ToneBadge tone={account.autoRecharge ? "ok" : "neutral"}>
                            {account.autoRecharge
                              ? t("table.rechargeOn")
                              : t("table.rechargeOff")}
                          </ToneBadge>
                          <div className="mt-1 text-xs text-ink-3">
                            <FeeValue account={account} />
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-ink-2">
                          {account.timezone || "—"}
                        </TableCell>
                      </>
                    )}
                    <TableCell className="text-right">
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
        <section className="rounded-card border border-line bg-surface shadow-card">
          <EmptyState
            icon="search"
            title={t("table.noFilterMatch")}
            description={t("table.noFilterHint")}
          />
        </section>
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
