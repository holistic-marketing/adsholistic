/**
 * Aviso al cliente cuando su comprobante NO se acredita automáticamente.
 *
 * Regla: solo se acredita solo si la boleta cuadra exacto con el monto pedido,
 * la cuenta destino y el titular. Si algo no cuadra, el saldo no se toca, el
 * comprobante pasa a soporte y el cliente ve un mensaje claro de qué pasó.
 * Sin "server-only": el modal usa los mismos tipos.
 */

export type VoucherReviewKind =
  | "amount_mismatch"
  | "destination_mismatch"
  | "not_receipt"
  | "unreadable"
  | "duplicate"
  | "review";

export type VoucherReviewNotice = {
  kind: VoucherReviewKind;
  title: string;
  message: string;
  tip: string | null;
  /** Solo en amount_mismatch: lo que ingresó vs lo que dice la boleta. */
  enteredAmount: number | null;
  voucherAmount: number | null;
  currency: "PEN" | "USD" | null;
};

type AnalysisLike = {
  detectedAmount: number | null;
  detectedCurrency: "PEN" | "USD" | null;
  destinationVerified?: boolean;
  receiptScreeningPassed?: boolean;
  visualAssessment?: "clear" | "suspicious" | "unreadable" | "not_receipt" | "unknown";
  criticalFieldsReadable?: boolean;
  currencyConsistent?: boolean;
  reason: string;
};

export function formatChargeAmount(amount: number, currency: "PEN" | "USD"): string {
  const n = amount.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency === "PEN" ? `S/ ${n}` : `USD ${n}`;
}

export function buildVoucherReviewNotice(input: {
  analysis: AnalysisLike;
  expectedAmount: number;
  expectedCurrency: "PEN" | "USD";
  duplicate: boolean;
}): VoucherReviewNotice {
  const { analysis: a, expectedAmount, expectedCurrency } = input;
  const base = { enteredAmount: null, voucherAmount: null, currency: null } as const;

  if (input.duplicate) {
    return {
      ...base,
      kind: "duplicate",
      title: "Este comprobante ya fue usado",
      message:
        "La boleta que enviaste ya se registró en otra recarga, así que no pudimos acreditar el saldo. Soporte revisará tu caso y te contactará.",
      tip: "Cada transferencia se usa una sola vez. Si hiciste un pago nuevo, sube su propio comprobante.",
    };
  }

  if (a.visualAssessment === "not_receipt") {
    return {
      ...base,
      kind: "not_receipt",
      title: "Esto no parece un comprobante de pago",
      message:
        "La imagen que enviaste no es un comprobante de transferencia, así que no pudimos acreditar el saldo. Soporte revisará tu caso y te contactará.",
      tip: "Sube la captura completa de la operación, donde se vea el monto, la cuenta destino y el número de operación.",
    };
  }

  const screeningOk = a.receiptScreeningPassed !== false;
  if (screeningOk && a.destinationVerified === false) {
    return {
      ...base,
      kind: "destination_mismatch",
      title: "La cuenta o el titular no coinciden",
      message:
        "Tu comprobante muestra un pago a una cuenta o a un nombre distinto al de Holistic Marketing, así que no pudimos acreditar el saldo. Soporte revisará tu caso y te contactará.",
      tip: "Antes de transferir, revisa que la cuenta destino y el titular sean exactamente los que te mostramos.",
    };
  }

  const detected = a.detectedAmount;
  const sameCurrency = a.detectedCurrency == null || a.detectedCurrency === expectedCurrency;
  const amountDiffers =
    detected != null && (Math.round(detected * 100) !== Math.round(expectedAmount * 100) || !sameCurrency);
  if (screeningOk && amountDiffers) {
    const voucherCurrency = a.detectedCurrency ?? expectedCurrency;
    return {
      kind: "amount_mismatch",
      title: "El monto no coincide con tu boleta",
      message: `Ingresaste ${formatChargeAmount(expectedAmount, expectedCurrency)}, pero tu boleta dice ${formatChargeAmount(detected, voucherCurrency)}. Por seguridad no acreditamos el saldo: tu comprobante pasó a verificación de soporte y te avisaremos cuando quede listo.`,
      tip: "Para la próxima, ingresa exactamente el monto que vas a transferir y así se acredita al instante.",
      enteredAmount: expectedAmount,
      voucherAmount: detected,
      currency: voucherCurrency === expectedCurrency ? expectedCurrency : null,
    };
  }

  if (a.visualAssessment === "unreadable" || a.criticalFieldsReadable === false) {
    return {
      ...base,
      kind: "unreadable",
      title: "No pudimos leer tu comprobante",
      message:
        "No se ven todos los datos de la boleta, así que no pudimos acreditar el saldo automáticamente. Soporte revisará tu comprobante y te avisaremos.",
      tip: "Sube la captura completa y nítida, sin recortes, donde se lean el monto y el número de operación.",
    };
  }

  return {
    ...base,
    kind: "review",
    title: "Tu comprobante está en revisión",
    message: `${a.reason || "No pudimos validar el comprobante automáticamente."} El saldo se acredita apenas soporte lo confirme. No vuelvas a pagar.`.replace(
      /\s+/g,
      " ",
    ),
    tip: null,
  };
}
