"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { ToneBadge } from "@/components/ui/PanelKit";
import { CreditReview } from "./CreditReview.client";

export function BusinessSimulator() {
  return (
    <>
      <PageHeader
        eyebrow="Decisiones por cliente"
        title="Simulador de negocio"
        lede="Evalúa el fee o un crédito de un cliente antes de decidir."
        aside={<ToneBadge tone="neutral">Solo simulación · no modifica acuerdos</ToneBadge>}
      />
      <CreditReview />
    </>
  );
}
