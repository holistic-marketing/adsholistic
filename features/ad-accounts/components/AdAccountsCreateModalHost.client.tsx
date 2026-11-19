"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { AD_ACCOUNTS_OPEN_CREATE_MODAL } from "@/lib/events/modal-events";

const CreateTikTokAccountModal = dynamic(
  () => import("./CreateTikTokAccountModal.client").then((m) => m.CreateTikTokAccountModal),
  { ssr: false },
);

/**
 * Abre el modal «Crear cuenta TikTok» cuando algún botón de la página lanza el evento
 * (encabezado, estado vacío, perfiles). Vive aparte de la barra de filtros para que
 * esos botones funcionen también cuando el cliente aún no tiene cuentas.
 */
export function AdAccountsCreateModalHost({
  clienteName,
  currentAccountCount,
  accountLimit,
}: {
  clienteName: string;
  currentAccountCount: number;
  accountLimit?: number;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener(AD_ACCOUNTS_OPEN_CREATE_MODAL, handleOpen);
    return () => window.removeEventListener(AD_ACCOUNTS_OPEN_CREATE_MODAL, handleOpen);
  }, []);

  if (!open) return null;
  return (
    <CreateTikTokAccountModal
      open
      onClose={() => setOpen(false)}
      clienteName={clienteName}
      currentAccountCount={currentAccountCount}
      accountLimit={accountLimit}
    />
  );
}
