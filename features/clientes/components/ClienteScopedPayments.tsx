import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PanelCard } from "@/components/ui/PageHeader";
import { EmptyState, StatCard, ToneBadge } from "@/components/ui/PanelKit";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { formatHecomFecha } from "@/lib/hecom/gasto-label";
import {
  moneyUsd,
  type HecomClienteDashboard,
  type HecomCobroRow,
} from "@/lib/hecom/cliente-dashboard.server";
import { routes } from "@/config/routes";
import { cn } from "@/lib/cn";

/* Historial Hecom dentro de Pagos (sistema visual v3): fee, cobros y gastos
   en una fila de datos y los últimos pagos registrados en una tarjeta. */
export async function ClienteScopedPayments({
  data,
  staffMode = false,
}: {
  data: HecomClienteDashboard;
  /** Gerente / path BM: copy de fondeo correcto. */
  staffMode?: boolean;
}) {
  const t = await getTranslations("payments");
  const { cliente, summary, cobros } = data;
  const recentCobros = cobros.slice(0, 5);

  const stats = [
    { label: t("clienteScoped.feeLabel"), value: `${summary.depositFeePercent}%`, sub: t("clienteScoped.feeHint") },
    { label: t("clienteScoped.totalCobros"), value: moneyUsd(summary.cobroTotal) },
    { label: t("clienteScoped.totalGastos"), value: moneyUsd(summary.gastoTotal), sub: t("clienteScoped.gastosHint") },
    ...(staffMode
      ? [
          {
            label: summary.saldoEstimado < 0 ? t("clienteScoped.debt") : t("clienteScoped.estimated"),
            value: moneyUsd(summary.saldoEstimado),
            sub: undefined,
          },
        ]
      : []),
  ];

  const footerLink =
    cobros.length > recentCobros.length
      ? t("clienteScoped.viewAll")
      : cobros.length > 0
        ? t("clienteScoped.openProofs")
        : null;

  return (
    <section aria-labelledby="hecom-history" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">{t("clienteScoped.eyebrow")}</p>
          <h2 id="hecom-history" className="mt-1 text-base font-semibold leading-6 tracking-[-0.01em] text-ink">
            {t("clienteScoped.title", { name: cliente.name })}
          </h2>
          <p className="mt-0.5 text-xs text-ink-2">
            {t("clienteScoped.subtitle", { percent: summary.depositFeePercent })}
            {staffMode ? t("clienteScoped.subtitleStaff") : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-[13px] font-medium">
          <Link href={routes.cobros} className="inline-flex items-center gap-1 text-accent-text hover:underline">
            {t("clienteScoped.linkCobros")}
            <PanelIcon name="arrow-right" className="size-3.5" />
          </Link>
          <Link href={routes.profit} className="inline-flex items-center gap-1 text-accent-text hover:underline">
            {t("clienteScoped.linkProfit")}
            <PanelIcon name="arrow-right" className="size-3.5" />
          </Link>
        </div>
      </div>

      <div className={cn("grid grid-cols-1 gap-2 sm:grid-cols-2", staffMode ? "xl:grid-cols-4" : "xl:grid-cols-3")}>
        {stats.map((stat) => (
          <StatCard key={stat.label} flat label={stat.label} value={stat.value} sub={stat.sub} />
        ))}
      </div>

      <PanelCard
        title={t("clienteScoped.recentTitle")}
        description={
          cobros.length === 1
            ? t("clienteScoped.recordsOne", { count: cobros.length })
            : t("clienteScoped.recordsMany", { count: cobros.length })
        }
        bodyClassName="px-4 pb-2 pt-1 sm:px-6"
      >
        {recentCobros.length === 0 ? (
          <EmptyState icon="ledger" title={t("clienteScoped.empty")} className="py-8" />
        ) : (
          <ul>
            {recentCobros.map((row: HecomCobroRow) => {
              const fecha = formatHecomFecha(row.fecha);
              return (
                <li key={row.id} className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-b-0">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{row.metodo ?? t("clienteScoped.defaultMethod")}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
                      {fecha ? <span className="num">{fecha}</span> : null}
                      {row.codigo ? <span className="num rounded-[6px] bg-subtle px-1.5 py-px text-ink-2">{row.codigo}</span> : null}
                      {row.comprobanteUrls.length > 0 ? (
                        <ToneBadge tone="ok" icon="check">
                          {t("clienteScoped.withProof")}
                        </ToneBadge>
                      ) : null}
                    </div>
                  </div>
                  <p className="num shrink-0 font-semibold text-ok-fg">{moneyUsd(row.monto)}</p>
                </li>
              );
            })}
          </ul>
        )}
        {footerLink ? (
          <div className="mt-1 border-t border-line py-3">
            <Link href={routes.cobros} className="inline-flex items-center gap-1 text-[13px] font-medium text-accent-text hover:underline">
              {footerLink}
              <PanelIcon name="arrow-right" className="size-3.5" />
            </Link>
          </div>
        ) : null}
      </PanelCard>
    </section>
  );
}
