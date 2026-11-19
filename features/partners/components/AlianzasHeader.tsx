import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/PageHeader";

/** Encabezado de Alianzas para gerencia (lo usa la página y el panel con su botón). */
export function AlianzasHeader({ actions }: { actions?: ReactNode }) {
  return (
    <PageHeader
      eyebrow="Gerencia"
      title="Alianzas"
      lede={
        <>
          Cada aliado tiene su página de registro en <span className="font-mono text-[13px] text-ink">adsholistic.com/a/…</span>.
          Los clientes que se registran por ahí quedan a su nombre y el aliado gana un porcentaje del fee que les
          cobramos.
        </>
      }
      actions={actions}
    />
  );
}
