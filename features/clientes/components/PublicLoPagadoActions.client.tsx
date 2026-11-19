"use client";

import { Suspense, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { PublicDebtCardPay } from "@/features/clientes/components/PublicDebtCardPay.client";
import { MissingCobroClaimPanel } from "@/features/clientes/components/MissingCobroClaimPanel.client";
import { ManualPaymentModal } from "@/features/payments/components/ManualPaymentModal.client";
import { listRecentPeriodos } from "@/lib/payments/missing-cobro.shared";
import type { ManualPaymentIntentItem } from "@/services/payments.service";

export function PublicLoPagadoActions({
  apiBase,
  claims,
  month,
  owedUsd,
}: {
  apiBase: string;
  claims: ManualPaymentIntentItem[];
  /** YYYY-MM del link. La boleta faltante solo se reporta de este mes. */
  month: string;
  /** Lo que debe del mes (positivo = debe). */
  owedUsd: number;
}) {
  const [payOpen, setPayOpen] = useState(false);
  const periodos = useMemo(
    () => (month && /^\d{4}-\d{2}$/.test(month) ? [month] : listRecentPeriodos(1)),
    [month],
  );
  const endpoints = useMemo(
    () => ({
      config: `${apiBase}/config`,
      create: `${apiBase}/manual`,
      proof: (id: string) => `${apiBase}/proof/${id}`,
      claims: `${apiBase}/missing-cobro`,
    }),
    [apiBase],
  );

  return (
    <div className="space-y-4">
      <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <p className="eyebrow">Pagos</p>
            <h2 className="mt-1 text-base font-semibold leading-6 tracking-[-0.01em] text-ink">Pago manual</h2>
            <p className="mt-1.5 text-ink-2">
              Paga lo que debes de este mes. Eliges el monto, transfieres y subes
              el voucher. Gerencia lo ve en Pagos manuales como pago de deuda: baja
              lo que debes y no recarga cartera.
            </p>
          </div>
          <Button
            size="lg"
            className="shrink-0 self-start sm:self-auto pointer-coarse:h-11"
            onClick={() => setPayOpen(true)}
          >
            Pagar y subir voucher
            <PanelIcon name="arrow-right" />
          </Button>
        </div>
      </section>

      <Suspense fallback={null}>
        <PublicDebtCardPay configUrl={endpoints.config} apiBase={apiBase} month={month} owedUsd={owedUsd} />
      </Suspense>

      <MissingCobroClaimPanel
        periodos={periodos}
        initialClaims={claims}
        endpoints={{
          claims: endpoints.claims,
          proof: endpoints.proof,
        }}
      />

      <ManualPaymentModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        paysDebt
        debtMonth={month}
        endpoints={{
          config: endpoints.config,
          create: endpoints.create,
          proof: endpoints.proof,
        }}
      />
    </div>
  );
}
