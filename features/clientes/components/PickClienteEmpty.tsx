import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { routes } from "@/config/routes";
import { getSession } from "@/lib/auth/session.server";
import { resolveHecomClientesForEmail } from "@/lib/auth/hecom-otp.server";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { buttonClass } from "@/components/ui/Button";
import { ClientPickerList } from "@/components/layout/panel/PanelClientPicker.client";
import { PickOwnCliente } from "./PickOwnCliente.client";

/** Fichas propias del cliente; con más de una debe elegir (si no, "Ir a pagos" vuelve aquí). */
async function ownClientes(): Promise<Array<{ id: string; name: string }>> {
  try {
    const session = await getSession();
    if (!session?.email) return [];
    const list = await resolveHecomClientesForEmail(String(session.email));
    return list.map((c) => ({ id: c.id, name: c.name }));
  } catch {
    return [];
  }
}

/* Tarjeta «Elige un cliente para operar» (sistema visual v3): el equipo elige
   ahí mismo, con el buscador; el cliente con varios negocios elige el suyo. */
export async function PickClienteEmpty({
  section,
  mode = "staff",
}: {
  section?: string;
  /** staff/gerente elige del CRM; cliente no ve el picker. */
  mode?: "staff" | "cliente";
}) {
  const t = await getTranslations("overview");
  const resolvedSection =
    !section || section === "esta sección"
      ? t("pickEmpty.defaultSection")
      : section;

  if (mode === "cliente") {
    const own = await ownClientes();
    const mustPick = own.length > 1;
    return (
      <section className="mx-auto mt-6 max-w-[600px] rounded-card border border-line bg-surface p-8 text-center shadow-card">
        <div className="mx-auto mb-3 grid size-10 place-items-center rounded-box bg-subtle text-ink">
          <PanelIcon name="card" className="size-[18px]" />
        </div>
        <h1 tabIndex={-1} className="text-lg font-semibold leading-6 tracking-[-0.015em] text-ink">
          {t(mustPick ? "pickEmpty.clientePickTitle" : "pickEmpty.clienteTitle")}
        </h1>
        <p className="mx-auto mb-4 mt-1.5 max-w-[46ch] text-ink-2">
          {t(mustPick ? "pickEmpty.clientePickBody" : "pickEmpty.clienteBody")}
        </p>
        {mustPick ? (
          <PickOwnCliente clientes={own} errorLabel={t("pickEmpty.clientePickError")} />
        ) : (
          <Link href={routes.payments} className={buttonClass("primary", "md")}>
            {t("pickEmpty.clienteCta")}
          </Link>
        )}
      </section>
    );
  }

  return (
    <section className="mx-auto mt-6 max-w-[600px] rounded-card border border-line bg-surface p-8 text-center shadow-card">
      <div className="mx-auto mb-3 grid size-10 place-items-center rounded-box bg-subtle text-ink">
        <PanelIcon name="user" className="size-[18px]" />
      </div>
      <h1 tabIndex={-1} className="text-lg font-semibold leading-6 tracking-[-0.015em] text-ink">
        {t("pickEmpty.staffTitle")}
      </h1>
      <p className="mx-auto mb-4 mt-1.5 max-w-[46ch] text-ink-2">
        {t("pickEmpty.staffBody", { section: resolvedSection })}
      </p>
      <ClientPickerList />
    </section>
  );
}
