"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { PaymentAppIcon, paymentAppButtonClass } from "./PaymentAppIcon";

/**
 * Pago Yape en un paso. El link de Cobrana abre Yape con el servicio y el
 * código ya cargados:
 * - Computadora: QR grande; se escanea con la cámara del celular y abre Yape.
 * - Celular: botón que abre la app directo.
 * El modal ya consulta el estado y se cierra solo cuando entra el pago.
 */
export function YapePayQr({ url, amountLabel }: { url: string; amountLabel: string | null }) {
  const t = useTranslations("payments");
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Corrección alta ("H"): el logo del centro tapa parte del código y igual se lee.
    QRCode.toDataURL(url, {
      errorCorrectionLevel: "H",
      margin: 1,
      width: 480,
      color: { dark: "#2b0533", light: "#ffffff" },
    })
      .then((data) => {
        if (!cancelled) setQr(data);
      })
      .catch(() => {
        if (!cancelled) setQr(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="overflow-hidden rounded-box border border-[#5F0B72]/25 bg-gradient-to-b from-[#5F0B72]/[0.07] to-transparent">
      {/* Computadora: QR para escanear con el celular. */}
      <div className="hidden justify-items-center gap-3 px-5 pb-5 pt-4 text-center sm:grid">
        <p className="text-base font-semibold text-ink">{t("addBalance.yapeQrTitle")}</p>
        <div className="relative size-[208px] rounded-[18px] bg-white p-2.5 shadow-[0_8px_28px_-10px_rgb(95_11_114_/_0.45)] ring-1 ring-[#5F0B72]/15">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URL generado en el navegador
            <img src={qr} alt={t("addBalance.yapeQrAlt")} className="size-full" draggable={false} />
          ) : (
            <div className="size-full animate-pulse rounded-[10px] bg-subtle motion-reduce:animate-none" />
          )}
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white p-1">
            <PaymentAppIcon app="yape" size="sm" />
          </span>
        </div>
        <p className="max-w-[18rem] text-[13px] leading-snug text-ink-2">
          {t("addBalance.yapeQrHint")}
        </p>
      </div>

      {/* Celular: abre Yape directo (enlace normal; window.open lo bloquea iOS). */}
      <div className="grid gap-2 p-4 sm:hidden">
        <a
          href={url}
          rel="noopener noreferrer"
          className={cn(
            "inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-ctl px-4 text-base font-semibold transition-colors",
            paymentAppButtonClass("yape"),
          )}
        >
          <PaymentAppIcon app="yape" size="sm" className="size-8!" />
          {amountLabel
            ? t("addBalance.yapePayNowAmount", { amount: amountLabel })
            : t("addBalance.yapePayNow")}
        </a>
        <p className="text-center text-xs text-ink-3">{t("addBalance.yapeMobileHint")}</p>
      </div>
    </div>
  );
}
