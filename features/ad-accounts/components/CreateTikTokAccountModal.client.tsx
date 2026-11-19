"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { DashboardModalShell } from "@/components/ui/DashboardModalShell.client";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { Note, ToneBadge } from "@/components/ui/PanelKit";
import { routes } from "@/config/routes";
import { dispatchAdAccountsUpdated } from "@/lib/events/modal-events";
import {
  DEFAULT_TIKTOK_CREATE_BM,
  TIKTOK_SELF_SERVE_ACCOUNT_LIMIT,
  TIKTOK_SELF_SERVE_CREATE_MAINTENANCE,
} from "@/lib/integrations/tiktok/bc-create-profiles";
import { TikTokMark } from "./platform-marks";

interface CreateTikTokAccountModalProps {
  open: boolean;
  onClose: () => void;
  clienteName: string;
  currentAccountCount: number;
  /** Cupo del cliente; puede estar ampliado por gerencia. */
  accountLimit?: number;
}

type CreateOk = {
  ok: true;
  needWhatsApp: false;
  advertiserId: string;
  advertiserName: string;
  bmBucket: string;
  accountCountAfter: number;
};

type CreateNeedWa = {
  ok: false;
  needWhatsApp: true;
  accountCount: number;
  limit: number;
  whatsappUrl: string;
  message: string;
};

type QuotaPayload = {
  used: number;
  limit: number;
};

export function CreateTikTokAccountModal(props: CreateTikTokAccountModalProps) {
  return props.open ? <CreateTikTokAccountModalContent key={props.clienteName} {...props}/> : null;
}

function CreateTikTokAccountModalContent({
  onClose,
  clienteName,
  currentAccountCount,
  accountLimit = TIKTOK_SELF_SERVE_ACCOUNT_LIMIT,
}: CreateTikTokAccountModalProps) {
  const t = useTranslations("adAccounts.tiktokCreate");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [quotaLoading, setQuotaLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);
  const [success, setSuccess] = useState<CreateOk | null>(null);
  const [liveUsed, setLiveUsed] = useState(currentAccountCount);
  const [liveLimit, setLiveLimit] = useState(accountLimit);

  const maintenance = TIKTOK_SELF_SERVE_CREATE_MAINTENANCE;
  const atLimit = liveUsed >= liveLimit;
  const remaining = Math.max(0, liveLimit - liveUsed);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(routes.api.adAccountsTikTokCreate, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) return;
        const json = (await response.json()) as QuotaPayload | { error?: string };
        if (cancelled || !("limit" in json) || !Number.isFinite(json.limit)) {
          return;
        }
        setLiveUsed(Number(json.used) || 0);
        setLiveLimit(Number(json.limit) || TIKTOK_SELF_SERVE_ACCOUNT_LIMIT);
      } catch {
        // Props del SSR como fallback.
      } finally {
        if (!cancelled) setQuotaLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleClose = useCallback(() => {
    setLoading(false);
    setQuotaLoading(false);
    setError(null);
    setWhatsappUrl(null);
    setSuccess(null);
    onClose();
  }, [onClose]);

  async function handleCreate() {
    if (maintenance) return;
    setLoading(true);
    setError(null);
    setWhatsappUrl(null);
    setSuccess(null);
    try {
      const response = await fetch(routes.api.adAccountsTikTokCreate, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bmBucket: DEFAULT_TIKTOK_CREATE_BM }),
      });
      const json = (await response.json()) as
        | CreateOk
        | CreateNeedWa
        | { error?: string };

      if (
        "needWhatsApp" in json &&
        json.needWhatsApp &&
        "whatsappUrl" in json
      ) {
        setWhatsappUrl(json.whatsappUrl);
        setError(json.message || t("limitReached"));
        if (Number.isFinite(json.accountCount)) setLiveUsed(json.accountCount);
        if (Number.isFinite(json.limit)) setLiveLimit(json.limit);
        return;
      }

      if (!response.ok) {
        setError(("error" in json && json.error) || t("errGeneric"));
        return;
      }

      if ("ok" in json && json.ok) {
        setSuccess(json);
        setLiveUsed(json.accountCountAfter);
        router.refresh();
        dispatchAdAccountsUpdated();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errGeneric"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardModalShell open onClose={handleClose}>
      <div className="space-y-4">
        <div>
          <h2
            id="create-tiktok-account-title"
            className="text-lg font-semibold tracking-[-0.015em] text-ink"
          >
            {maintenance ? t("maintenanceTitle") : t("title")}
          </h2>
          <p className="mt-1 text-[13px] leading-5 text-ink-2">
            {maintenance
              ? t("maintenanceSubtitle", { name: clienteName })
              : t("subtitle", { name: clienteName })}
          </p>
        </div>

        {maintenance ? (
          <Note tone="warn" icon="clock" title={t("maintenanceBadge")}>
            {t("maintenanceBody")}
          </Note>
        ) : (
          <>
            <div className="rounded-box border border-line bg-field p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <TikTokMark />
                  <div className="min-w-0">
                    <p className="text-xs text-ink-3">{t("bmLabel")}</p>
                    <p className="text-sm font-semibold text-ink">{t("bmName")}</p>
                    <p className="text-xs text-ink-2">{t("bmHint")}</p>
                  </div>
                </div>
                <ToneBadge tone="ok">USD</ToneBadge>
              </div>
              <p className="mt-3 border-t border-line pt-3 text-xs text-ink-2 tabular-nums">
                {quotaLoading
                  ? tCommon("loading")
                  : t("quota", {
                      used: liveUsed,
                      limit: liveLimit,
                      remaining,
                    })}
              </p>
            </div>

            {success ? (
              <Note tone="ok" icon="check-circle" title={t("successTitle")}>
                <p>{success.advertiserName}</p>
                <p className="break-all font-mono text-xs">{success.advertiserId}</p>
                <p className="mt-1.5 text-xs">{t("successHint")}</p>
              </Note>
            ) : null}

            {error ? <Note tone="warn">{error}</Note> : null}
          </>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={handleClose}>
            {maintenance || success ? tCommon("close") : tCommon("cancel")}
          </Button>
          {maintenance ? null : !success && (whatsappUrl || atLimit) ? (
            <a
              href={
                whatsappUrl ||
                `https://wa.me/51933484150?text=${encodeURIComponent(
                  t("whatsappPrefill", { name: clienteName }),
                )}`
              }
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-ctl bg-[#25D366] px-3.5 text-sm font-medium text-white shadow-ctl hover:brightness-105"
            >
              <PanelIcon name="chat" />
              {t("whatsappCta")}
            </a>
          ) : success ? (
            <Button
              type="button"
              onClick={() => {
                handleClose();
                router.push(routes.payments);
              }}
            >
              <PanelIcon name="send" />
              {t("goPayments")}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={loading || quotaLoading}
              onClick={() => void handleCreate()}
            >
              <PanelIcon name="plus" />
              {loading ? t("creating") : t("confirm")}
            </Button>
          )}
        </div>
      </div>
    </DashboardModalShell>
  );
}
