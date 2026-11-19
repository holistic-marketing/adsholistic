"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { Note } from "@/components/ui/PanelKit";
import { GatewayLogo } from "./GatewayLogo";
import { PaymentAppIcon } from "./PaymentAppIcon";
import type { PaymentGateway, PaymentGatewayId } from "@/types/payment";

interface PaymentGatewaySelectorProps {
  gateways: PaymentGateway[];
  selected: PaymentGatewayId;
  onSelect: (id: PaymentGatewayId) => void;
}

/* Métodos de pago como tarjetas elegibles (v3 «opts methods»). */
export function PaymentGatewaySelector({
  gateways,
  selected,
  onSelect,
}: PaymentGatewaySelectorProps) {
  const t = useTranslations("payments");
  const inMaintenanceGateways = gateways.filter(
    (gateway) => gateway.maintenance,
  );

  return (
    <>
      {inMaintenanceGateways.map((gateway) => (
        <div key={gateway.id} role="status" className="mb-3">
          <Note tone="warn" title={t("gatewaySelector.maintenanceNoticeTitle", { name: gateway.name })}>
            {t("gatewaySelector.maintenanceNoticeBody")}
          </Note>
        </div>
      ))}
      <div
        role="radiogroup"
        aria-label={t("gatewaySelector.aria")}
        className="grid grid-cols-1 gap-2 min-[561px]:grid-cols-2 min-[1241px]:grid-cols-4"
      >
        {gateways.map((gateway) => {
          const inMaintenance = Boolean(gateway.maintenance);
          const isSelected = selected === gateway.id && !inMaintenance;
          const localizedName =
            gateway.id === "manual"
              ? t("gateways.manualName")
              : gateway.id === "stripe"
                ? t("gateways.stripeName")
                : gateway.name;
          const localizedDescription =
            gateway.id === "stripe"
              ? t("gateways.stripeDesc")
              : gateway.id === "whop"
                ? t("gateways.whopDesc")
                : gateway.id === "cobrana"
                  ? t("gateways.cobranaDesc")
                  : gateway.id === "manual"
                    ? t("gateways.manualDesc")
                    : gateway.description;
          return (
            <button
              key={gateway.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-disabled={inMaintenance}
              disabled={inMaintenance}
              onClick={() => {
                if (inMaintenance) return;
                onSelect(gateway.id);
              }}
              className={cn(
                "flex min-h-[92px] w-full min-w-0 items-start gap-3 rounded-box border p-3.5 text-left transition-[border-color,background-color,box-shadow]",
                inMaintenance
                  ? "cursor-not-allowed border-line bg-field opacity-70"
                  : isSelected
                    ? "border-accent bg-accent-soft shadow-[0_0_0_1px_var(--ui-accent)]"
                    : "border-line bg-surface hover:border-line-strong",
              )}
            >
              <GatewayLogo gatewayId={gateway.id} size="sm" />

              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <b className="truncate text-sm font-semibold text-ink">
                    {localizedName}
                  </b>
                  {inMaintenance ? (
                    <span className="panel-badge tone-neutral shrink-0">
                      {t("gatewaySelector.maintenance")}
                    </span>
                  ) : null}
                </span>
                <small className="mt-0.5 line-clamp-2 block text-xs leading-snug text-ink-2">
                  {localizedDescription}
                </small>
                {gateway.id === "stripe" || gateway.id === "whop" ? (
                  <span className="mt-2 flex flex-wrap items-center gap-1.5">
                    {(["visa", "mastercard"] as const).map((app) => (
                      <PaymentAppIcon key={app} app={app} size="sm" />
                    ))}
                  </span>
                ) : gateway.id === "cobrana" ? (
                  <span className="mt-2 flex flex-wrap items-center gap-1.5">
                    {(
                      [
                        "yape",
                        "plin",
                        "bcp",
                        "interbank",
                        "bbva",
                        "scotiabank",
                      ] as const
                    ).map((app) => (
                      <PaymentAppIcon key={app} app={app} size="sm" />
                    ))}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
