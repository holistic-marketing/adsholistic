import { Suspense, cache } from "react";
import { getTranslations } from "next-intl/server";
import { resolveOrganizationIdForHecomCliente } from "@/lib/hecom/resolve-cliente-organization.server";
import { getWalletLedgerBalance } from "@/lib/ledger/ledger.server";
import { getAppFormatter } from "@/lib/i18n/get-app-formatter";
import {
  clienteWalletCents,
  pickClienteWalletOrganizationId,
  walletBalanceIsUnknown,
} from "@/features/clientes/lib/cliente-wallet";
import { OverviewKpi } from "./OverviewKpi";

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

async function WalletKpi({ clienteId, sessionOrganizationId = null, feePercent }: OverviewWalletProps) {
  const t = await getTranslations("wallet");
  const tOverview = await getTranslations("overview");
  const { formatMoney } = await getAppFormatter();
  let cents: number | null = null;
  let currency = "USD";
  try {
    const wallet = await loadClienteWallet(clienteId, sessionOrganizationId);
    cents = clienteWalletCents(wallet ?? { availableBalanceCents: null });
    currency = wallet?.currency ?? "USD";
  } catch {
    cents = null;
  }
  return (
    <OverviewKpi
      label={t("balance")}
      value={walletBalanceIsUnknown(cents) ? "—" : formatMoney(cents / 100, currency)}
      lead={t("availableHint")}
      detail={tOverview("feeMeta", { percent: feePercent })}
    />
  );
}

/** «Saldo en cartera»: se pinta aparte para no frenar el resto del resumen. */
export async function OverviewWallet(props: OverviewWalletProps) {
  const t = await getTranslations("wallet");
  return (
    <Suspense fallback={<OverviewKpi label={t("balance")} value="…" busy />}>
      <WalletKpi {...props} />
    </Suspense>
  );
}
