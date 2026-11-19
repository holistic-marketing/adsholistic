"use client";

import { useEffect, useId, useState } from "react";
import { useSearchParams } from "next/navigation";
import { depositFromDesiredCredit } from "@/lib/payments/deposit-fee";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Note } from "@/components/ui/PanelKit";
import { PanelIcon } from "@/components/ui/PanelIcon";

type CardConfig = { enabled: boolean; surchargePercent: number };
type CardProvider = "stripe" | "whop";

function usd(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Pago de deuda con tarjeta desde el link Lo pagado. Baja la deuda del mes, no recarga cartera.
 * Stripe si está activo; si no, Whop.
 */
export function PublicDebtCardPay({
  configUrl,
  apiBase,
  month,
  owedUsd,
}: {
  configUrl: string;
  /** Base de la API pública; se le agrega /stripe o /whop. */
  apiBase: string;
  month: string;
  /** Deuda del mes (positivo = debe). */
  owedUsd: number;
}) {
  const searchParams = useSearchParams();
  const returned = searchParams.get("pago") === "tarjeta";
  const [config, setConfig] = useState<(CardConfig & { provider: CardProvider }) | null>(null);
  const owedCents = Math.max(0, Math.round(owedUsd * 100));
  const [partial, setPartial] = useState(false);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amountId = useId();

  useEffect(() => {
    let alive = true;
    fetch(configUrl)
      .then((r) => r.json())
      .then((j: { whop?: CardConfig; stripe?: CardConfig }) => {
        if (!alive) return;
        if (j.stripe?.enabled) setConfig({ ...j.stripe, provider: "stripe" });
        else setConfig({ ...(j.whop ?? { enabled: false, surchargePercent: 0 }), provider: "whop" });
      })
      .catch(() => {
        if (alive) setConfig({ enabled: false, surchargePercent: 0, provider: "whop" });
      });
    return () => {
      alive = false;
    };
  }, [configUrl]);

  if (!config?.enabled) return null;

  const debtCents = partial ? Math.round(Number(amount) * 100) : owedCents;
  const valid = Number.isFinite(debtCents) && debtCents >= 100 && debtCents <= 5_000_000;
  const quote = valid ? depositFromDesiredCredit(debtCents, config.surchargePercent) : null;

  const monthLabel = new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-15T00:00:00Z`),
  );

  async function pay() {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/${config!.provider}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: debtCents / 100, periodoResumen: month }),
      });
      const j = (await res.json()) as { checkoutUrl?: string; error?: string };
      if (!res.ok || !j.checkoutUrl) throw new Error(j.error || "No se pudo abrir el pago con tarjeta.");
      window.location.href = j.checkoutUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo abrir el pago con tarjeta.");
      setBusy(false);
    }
  }

  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
      {returned ? (
        <Note tone="ok" icon="check-circle" className="mb-4">
          Recibimos tu pago con tarjeta. En unos minutos aparece abajo en tus pagos y baja lo que debes del mes.
        </Note>
      ) : null}
      <p className="eyebrow">Pagos</p>
      <h2 className="mt-1 text-base font-semibold leading-6 tracking-[-0.01em] text-ink">Pagar con tarjeta</h2>
      <p className="mt-1.5 max-w-xl text-ink-2">
        Con tarjeta de crédito o débito, sin subir voucher. Se registra al instante en {monthLabel} y no recarga
        cartera. La tarjeta tiene un recargo de {config.surchargePercent}%.
      </p>

      {owedCents > 0 ? (
        <div className="mt-4 inline-grid min-w-[14rem] rounded-box border border-line bg-field px-4 py-3">
          <p className="text-[13px] font-medium text-ink-2">Debes en {monthLabel}</p>
          <p className="mt-0.5 text-2xl font-semibold tracking-[-0.03em] text-ink tabular-nums">{usd(owedCents)}</p>
        </div>
      ) : (
        <Note tone="ok" className="mt-4">
          No tienes deuda en {monthLabel}. Si igual quieres abonar, usa “Abonar otro monto”.
        </Note>
      )}

      {partial ? (
        <div className="mt-4 grid w-full gap-1.5 sm:max-w-[14rem]">
          <label htmlFor={amountId} className="text-sm font-medium text-ink">
            Monto a abonar (USD)
          </label>
          <Input
            id={amountId}
            type="number"
            inputMode="decimal"
            min={1}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            autoFocus
            className="font-semibold tabular-nums pointer-coarse:h-11"
          />
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button size="lg" className="pointer-coarse:h-11" onClick={pay} disabled={!valid || busy}>
          {busy
            ? "Abriendo pago…"
            : partial
              ? quote
                ? `Abonar ${usd(quote.creditCents)} (pagas ${usd(quote.grossCents)})`
                : "Abonar con tarjeta"
              : quote
                ? `Pagar todo · ${usd(quote.grossCents)}`
                : "Pagar todo"}
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="pointer-coarse:h-11"
          onClick={() => {
            setPartial((v) => !v);
            setAmount("");
            setError(null);
          }}
        >
          {partial ? (owedCents > 0 ? "Mejor pagar todo" : "Cancelar") : "Abonar otro monto"}
        </Button>
      </div>
      {quote ? (
        <p className="mt-2 text-xs text-ink-2 tabular-nums">
          Deuda {usd(quote.creditCents)} + recargo tarjeta {usd(quote.feeCents)} = {usd(quote.grossCents)}
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-danger-fg" role="alert">
          <PanelIcon name="alert" className="mt-px size-3.5" />
          {error}
        </p>
      ) : null}
    </section>
  );
}
