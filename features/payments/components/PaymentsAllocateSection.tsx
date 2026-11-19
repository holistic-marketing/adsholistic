"use client";

import { PaymentsAssignmentPanel } from "./PaymentsAssignmentPanel.client";
import type { PaymentAccountAllocation } from "@/types/payment";
import { PaymentsAllocateSectionCopy } from "./PaymentsAllocateSectionCopy.client";
import { usePaymentsFundingMode } from "./PaymentsFundingModeContext.client";

interface PaymentsAllocateSectionProps {
  accounts: PaymentAccountAllocation[];
  walletBalanceLabel: string;
  walletBalance: number;
  clienteName?: string;
  allowForceLedger?: boolean;
}

/** Paso 2: fondear cuenta ads (copy depende del modo Cliente/Gerente). */
export function PaymentsAllocateSection({
  accounts,
  walletBalanceLabel,
  walletBalance,
  clienteName,
  allowForceLedger = false,
}: PaymentsAllocateSectionProps) {
  const { agencyBmFunding } = usePaymentsFundingMode();

  return (
    <section id="asignar-saldo" className="scroll-mt-20 pt-1">
      <PaymentsAllocateSectionCopy
        walletBalanceLabel={walletBalanceLabel}
        walletBalance={walletBalance}
        clienteName={clienteName}
      />

      <PaymentsAssignmentPanel
        accounts={accounts}
        agencyBmFunding={agencyBmFunding}
        allowForceLedger={allowForceLedger}
        walletBalance={walletBalance}
      />
    </section>
  );
}
