"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button, buttonClass } from "@/components/ui/Button";
import { PanelCard } from "@/components/ui/PageHeader";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { formatMoney } from "@/lib/format-money";
import { PaymentGatewaySelector } from "./PaymentGatewaySelector.client";
import { PaymentsMoneyFlowGuide } from "./PaymentsMoneyFlowGuide";
import {
  PaymentsFundingModeSwitch,
  type PaymentsFundingMode,
} from "./PaymentsFundingModeSwitch.client";
import type {
  PaymentGateway,
  PaymentGatewayId,
  WalletOverview,
} from "@/types/payment";

interface PaymentsGatewaySectionProps {
  gateways: PaymentGateway[];
  selected: PaymentGatewayId;
  onSelect: (id: PaymentGatewayId) => void;
  onContinue: () => void;
  fundingMode: PaymentsFundingMode;
  onFundingModeChange: (mode: PaymentsFundingMode) => void;
  canClientStripeFund: boolean;
  canAgencyBmFund: boolean;
  canSwitchFundingModes: boolean;
  wallet: WalletOverview;
  depositFeePercent?: number;
}

export function PaymentsGatewaySection({
  gateways,
  selected,
  onSelect,
  onContinue,
  fundingMode,
  onFundingModeChange,
  canClientStripeFund,
  canAgencyBmFund,
  canSwitchFundingModes,
  wallet,
  depositFeePercent = 10,
}: PaymentsGatewaySectionProps) {
  const t = useTranslations("payments");
  const selectedGateway = gateways.find((gateway) => gateway.id === selected);
  const selectedInMaintenance = Boolean(selectedGateway?.maintenance);
  const showClientDeposit = canClientStripeFund && fundingMode === "client";

  return (
    <div className="space-y-5">
      <PaymentsFundingModeSwitch
        mode={fundingMode}
        onChange={onFundingModeChange}
        canClientStripeFund={canClientStripeFund}
        canAgencyBmFund={canAgencyBmFund}
        canSwitchFundingModes={canSwitchFundingModes}
      />

      {showClientDeposit ? (
        <PanelCard
          id="recargar-saldo"
          className="scroll-mt-20"
          title={t("reloadSection.title")}
          description={t("reloadSection.body")}
        >
          <fieldset>
            <legend className="sr-only">{t("reloadSection.method")}</legend>
            <PaymentGatewaySelector
              gateways={gateways}
              selected={selected}
              onSelect={onSelect}
            />
          </fieldset>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              onClick={onContinue}
              disabled={selectedInMaintenance || !selectedGateway}
              className="max-sm:w-full"
            >
              {selectedInMaintenance
                ? t("reloadSection.unavailable")
                : selectedGateway
                  ? t("reloadSection.reloadWith", {
                      name: selectedGateway.name,
                    })
                  : t("reloadSection.title")}
            </Button>
          </div>

          <PaymentsMoneyFlowGuide
            selected={selected}
            feePercent={depositFeePercent}
            className="mt-4"
          />

          <dl
            aria-label={t("reloadSection.walletDetails")}
            className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2"
          >
            <MiniStat
              label={t("reloadSection.wallet")}
              value={formatMoney(wallet.balance, wallet.currency)}
              sub={t("balanceCompare.holisticHint")}
            />
            <MiniStat
              label={t("reloadSection.lastTopUp")}
              value={wallet.lastTopUp ?? t("walletCard.noRecords")}
              small
            />
            <MiniStat
              label={t("reloadSection.feeHolistic")}
              value={t("reloadSection.feeOnNet", { percent: depositFeePercent })}
              small
            />
          </dl>
        </PanelCard>
      ) : (
        <PanelCard
          title={t("reloadSection.bmTitle")}
          description={t("reloadSection.bmBody")}
        >
          <a href="#asignar-saldo" className={buttonClass("primary")}>
            {t("reloadSection.pickAccount")}
            <PanelIcon name="arrow-right" />
          </a>
        </PanelCard>
      )}
    </div>
  );
}

/** Dato chico de la cartera (v3 «mini»). */
function MiniStat({
  label,
  value,
  sub,
  small = false,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  small?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-box border border-line bg-field px-3 py-2.5">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-3">{label}</dt>
      <dd
        className={
          small
            ? "mt-0.5 text-sm font-semibold text-ink [overflow-wrap:anywhere]"
            : "num mt-0.5 text-[15px] font-semibold text-ink"
        }
      >
        {value}
      </dd>
      {sub ? <dd className="text-xs text-ink-3">{sub}</dd> : null}
    </div>
  );
}

export type { PaymentsFundingMode } from "./PaymentsFundingModeSwitch.client";
