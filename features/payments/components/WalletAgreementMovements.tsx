import { PanelCard } from "@/components/ui/PageHeader";
import { Note, ToneBadge } from "@/components/ui/PanelKit";
import { getSelectedClientWalletSettlements } from "@/lib/payments/wallet-settlements.server";

export async function WalletAgreementMovements({ userId }: { userId: string }) {
  let rows;
  try {
    rows = await getSelectedClientWalletSettlements(userId);
  } catch {
    return (
      <section aria-label="Abonos por acuerdo" role="status">
        <Note tone="warn">No se pudieron consultar los abonos por acuerdo de esta cartera. Vuelve a cargar para intentarlo.</Note>
      </section>
    );
  }
  if (!rows.length) return null;
  return (
    <PanelCard
      id="abonos-por-acuerdo"
      aria-label="Abonos por acuerdo"
      ruled
      title="Movimientos de cartera · abonos por acuerdo"
      description="Acuerdos sobre saldos históricos a favor. No son nuevos pagos bancarios ni nuevos cobros en Hecom."
    >
      <ul>
        {rows.map((row) => (
          <li key={row.id} className="border-t border-line py-4 first:border-t-0 first:pt-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-ink">Abono por acuerdo de saldo a favor</p>
                <p className="mt-1 text-xs text-ink-3">
                  {new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", dateStyle: "medium", timeStyle: "short" }).format(new Date(row.createdAt))} · Hora de Lima
                </p>
              </div>
              <div className="grid justify-items-end gap-1 text-right">
                <p className="num font-semibold text-ink">
                  {new Intl.NumberFormat("es-PE", { style: "currency", currency: row.currency }).format(row.amountCents / 100)}
                </p>
                <ToneBadge tone={row.status === "posted" ? "ok" : "neutral"} dot>
                  {row.status === "posted" ? "Acreditado en cartera" : "Anulado · no disponible por este abono"}
                </ToneBadge>
              </div>
            </div>
            <p className="mt-3 break-words text-sm leading-relaxed text-ink">{row.description}</p>
            <p className="mt-2 break-all text-xs text-ink-3">Referencia del movimiento: {row.id}</p>
          </li>
        ))}
      </ul>
    </PanelCard>
  );
}
