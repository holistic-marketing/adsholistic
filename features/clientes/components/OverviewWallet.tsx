import Link from "next/link";
import { Suspense, cache } from "react";
import { getTranslations } from "next-intl/server";
import { routes } from "@/config/routes";
import { resolveOrganizationIdForHecomCliente } from "@/lib/hecom/resolve-cliente-organization.server";
import { getWalletLedgerBalance } from "@/lib/ledger/ledger.server";
import { getAppFormatter } from "@/lib/i18n/get-app-formatter";
import {
  clienteWalletCents,
  pickClienteWalletOrganizationId,
  walletBalanceIsUnknown,
} from "@/features/clientes/lib/cliente-wallet";
import { KpiCard } from "@/components/ui/PanelKit";
import { PanelCard } from "@/components/ui/PageHeader";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { buttonClass } from "@/components/ui/Button";

type OverviewWalletProps = {
  clienteId: string;
  /** Solo si el cliente no tiene org propia. No es la org del gerente. */
  sessionOrganizationId?: string | null;
  feePercent: number;
};

const loadClienteWallet = cache(async (clienteId: string, sessionOrganizationId: string | null) => {
  // Cartera del cliente seleccionado, no la org de quien está «viendo como».
  const resolvedOrgId = await resolveOrganizationIdForHecomCliente(clienteId);
  const orgId = pickClienteWalletOrganizationId(resolvedOrgId, sessionOrganizationId);
  return orgId ? getWalletLedgerBalance(orgId) : null;
});

/** Saldo formateado, o «—» si la lectura falló (nunca un cero inventado). */
async function readBalance(clienteId: string, sessionOrganizationId: string | null) {
  const { formatMoney } = await getAppFormatter();
  try {
    const wallet = await loadClienteWallet(clienteId, sessionOrganizationId);
    const cents = clienteWalletCents(wallet ?? { availableBalanceCents: null });
    return walletBalanceIsUnknown(cents) ? "—" : formatMoney(cents / 100, wallet?.currency ?? "USD");
  } catch {
    return "—";
  }
}

async function WalletKpi({ clienteId, sessionOrganizationId = null, feePercent }: OverviewWalletProps) {
  const t = await getTranslations("wallet");
  const tOverview = await getTranslations("overview");
  return (
    <KpiCard
      label={t("balance")}
      value={await readBalance(clienteId, sessionOrganizationId)}
      lead={t("availableHint")}
      detail={tOverview("feeMeta", { percent: feePercent })}
    />
  );
}

/** «Saldo en cartera»: se pinta aparte para no frenar el resto del resumen. */
export async function OverviewWallet(props: OverviewWalletProps) {
  const t = await getTranslations("wallet");
  return (
    <Suspense fallback={<KpiCard label={t("balance")} value="…" busy />}>
      <WalletKpi {...props} />
    </Suspense>
  );
}

async function WalletCardBody({ clienteId, sessionOrganizationId = null }: OverviewWalletProps) {
  return (
    <p className="text-[1.875rem] font-semibold leading-tight tracking-[-0.03em] text-ink tabular-nums">
      {await readBalance(clienteId, sessionOrganizationId)}
    </p>
  );
}

/** Tarjeta «Cartera» de la columna derecha: saldo, recargar y asignar. */
export async function OverviewWalletCard(props: OverviewWalletProps) {
  const t = await getTranslations("overview.walletCard");
  return (
    <PanelCard
      title={t("title")}
      description={t("subtitle")}
      action={
        <Link href={routes.payments} className="panel-icon-btn" aria-label={t("goPayments")}>
          <PanelIcon name="arrow-right" />
        </Link>
      }
    >
      <Suspense fallback={<p className="text-[1.875rem] font-semibold leading-tight text-ink-3" aria-busy="true">…</p>}>
        <WalletCardBody {...props} />
      </Suspense>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={routes.payments} className={buttonClass("primary", "sm")}>
          <PanelIcon name="plus" />
          {t("recharge")}
        </Link>
        <Link href={`${routes.payments}#asignar-saldo`} className={buttonClass("outline", "sm")}>
          <PanelIcon name="send" />
          {t("assign")}
        </Link>
      </div>
    </PanelCard>
  );
}
