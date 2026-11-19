"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { Button, buttonClass } from "@/components/ui/Button";
import { Note, ToneBadge, type Tone } from "@/components/ui/PanelKit";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import { useAppFormatter } from "@/lib/i18n/use-app-formatter";
import { PaymentsEmptyState } from "./PaymentsEmptyState";
import { PaymentsAccountBalanceCell } from "./PaymentsAccountBalanceCell.client";
import type { AdAccountLiveMetricsClient } from "@/features/ad-accounts/hooks/useAdAccountLiveMetrics";
import type { AdAccountStatus } from "@/types/ad-account";
import type { PaymentAccountAllocation } from "@/types/payment";
import { appealIsOpen, type AppealStatus } from "@/lib/appeals/account-appeals.shared";

interface PaymentsTableProps {
  accounts: PaymentAccountAllocation[];
  onAllocate?: (account: PaymentAccountAllocation) => void;
  onReclaim?: (account: PaymentAccountAllocation) => void;
  onTransfer?: (account: PaymentAccountAllocation) => void;
  onEditTikTokIds?: (account: PaymentAccountAllocation) => void;
  /** Modo gerente BM: copy “Recargar” en vez de “Asignar”. */
  agencyBmFunding?: boolean;
  /** Hint de autoservicio para clientes (no gerente). */
  clientSelfService?: boolean;
  liveMetricsByAdvertiser?: Record<string, AdAccountLiveMetricsClient>;
  liveMetricsLoading?: boolean;
  /** Última apelación por advertiser (cuentas suspendidas). */
  appealStatusByAdvertiser?: Record<string, AppealStatus>;
  onAppeal?: (account: PaymentAccountAllocation) => void;
}

interface AllocationResponse {
  ok: boolean;
  ledgerJournalId: string;
}

const STATUS_KEYS = new Set<AdAccountStatus>([
  "active",
  "pending",
  "disabled",
  "review",
  "archived",
]);

function isReclaimableSuspended(account: PaymentAccountAllocation): boolean {
  return account.status === "disabled" && Number(account.balance) > 0;
}

function hasTransferableBalance(
  account: PaymentAccountAllocation,
  liveUsd: number | null | undefined,
): boolean {
  if (liveUsd != null) return liveUsd > 0.005;
  return Number(account.balance) > 0;
}

const APPEAL_TONE: Record<AppealStatus, Tone> = {
  pending: "ok",
  sent: "ok",
  approved: "ok",
  rejected: "danger",
};

function statusTone(status: string): Tone {
  if (status === "disabled") return "danger";
  if (status === "active") return "ok";
  return "warn";
}

/* Celdas de la tabla v3: 59 px de alto, línea fina entre filas. */
const TH = "h-10 whitespace-nowrap border-b border-line px-2 text-left text-sm font-medium text-ink";
const TD = "h-[59px] border-b border-line px-2 py-2 align-middle text-sm text-ink";
/* Enlace secundario de la fila (cambiar el ID de TikTok). */
const LINK_BTN =
  "text-xs font-medium text-ink-3 underline decoration-transparent underline-offset-2 hover:text-ink hover:decoration-current";

export function PaymentsTable({
  accounts,
  onAllocate,
  onReclaim,
  onTransfer,
  onEditTikTokIds,
  agencyBmFunding = false,
  clientSelfService = false,
  liveMetricsByAdvertiser,
  liveMetricsLoading = false,
  appealStatusByAdvertiser,
  onAppeal,
}: PaymentsTableProps) {
  const tAppeal = useTranslations("appeals");
  const router = useRouter();
  const t = useTranslations("payments");
  const tAd = useTranslations("adAccounts");
  const { formatMoney } = useAppFormatter();
  const [loadingAccountId, setLoadingAccountId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isEmpty = accounts.length === 0;
  const actionLabel = agencyBmFunding
    ? t("assignmentTable.reload")
    : t("assignmentTable.assign");
  const actionLabelLong = agencyBmFunding
    ? t("assignmentTable.reloadBalance")
    : t("assignmentTable.assignBalance");
  const actionLoading = agencyBmFunding
    ? t("assignmentTable.reloading")
    : t("assignmentTable.assigning");
  const balanceColumnLabel = agencyBmFunding
    ? t("assignmentTable.tiktokLive")
    : t("assignmentTable.balanceQuota");

  function statusLabel(status: string): string {
    if (STATUS_KEYS.has(status as AdAccountStatus)) {
      return tAd(`status.${status as AdAccountStatus}`);
    }
    return status;
  }

  function renderBalanceCell(account: PaymentAccountAllocation, compact = false) {
    const advertiserId = account.externalAccountId?.trim();
    const metric = advertiserId ? liveMetricsByAdvertiser?.[advertiserId] : undefined;

    return (
      <PaymentsAccountBalanceCell
        ledgerBalance={account.balance}
        advertiserId={advertiserId}
        metric={metric}
        loading={liveMetricsLoading}
        agencyBmFunding={agencyBmFunding}
        compact={compact}
      />
    );
  }

  async function handleAllocate(account: PaymentAccountAllocation) {
    const rawAmount = window.prompt(
      t("assignmentHints.promptAmount", { name: account.name }),
      "100",
    );
    if (!rawAmount) return;

    const amount = Number.parseFloat(rawAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(t("assignmentHints.errInvalid"));
      return;
    }

    setLoadingAccountId(account.id);
    setMessage(null);
    setError(null);

    try {
      await apiClient<AllocationResponse>("/api/payments/allocations", {
        method: "POST",
        body: JSON.stringify({
          adAccountId: account.id,
          amount,
        }),
      });
      setMessage(t("assignmentHints.successLedger", { amount: formatMoney(amount) }));
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : t("assignmentHints.errAllocate"),
      );
    } finally {
      setLoadingAccountId(null);
    }
  }

  function runAllocate(account: PaymentAccountAllocation) {
    if (onAllocate) onAllocate(account);
    else void handleAllocate(account);
  }

  function runReclaim(account: PaymentAccountAllocation) {
    if (onReclaim) onReclaim(account);
  }

  function runTransfer(account: PaymentAccountAllocation) {
    if (onTransfer) onTransfer(account);
  }

  function appealStatusOf(account: PaymentAccountAllocation): AppealStatus | null {
    const adv = account.externalAccountId?.trim();
    return adv ? (appealStatusByAdvertiser?.[adv] ?? null) : null;
  }

  function renderAppealChip(account: PaymentAccountAllocation) {
    const status = appealStatusOf(account);
    if (!status) return null;
    return (
      <ToneBadge tone={APPEAL_TONE[status]} dot={status !== "rejected"}>
        {tAppeal(`chip.${status}`)}
      </ToneBadge>
    );
  }

  function renderAppealAction(account: PaymentAccountAllocation, mobile: boolean) {
    if (!onAppeal || account.status !== "disabled") return null;
    const status = appealStatusOf(account);
    if (appealIsOpen(status) || status === "approved") return null;
    return (
      <Button
        variant="outline"
        size={mobile ? "md" : "sm"}
        className={mobile ? "w-full" : undefined}
        onClick={() => onAppeal(account)}
      >
        {status === "rejected" ? tAppeal("appealAgain") : tAppeal("appealCta")}
      </Button>
    );
  }

  function renderStatus(account: PaymentAccountAllocation) {
    return (
      <ToneBadge tone={statusTone(account.status)} dot>
        {statusLabel(account.status)}
      </ToneBadge>
    );
  }

  function renderBmLabel(account: PaymentAccountAllocation) {
    return account.bmLabel ? (
      <ToneBadge tone="info" className="h-5 px-1.5 text-[11px]">
        {account.bmLabel}
      </ToneBadge>
    ) : null;
  }

  function renderAdvertiserId(account: PaymentAccountAllocation, className?: string) {
    return (
      <span className={cn("font-mono text-[11px] text-ink-3", className)}>
        adv{" "}
        {account.externalAccountId?.trim() ||
          t("assignmentTable.noTikTokId")}
      </span>
    );
  }

  function renderMobileActions(account: PaymentAccountAllocation) {
    const reclaimable = isReclaimableSuspended(account);
    const advertiserId = account.externalAccountId?.trim();
    const liveUsd = advertiserId
      ? liveMetricsByAdvertiser?.[advertiserId]?.balanceUsd
      : undefined;
    const transferable = hasTransferableBalance(account, liveUsd) && Boolean(onTransfer);
    const hint = reclaimable
      ? transferable
        ? clientSelfService
          ? t("assignmentHints.transferClient")
          : t("assignmentHints.transferStaff")
        : t("assignmentHints.suspended")
      : !transferable && onTransfer
        ? t("assignmentHints.noBalanceMobile")
        : null;

    return (
      <div className="mt-3 space-y-2">
        {renderAppealAction(account, true)}
        <div className={transferable ? "grid grid-cols-2 gap-2" : "grid grid-cols-1"}>
          {transferable ? (
            <button
              type="button"
              className={buttonClass("outline", "md", "w-full whitespace-normal")}
              onClick={() => runTransfer(account)}
            >
              {t("assignmentTable.transfer")}
            </button>
          ) : null}
          {reclaimable ? (
            <button
              type="button"
              className={buttonClass("outline", "md", "w-full whitespace-normal")}
              onClick={() => runReclaim(account)}
            >
              {t("assignmentTable.reclaim")}
            </button>
          ) : (
            <Button
              className="w-full"
              disabled={loadingAccountId === account.id}
              onClick={() => runAllocate(account)}
            >
              {loadingAccountId === account.id
                ? actionLoading
                : transferable
                  ? actionLabel
                  : actionLabelLong}
            </Button>
          )}
        </div>
        {hint ? <p className="text-xs leading-snug text-ink-3">{hint}</p> : null}
        {onEditTikTokIds ? (
          <button
            type="button"
            className={cn(LINK_BTN, "inline-flex min-h-9 items-center")}
            onClick={() => onEditTikTokIds(account)}
          >
            {t("assignmentTable.editTikTokId")}
          </button>
        ) : null}
      </div>
    );
  }

  function renderActions(account: PaymentAccountAllocation) {
    const reclaimable = isReclaimableSuspended(account);
    const advertiserId = account.externalAccountId?.trim();
    const liveUsd = advertiserId
      ? liveMetricsByAdvertiser?.[advertiserId]?.balanceUsd
      : undefined;
    const transferable = hasTransferableBalance(account, liveUsd);

    return (
      <div className="flex flex-col items-end gap-1.5">
        <div className="flex flex-wrap justify-end gap-1.5">
          {renderAppealAction(account, false)}
          {transferable && onTransfer ? (
            <Button variant="outline" size="sm" onClick={() => runTransfer(account)}>
              {t("assignmentTable.transfer")}
            </Button>
          ) : null}
          {reclaimable ? (
            <Button variant="outline" size="sm" onClick={() => runReclaim(account)}>
              {t("assignmentTable.reclaim")}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={loadingAccountId === account.id}
              onClick={() => runAllocate(account)}
            >
              <PanelIcon name="plus" />
              {loadingAccountId === account.id ? actionLoading : actionLabel}
            </Button>
          )}
        </div>

        {reclaimable ? (
          <p className="max-w-[16rem] text-right text-xs leading-snug text-ink-3">
            {transferable
              ? clientSelfService
                ? t("assignmentHints.transferClient")
                : t("assignmentHints.transferStaff")
              : t("assignmentHints.suspended")}
          </p>
        ) : !transferable && onTransfer ? (
          <p className="max-w-[16rem] text-right text-xs leading-snug text-ink-3">
            {t("assignmentHints.noBalance")}
          </p>
        ) : null}

        {onEditTikTokIds ? (
          <button type="button" className={LINK_BTN} onClick={() => onEditTikTokIds(account)}>
            {t("assignmentTable.editTikTokId")}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      {message || error ? (
        <div className="px-4 pt-3 sm:px-5" role="status">
          <Note tone={error ? "danger" : "ok"} icon={error ? "alert" : "check-circle"}>
            {error ?? message}
          </Note>
        </div>
      ) : null}

      {!isEmpty ? (
        <ul className="md:hidden">
          {accounts.map((account) => (
            <li
              key={account.id}
              className={cn(
                "border-b border-line px-4 py-3.5 last:border-b-0",
                isReclaimableSuspended(account) && "bg-accent-soft",
              )}
            >
              <p className="break-words font-semibold leading-snug text-ink">
                {account.name}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {renderBmLabel(account)}
                {renderStatus(account)}
                {renderAppealChip(account)}
                {/* Débito apagado ya lo dice la línea de auto-recarga: solo marcar cuando está activo. */}
                {!agencyBmFunding && account.autoRecharge ? (
                  <ToneBadge tone="ok">{t("assignmentTable.autoDebitOn")}</ToneBadge>
                ) : null}
              </div>
              {renderAdvertiserId(account, "mt-1 block break-all")}

              <div className="mt-3 rounded-box border border-line bg-field px-3 py-2.5">
                {renderBalanceCell(account, true)}
                {!agencyBmFunding && account.thresholdInfo ? (
                  <p className="mt-1 text-xs text-ink-3">{account.thresholdInfo}</p>
                ) : null}
              </div>
              {renderMobileActions(account)}
            </li>
          ))}
        </ul>
      ) : null}

      {!isEmpty ? (
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr>
                <th scope="col" className={cn(TH, "pl-4 sm:pl-5")}>
                  {t("assignmentTable.account")}
                </th>
                <th scope="col" className={TH}>
                  {t("assignmentTable.status")}
                </th>
                <th scope="col" className={cn(TH, "text-right")}>
                  {balanceColumnLabel}
                </th>
                <th scope="col" className={cn(TH, "pr-4 text-right sm:pr-5")}>
                  {t("assignmentTable.action")}
                </th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr
                  key={account.id}
                  className={cn(
                    "transition-colors [&:last-child>td]:border-b-0",
                    isReclaimableSuspended(account)
                      ? "bg-accent-soft"
                      : "hover:bg-field",
                  )}
                >
                  <td className={cn(TD, "pl-4 sm:pl-5")}>
                    <div className="min-w-0 max-w-[18rem]">
                      <p className="truncate font-semibold" title={account.name}>
                        {account.name}
                      </p>
                      <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1.5">
                        {renderBmLabel(account)}
                        {renderAdvertiserId(account, "min-w-0 truncate")}
                      </div>
                      {!agencyBmFunding ? (
                        <p className="mt-1 text-xs text-ink-3">
                          {account.autoRecharge
                            ? t("assignmentTable.autoDebitOn")
                            : t("assignmentTable.autoDebitOff")}
                          {account.thresholdInfo
                            ? ` · ${account.thresholdInfo}`
                            : ""}
                        </p>
                      ) : null}
                    </div>
                  </td>
                  <td className={TD}>
                    <div className="flex flex-col items-start gap-1">
                      {renderStatus(account)}
                      {renderAppealChip(account)}
                    </div>
                  </td>
                  <td className={cn(TD, "text-right")}>{renderBalanceCell(account)}</td>
                  <td className={cn(TD, "pr-4 sm:pr-5")}>{renderActions(account)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {isEmpty && <PaymentsEmptyState />}
    </div>
  );
}
