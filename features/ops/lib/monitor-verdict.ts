import type { ClienteModalidad, MonitorCliente } from "@/features/ops/types/prepago-monitor";

/**
 * Veredicto en palabras simples para soporte: qué pasa y qué hacer.
 * Depende del tipo de cliente que marcó gerencia (prepago o con acuerdo).
 */

export type VerdictKey = "quitar_saldo" | "preguntar" | "cobrar" | "acuerdo" | "ok";

export type Verdict = {
  key: VerdictKey;
  /** Etiqueta corta (chip). */
  label: string;
  /** Una frase: qué pasa. */
  headline: string;
  /** Pasos numerados: qué hacer. */
  steps: string[];
};

export const VERDICT_ORDER: VerdictKey[] = ["quitar_saldo", "preguntar", "cobrar", "acuerdo", "ok"];

export const VERDICT_META: Record<
  VerdictKey,
  { label: string; short: string; dot: string; chip: string; ring: string; text: string; soft: string }
> = {
  quitar_saldo: {
    label: "Error: quitar saldo",
    short: "Quitar saldo",
    dot: "bg-accent",
    chip: "bg-subtle text-danger-fg",
    ring: "ring-danger-line",
    text: "text-danger-fg",
    soft: "bg-field",
  },
  preguntar: {
    label: "Preguntar al gerente",
    short: "Preguntar",
    dot: "bg-accent",
    chip: "bg-accent-soft text-accent-text",
    ring: "ring-accent-line",
    text: "text-accent-text",
    soft: "bg-field",
  },
  cobrar: {
    label: "Cobrar deuda",
    short: "Cobrar",
    dot: "bg-warn-solid",
    chip: "bg-warn-bg text-warn-fg",
    ring: "ring-warn-line",
    text: "text-warn-fg",
    soft: "bg-field",
  },
  acuerdo: {
    label: "Tiene acuerdo: solo vigilar",
    short: "Con acuerdo",
    dot: "bg-info-solid",
    chip: "bg-subtle text-info-fg",
    ring: "ring-info-line",
    text: "text-info-fg",
    soft: "bg-field",
  },
  ok: {
    label: "Todo bien",
    short: "Todo bien",
    dot: "bg-ok-solid",
    chip: "bg-subtle text-ok-fg",
    ring: "ring-ok-line",
    text: "text-ok-fg",
    soft: "bg-field",
  },
};

const money = (v: number) =>
  `$${(Number(v) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function verdictFor(cliente: MonitorCliente, modalidad: ClienteModalidad): Verdict {
  const real = cliente.signals.filter((s) => s.severity !== "info");
  const sum = (kinds: string[]) =>
    real.filter((s) => kinds.includes(s.kind)).reduce((t, s) => t + (Number(s.amountUsd) || 0), 0);
  const debt = Math.max(0, cliente.month.debtUsd);
  const exposure = cliente.exposureUsd;
  const unlimited = cliente.unlimitedAccounts > 0;

  if (real.length === 0) {
    return {
      key: "ok",
      label: VERDICT_META.ok.label,
      headline: "Solo puede gastar lo que pagó. No hay nada que hacer.",
      steps: [],
    };
  }

  if (modalidad === "acuerdo") {
    const parts: string[] = [];
    if (debt > 0) parts.push(`debe ${money(debt)} este mes`);
    if (exposure > 0) parts.push(`tiene ${money(exposure)} cargados sin pagar todavía`);
    return {
      key: "acuerdo",
      label: VERDICT_META.acuerdo.label,
      headline: `Este cliente paga después (acuerdo con gerencia). Es normal que ${parts.join(" y ") || "tenga saldo sin pagar"}.`,
      steps: [
        "No quitarle saldo ni pausarle campañas.",
        "Si la deuda sigue subiendo y no paga en la fecha acordada, avisar al gerente.",
      ],
    };
  }

  // Prepago: alguien le puso saldo sin que el cliente pagara.
  const staffMoves = sum(["staff_recharge", "tiktok_import", "manual_bc_load"]);
  if (staffMoves > 0) {
    return {
      key: "preguntar",
      label: VERDICT_META.preguntar.label,
      headline: `Alguien le cargó ${money(staffMoves)} de saldo sin que el cliente pagara.`,
      steps: [
        "Preguntar al gerente si esa carga estaba autorizada.",
        `Si NO estaba autorizada: quitarle ese saldo con «Frenar gasto», aquí abajo${exposure > 0 ? ` (hoy puede gastar ${money(exposure)} sin pagar)` : ""}.`,
        "Si SÍ estaba autorizada: que el gerente lo marque como «Paga después (tiene acuerdo)».",
      ],
    };
  }

  // Prepago: puede gastar plata que no pagó (error del sistema).
  if (exposure > 1 || unlimited) {
    return {
      key: "quitar_saldo",
      label: VERDICT_META.quitar_saldo.label,
      headline: unlimited
        ? "Tiene una cuenta sin tope: puede gastar sin límite aunque no pague."
        : `Puede gastar ${money(exposure)} que no pagó. Es un error: un prepago solo gasta lo que recargó.`,
      steps: [
        unlimited
          ? "Ponerle tope: en «Frenar gasto», aquí abajo, dale «Dejar en $0» a la cuenta sin tope."
          : `Quitarle ${money(exposure)} con «Frenar gasto», aquí abajo.`,
        debt > 0 ? `Además debe ${money(debt)} este mes: cobrarle.` : "Cuando se quite el saldo, esta alerta desaparece sola.",
      ],
    };
  }

  // Prepago: ya gastó de más este mes.
  if (debt > 0) {
    return {
      key: "cobrar",
      label: VERDICT_META.cobrar.label,
      headline: `Gastó ${money(debt)} más de lo que pagó este mes y es prepago (no tiene acuerdo).`,
      steps: [
        `Cobrarle ${money(debt)}.`,
        "Avisar al gerente: un prepago no debería poder gastar de más, hay que revisar por qué pasó.",
      ],
    };
  }

  return {
    key: "ok",
    label: VERDICT_META.ok.label,
    headline: "Solo puede gastar lo que pagó. No hay nada que hacer.",
    steps: [],
  };
}
