"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, buttonClass } from "@/components/ui/Button";
import { PanelCard } from "@/components/ui/PageHeader";
import { ToneBadge, type Tone } from "@/components/ui/PanelKit";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { useAppFormatter } from "@/lib/i18n/use-app-formatter";
import { formatPenAmount } from "@/lib/payments/manual-deposit.shared";
import { ManualPaymentModal } from "@/features/payments/components/ManualPaymentModal.client";
import type { RechargeRow, RechargeState } from "@/lib/payments/my-recharges.shared";

const TONE: Record<RechargeState, Tone> = {
  credited: "ok",
  in_review: "info",
  needs_proof: "accent",
  pay_yape: "warn",
  pay_crypto: "warn",
  processing: "neutral",
  replaced: "neutral",
  cancelled: "neutral",
  failed: "danger",
};

type ProviderKey = "providerManual" | "providerYape" | "providerCrypto" | "providerCard" | "providerOther";
const PROVIDER_KEY: Record<string, ProviderKey> = {
  manual: "providerManual",
  cobrana: "providerYape",
  crypto: "providerCrypto",
  stripe: "providerCard",
};

export function MyRechargesPanel({ rows, feePercent }: { rows: RechargeRow[]; feePercent: number }) {
  const t = useTranslations("payments.myRecharges");
  const { formatMoney, bcp47 } = useAppFormatter();
  const [resume, setResume] = useState<RechargeRow | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  if (rows.length === 0) return null;
  const pending = rows.filter((r) => r.state === "needs_proof" || r.state === "pay_yape" || r.state === "pay_crypto").length;
  const charge = (r: RechargeRow) =>
    r.chargeCurrency === "PEN" ? formatPenAmount(r.chargeCents) : formatMoney(r.chargeCents / 100);
  const when = (iso: string) =>
    new Intl.DateTimeFormat(bcp47, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      window.prompt(t("copyPrompt"), value);
    }
  }

  return (
    <PanelCard
      id="mis-recargas"
      title={t("title")}
      description={t("subtitle")}
      action={
        pending > 0 ? <ToneBadge tone="accent">{t("pendingCount", { count: pending })}</ToneBadge> : null
      }
    >
      <ul>
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex flex-col gap-2.5 border-t border-line py-3 first:border-t-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <ToneBadge tone={TONE[row.state]} dot>
                  {t(`state.${row.state}`)}
                </ToneBadge>
                <span className="num font-semibold text-ink">{charge(row)}</span>
                {row.creditUsdCents != null && row.state !== "replaced" && row.state !== "cancelled" ? (
                  <span className="text-xs text-ink-3">
                    {t("credit", { amount: formatMoney(row.creditUsdCents / 100) })}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-ink-3">
                {[t(PROVIDER_KEY[row.provider] ?? "providerOther"), when(row.createdAt)].join(" · ")}
              </p>
              <p className="mt-0.5 break-words text-[13px] text-ink-2">
                {row.note ??
                  (row.cryptoMissingUsdt != null
                    ? t("hint.pay_crypto_short", { amount: row.cryptoMissingUsdt.toFixed(2) })
                    : t(`hint.${row.state}`))}
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {row.state === "needs_proof" && row.provider === "manual" ? (
                <Button size="sm" onClick={() => setResume(row)}>
                  <PanelIcon name="upload" />
                  {t("uploadProof")}
                </Button>
              ) : null}
              {row.state === "pay_yape" && row.yapeCode ? (
                <Button variant="outline" size="sm" onClick={() => void copy(row.yapeCode as string)}>
                  <span className="font-mono text-xs">{row.yapeCode}</span>
                  <PanelIcon name={copied === row.yapeCode ? "check" : "copy"} className="text-ink-3" />
                  <span className="text-ink-2">{copied === row.yapeCode ? t("copied") : t("copy")}</span>
                </Button>
              ) : null}
              {row.state === "pay_crypto" && row.checkoutUrl ? (
                <a
                  href={row.checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClass("outline", "sm")}
                >
                  {t("payCrypto")}
                  <PanelIcon name="external" />
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {resume ? (
        <ManualPaymentModal
          key={resume.id}
          open
          onClose={() => setResume(null)}
          feePercent={feePercent}
          resume={{ paymentIntentId: resume.id, chargeCents: resume.chargeCents, chargeCurrency: resume.chargeCurrency, manualPayMethod: resume.manualPayMethod }}
        />
      ) : null}
    </PanelCard>
  );
}
