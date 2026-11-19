"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { depositFromDesiredCredit } from "@/lib/payments/deposit-fee";

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
    <section className="rounded-card bg-surface p-5 ring-1 ring-line sm:p-6">
      {returned ? (
        <p className="mb-4 rounded-card bg-field px-4 py-3 text-[13px] leading-5 text-ok-fg ring-1 ring-ok-line">
          Recibimos tu pago con tarjeta. En unos minutos aparece abajo en tus pagos y baja lo que debes del mes.
        </p>
      ) : null}
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-text">Pagos</p>
      <h2 className="mt-1 text-[1.35rem] font-semibold leading-tight tracking-[-0.03em] text-ink sm:text-[1.5rem]">
        Pagar con tarjeta
      </h2>
      <p className="mt-2 max-w-xl text-[13px] leading-5 text-ink">
        Con tarjeta de crédito o débito, sin subir voucher. Se registra al instante en {monthLabel} y no recarga
        cartera. La tarjeta tiene un recargo de {config.surchargePercent}%.
      </p>

      {owedCents > 0 ? (
        <div className="mt-4 rounded-card bg-field px-4 py-3 ring-1 ring-line">
          <p className="text-[12px] font-semibold text-ink-2">Debes en {monthLabel}</p>
          <p className="text-[1.6rem] font-semibold tracking-[-0.03em] text-ink">{usd(owedCents)}</p>
        </div>
      ) : (
        <p className="mt-4 rounded-card bg-field px-4 py-3 text-[13px] text-ok-fg ring-1 ring-ok-line">
          No tienes deuda en {monthLabel}. Si igual quieres abonar, usa “Abonar otro monto”.
        </p>
      )}

      {partial ? (
        <label className="mt-4 block w-full sm:max-w-[14rem]">
          <span className="text-[12px] font-semibold text-ink-2">Monto a abonar (USD)</span>
          <input
            type="number"
            inputMode="decimal"
            min={1}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            autoFocus
            className="mt-1 h-11 w-full rounded-box bg-surface px-3 text-[15px] font-semibold text-ink ring-1 ring-line outline-none focus:ring-2 focus:ring-accent"
          />
        </label>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={pay}
          disabled={!valid || busy}
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-accent-btn px-5 text-[13px] font-semibold text-on-accent transition hover:bg-accent-btn-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy
            ? "Abriendo pago…"
            : partial
              ? quote
                ? `Abonar ${usd(quote.creditCents)} (pagas ${usd(quote.grossCents)})`
                : "Abonar con tarjeta"
              : quote
                ? `Pagar todo · ${usd(quote.grossCents)}`
                : "Pagar todo"}
        </button>
        <button
          type="button"
          onClick={() => {
            setPartial((v) => !v);
            setAmount("");
            setError(null);
          }}
          className="inline-flex h-11 items-center justify-center rounded-full px-4 text-[13px] font-semibold text-accent-text ring-1 ring-accent-line transition hover:bg-field"
        >
          {partial ? (owedCents > 0 ? "Mejor pagar todo" : "Cancelar") : "Abonar otro monto"}
        </button>
      </div>
      {quote ? (
        <p className="mt-2 text-[12px] text-ink-2">
          Deuda {usd(quote.creditCents)} + recargo tarjeta {usd(quote.feeCents)} = {usd(quote.grossCents)}
        </p>
      ) : null}
      {error ? <p className="mt-2 text-[12px] font-medium text-danger-fg">{error}</p> : null}
    </section>
  );
}
