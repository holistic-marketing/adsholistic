import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { PageHeader, PanelCard } from "@/components/ui/PageHeader";
import { Note, PropList, StatCard, ToneBadge } from "@/components/ui/PanelKit";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { routes } from "@/config/routes";
import {
  getHecomCliente,
  listHecomClienteSpend,
} from "@/lib/hecom/clientes.server";
import { getHecomSupabaseConfig } from "@/lib/hecom/supabase.server";
import { requireSession } from "@/lib/auth/guards.server";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import { SelectHecomClienteOnMount } from "@/features/clientes/components/SelectHecomClienteOnMount.client";
import { HecomClienteAvatar } from "@/features/clientes/components/HecomClienteAvatar.client";
import { ClienteFeeCard } from "@/features/clientes/components/ClienteFeeCard.client";
import { isStaffUser } from "@/lib/auth/staff.server";
import { isPaymentsSuperAdminEmail } from "@/lib/payments/funding-roles.server";

export const dynamic = "force-dynamic";

function moneyUsd(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

/* Tabla v3 dentro de una tarjeta: encabezados sin mayúsculas y filas de 59 px. */
const TH_BASE = "h-10 whitespace-nowrap border-b border-line px-2 text-sm font-medium text-ink";
const TH = `${TH_BASE} text-left`;
const TH_R = `${TH_BASE} text-right`;
const TD = "h-[59px] border-b border-line px-2 py-2 align-middle";
const TR = "hover:bg-field [&:last-child>td]:border-b-0";

function DataTable({ label, head, children }: { label: string; head: ReactNode; children: ReactNode }) {
  return (
    <div className="-mx-2 overflow-x-auto" role="region" aria-label={label} tabIndex={0}>
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr>{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/** Nombre de la tabla de origen, discreto, para quien soporta la integración. */
function SourceTag({ children }: { children: ReactNode }) {
  return (
    <ToneBadge tone="neutral" className="font-mono text-[11px]">
      {children}
    </ToneBadge>
  );
}

export default async function ClienteVistaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const isStaff = (await isStaffUser(session.email)) || isPaymentsSuperAdminEmail(session.email);
  const { id } = await params;
  const hecomCfg = getHecomSupabaseConfig();

  console.log("[Clientes/detalle] load Hecom", {
    id,
    hecomConfigured: hecomCfg.configured,
    hecomUrl: hecomCfg.url,
  });

  let loadError: string | null = null;
  let cliente: Awaited<ReturnType<typeof getHecomCliente>> = null;
  let spend: Awaited<ReturnType<typeof listHecomClienteSpend>> = {
    kind: "none",
    rows: [],
  };

  try {
    cliente = await getHecomCliente(id);
    if (cliente && hecomCfg.configured) {
      spend = await listHecomClienteSpend(id, 40);
    }
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Error cargando cliente Hecom";
    console.error("[Clientes/detalle] ERROR", loadError, error);
  }

  if (!loadError && !cliente) {
    notFound();
  }

  if (loadError || !cliente) {
    return (
      <div className={dashboardClasses.page}>
        <Note tone="danger" title="No se pudo abrir este cliente Hecom">
          {loadError}
        </Note>
        <Button asChild variant="outline" href={routes.clientes}>
          <PanelIcon name="arrow-left" />
          Volver a Clientes
        </Button>
      </div>
    );
  }

  const primaryEmail = cliente.emails[0] ?? null;
  const accounts =
    cliente.tiktokAccounts.length > 0
      ? cliente.tiktokAccounts
      : cliente.tiktokAdvertiserId
        ? [
            {
              advertiserId: cliente.tiktokAdvertiserId,
              advertiserName: cliente.tiktokAdvertiserName,
              bmBucket: null as string | null,
              fee: cliente.tiktokDefaultFee,
              syncEnabled: cliente.tiktokSyncEnabled !== false,
            },
          ]
        : [];

  const spendTotal = spend.rows.reduce((acc, row) => {
    const key = spend.kind === "gastos" ? "gasto" : "spend";
    const n = Number(row[key] ?? row.monto);
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);

  const spendSource =
    spend.kind === "snapshots"
      ? "tiktok_spend_snapshots"
      : spend.kind === "gastos"
        ? "gastos"
        : "sin datos";

  return (
    <div className="min-w-0">
      <SelectHecomClienteOnMount clienteId={cliente.id} name={cliente.name} />

      <div className="flex items-start gap-4">
        <HecomClienteAvatar
          name={cliente.name}
          avatarUrl={cliente.avatarUrl}
          size="md"
          className="mt-0.5 max-sm:hidden"
        />
        <PageHeader
          className="min-w-0 flex-1"
          eyebrow="Hecom Club · Cliente"
          title={cliente.name}
          lede={
            <>
              {cliente.biz ? `${cliente.biz} · ` : ""}
              {primaryEmail ?? "Sin email"}
              {cliente.dni ? ` · DNI ${cliente.dni}` : ""}
            </>
          }
          actions={
            <>
              <Button asChild variant="outline" href={routes.clientes}>
                <PanelIcon name="arrow-left" />
                Elegir otro cliente
              </Button>
              <Button asChild href={routes.adAccounts}>
                Ver sus cuentas publicitarias
              </Button>
            </>
          }
        />
      </div>

      <div className="space-y-4">
        <Note tone="info" title="Cliente seleccionado">
          {hecomCfg.configured
            ? "Fuente live: Supabase Hecom Club."
            : "Fuente: backup Holistic local (sin HECOM_SUPABASE_SERVICE_ROLE_KEY aún)."}{" "}
          En <strong className="font-semibold">Mis cuentas publicitarias</strong> solo vas a ver lo de {cliente.name}.
        </Note>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Cuentas TikTok" value={accounts.length} />
          <StatCard label="Emails CRM" value={cliente.emails.length} />
          <StatCard label="Filas gasto (vista)" value={spend.rows.length} />
          <StatCard label="Suma en lista" value={moneyUsd(spendTotal)} />
        </div>

        {isStaff ? (
          <div id="comision" className="scroll-mt-24">
            <ClienteFeeCard clienteId={cliente.id} currentFee={cliente.tiktokDefaultFee} />
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <div className="min-w-0 space-y-4">
            <PanelCard
              title="Cuentas TikTok Ads"
              description={`${accounts.length} ${accounts.length === 1 ? "cuenta" : "cuentas"}`}
              action={<SourceTag>cliente_tiktok_cuentas</SourceTag>}
            >
              {accounts.length === 0 ? (
                <p className="text-sm text-ink-3">Este cliente aún no tiene advertiser_id mapeado en Hecom.</p>
              ) : (
                <DataTable
                  label="Cuentas TikTok Ads"
                  head={
                    <>
                      <th scope="col" className={TH}>Advertiser</th>
                      <th scope="col" className={TH}>BM</th>
                      <th scope="col" className={TH_R}>Fee</th>
                      <th scope="col" className={TH}>Sync</th>
                    </>
                  }
                >
                  {accounts.map((account) => (
                    <tr key={account.advertiserId} className={TR}>
                      <td className={TD}>
                        <p className="font-semibold text-ink">{account.advertiserName ?? "TikTok Ads"}</p>
                        <p className="font-mono text-xs text-ink-3">{account.advertiserId}</p>
                      </td>
                      <td className={cn(TD, "text-ink-2")}>{account.bmBucket ?? "—"}</td>
                      <td className={cn(TD, "num text-right font-semibold")}>
                        {account.fee != null ? `${account.fee}%` : "—"}
                      </td>
                      <td className={TD}>
                        <ToneBadge tone={account.syncEnabled ? "ok" : "neutral"} dot>
                          {account.syncEnabled ? "on" : "off"}
                        </ToneBadge>
                      </td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </PanelCard>

            <PanelCard
              title="Gastos / snapshots"
              action={<SourceTag>{spendSource}</SourceTag>}
            >
              {spend.rows.length === 0 ? (
                <p className="text-sm text-ink-3">
                  No hay filas de gasto para este cliente en Hecom (o la sync aún no corrió).
                </p>
              ) : (
                <DataTable
                  label="Gastos / snapshots"
                  head={
                    <>
                      <th scope="col" className={TH}>Fecha</th>
                      <th scope="col" className={TH}>Detalle</th>
                      <th scope="col" className={TH_R}>Monto</th>
                    </>
                  }
                >
                  {spend.rows.map((row, idx) => {
                    const rowId = String(row.id ?? `spend-row-${idx}`);
                    if (spend.kind === "gastos") {
                      return (
                        <tr key={rowId} className={TR}>
                          <td className={cn(TD, "num whitespace-nowrap text-ink-2")}>
                            {String(row.fecha_movimiento ?? row.mes ?? "—")}
                          </td>
                          <td className={TD}>
                            <p className="font-semibold text-ink">{String(row.camp ?? "Gasto")}</p>
                            <p className="text-xs text-ink-3">{String(row.source ?? "")}</p>
                          </td>
                          <td className={cn(TD, "num whitespace-nowrap text-right font-semibold")}>
                            {moneyUsd(row.gasto ?? row.monto)}
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={rowId} className={TR}>
                        <td className={cn(TD, "num whitespace-nowrap text-ink-2")}>{String(row.stat_date ?? "—")}</td>
                        <td className={TD}>
                          <p className="font-semibold text-ink">
                            {String(row.campaign_name ?? row.advertiser_id ?? "Spend")}
                          </p>
                          <p className="text-xs text-ink-3">
                            {row.created_at ? formatDateTime(String(row.created_at)) : ""}
                          </p>
                        </td>
                        <td className={cn(TD, "num whitespace-nowrap text-right font-semibold")}>
                          {moneyUsd(row.spend)}
                        </td>
                      </tr>
                    );
                  })}
                </DataTable>
              )}
            </PanelCard>
          </div>

          <div className="min-w-0 space-y-4">
            <PanelCard title="Contacto CRM">
              <PropList
                items={[
                  ...(cliente.emails.length === 0
                    ? [{ label: "Email", value: <span className="font-normal text-ink-3">Sin emails</span> }]
                    : cliente.emails.map((email) => ({ label: "Email", value: email }))),
                  ...cliente.phones.map((phone) => ({
                    label: "Teléfono",
                    value: <span className="num">{phone}</span>,
                  })),
                ]}
              />
              {cliente.notes ? <p className="mt-4 text-[13px] leading-relaxed text-ink-2">{cliente.notes}</p> : null}
            </PanelCard>

            <PanelCard title="Cómo se jala el gasto">
              <ol className="grid gap-2.5">
                {[
                  <>
                    En Hecom hay un solo token de agencia: <Code>TIKTOK_ACCESS_TOKEN</Code>.
                  </>,
                  <>
                    Cada cliente tiene uno o más <Code>advertiser_id</Code>.
                  </>,
                  <>Sync escribe snapshots / gastos; acá solo leemos lo ya guardado.</>,
                ].map((step, i) => (
                  <li key={i} className="grid grid-cols-[24px_1fr] items-start gap-2.5 text-[13px] text-ink-2">
                    <span
                      aria-hidden
                      className="grid size-[22px] place-items-center rounded-[6px] bg-subtle font-mono text-[11px] font-semibold text-ink"
                    >
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </PanelCard>
          </div>
        </div>
      </div>
    </div>
  );
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-subtle px-1 font-mono text-[12px] text-ink">{children}</code>;
}
