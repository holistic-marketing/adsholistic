import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { buttonClass } from "@/components/ui/Button";
import { getHecomMonthlyDebtSettlement } from "@/lib/hecom/debt-settlement.server";
import { getTranslations } from "next-intl/server";
import { MissingCobroClaimPanel } from "@/features/clientes/components/MissingCobroClaimPanel.client";
import { ClienteCobrosMonthView } from "@/features/clientes/components/ClienteCobrosMonthView.client";
import type { HecomClienteDashboard } from "@/lib/hecom/cliente-dashboard.server";
import { routes } from "@/config/routes";
import { listMissingCobroClaimsForCliente } from "@/services/payments.service";
import { listRecentPeriodos } from "@/lib/payments/missing-cobro.shared";
import type { ManualPaymentIntentItem } from "@/services/payments.service";

/** Primer mes que ve un cliente en «Lo pagado». Gerentes ven todo el historial. */
export const CLIENT_COBROS_FROM_MONTH = "2026-06";

/** YYYY-MM de una fecha o periodo; null si no se puede leer. */
function monthOf(value: string | null | undefined): string | null {
  const match = String(value ?? "").trim().match(/^(\d{4}-\d{2})/);
  return match ? match[1]! : null;
}

export async function ClienteScopedCobros({
  data,
  fromMonth,
  notice,
}: {
  data: HecomClienteDashboard;
  /** YYYY-MM: solo se muestra desde ese mes (vista cliente). Sin valor = todo. */
  fromMonth?: string;
  /** Aviso que va justo debajo del encabezado (abonos por acuerdo). */
  notice?: ReactNode;
}) {
  const t = await getTranslations("cobros");
  const { cliente, summary } = data;
  const settlement = await getHecomMonthlyDebtSettlement(cliente.id);
  if (!settlement) throw new Error("No se pudo leer el registro financiero completo. Actualiza antes de consultar o cobrar.");
  // Se filtra en el servidor: los meses anteriores ni siquiera llegan al navegador.
  const visible = (month: string | null) => !fromMonth || (month !== null && month >= fromMonth);
  const gastos = data.gastos.filter((row) => visible(monthOf(row.fecha)));
  const cobros = data.cobros.filter((row) => visible(monthOf(row.periodoResumen) ?? monthOf(row.fecha)));

  let claims: ManualPaymentIntentItem[] = [];
  try {
    claims = await listMissingCobroClaimsForCliente(cliente.id);
  } catch {
    claims = [];
  }
  claims = claims.filter((claim) => visible(monthOf(claim.createdAt)));
  const periodos = listRecentPeriodos(6).filter((periodo) => visible(periodo));

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={t("module")}
        title={t("title", { name: cliente.name })}
        lede={t("pageIntro")}
        actions={
          <Link href={routes.payments} className={buttonClass("outline")}>
            {t("goPayments")}
            <PanelIcon name="arrow-right" />
          </Link>
        }
      />

      {notice}

      <ClienteCobrosMonthView
        pendingByMonth={Object.fromEntries(Object.entries(settlement).filter(([ym]) => !fromMonth || ym >= fromMonth).map(([ym, row]) => [ym, row.pending]))}
        feePercent={summary.depositFeePercent}
        capped={gastos.length >= 4000 || cobros.length >= 800}
        gastos={gastos.map((row) => ({
          fecha: row.fecha,
          gasto: row.gasto,
          fee: row.fee,
          camp: row.camp,
        }))}
        cobros={cobros.map((row) => ({
          fecha: row.fecha,
          monto: row.monto,
          applicableMonto: row.applicableMonto,
          metodo: row.metodo,
          periodoResumen: row.periodoResumen,
          notas: row.notas,
        }))}
        historyCobros={cobros.map((row) => ({
          id: row.id,
          fecha: row.fecha,
          hora: row.hora,
          codigo: row.codigo,
          periodoResumen: row.periodoResumen,
          monto: row.monto,
          metodo: row.metodo,
          comprobanteUrls: row.comprobanteUrls,
          registeredBy: row.registeredBy,
          registeredAt: row.registeredAt,
        }))}
      />

      <MissingCobroClaimPanel
        periodos={periodos}
        initialClaims={claims}
        fromDate={fromMonth ? `${fromMonth}-01` : undefined}
      />
    </div>
  );
}
