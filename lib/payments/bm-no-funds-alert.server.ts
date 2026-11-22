import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTransactionalEmail } from "@/lib/email/email.server";
import { resolveManualPaymentManagerEmails } from "@/lib/email/manual-payment-notify.server";
import { escapeHtml, wrapInternalEmail } from "@/lib/email/templates/layout";

/**
 * Avisa a gerencia por correo cuando un cliente no pudo asignar saldo porque el
 * BM de la agencia no tiene fondos. Al cliente solo se le dice que un asesor lo
 * revisa; sin este aviso nadie se enteraba (Jorge Zerda, BM 300 con $0.70, 22/11).
 * Un aviso por BM cada 2 h: si varios clientes chocan con el mismo BM vacío,
 * no llega un correo por intento.
 */
const AUDIT_ACTION = "tiktok.bm_no_funds_alert";
const REALERT_AFTER_HOURS = 2;
const MANAGER_EMAILS_PER_SECOND = 2;

/** Mensajes de bc-finance cuando el BM no tiene cash/cupones para el monto. */
export function isBmNoFundsError(message: string): boolean {
  return /^Este BM\b|Este Business Center no tiene/i.test(message.trim());
}

export async function alertBmNoFundsBestEffort(input: {
  bcId: string;
  bmBucket: string | null;
  advertiserId: string;
  accountName: string | null;
  amountCents: number;
  tiktokMessage: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const since = new Date(Date.now() - REALERT_AFTER_HOURS * 3_600_000).toISOString();
    const { data: recent, error: recentError } = await admin
      .from("audit_logs")
      .select("metadata")
      .eq("action", AUDIT_ACTION)
      .gte("created_at", since)
      .limit(50);
    // Si no se puede revisar, no se manda: mejor un aviso menos que uno por intento.
    if (recentError) return;
    if ((recent ?? []).some((r) => (r.metadata as { bc_id?: string } | null)?.bc_id === input.bcId)) {
      return;
    }

    const managers = await resolveManualPaymentManagerEmails();
    if (managers.length === 0) return;

    const bm = input.bmBucket ? `BM ${input.bmBucket}` : `BC ${input.bcId}`;
    const amount = (input.amountCents / 100).toFixed(2);
    const account = input.accountName?.trim() || input.advertiserId;
    // El detalle técnico ("Este BM solo tiene ~$0.70…") sin la frase para el cliente.
    const detail = input.tiktokMessage.replace(/\s*Tu saldo sigue en la cartera Holistic\.?/i, "").trim();

    const subject = `[Urgente] ${bm} sin fondos: un cliente no pudo asignar ${amount} USD`;
    const bodyHtml = `
      <p style="margin:0;font-size:24px;line-height:1.25;font-weight:700;color:#1a1917;">${escapeHtml(bm)} se quedó sin fondos</p>
      <p style="margin:10px 0 24px;font-size:15px;line-height:1.5;color:#57524b;">Un cliente intentó asignar saldo y TikTok no lo aceptó porque el BM no tiene cash. Su plata volvió sola a su cartera. Al cliente se le dijo que un asesor lo revisa: carguen cash en el BM y avísenle que vuelva a asignar.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr><td style="padding:8px 12px 8px 0;font-size:13px;color:#57524b;">Cuenta</td><td style="padding:8px 0;font-size:14px;color:#1a1917;">${escapeHtml(account)}<br /><span style="font-size:12px;color:#57524b;">ID ${escapeHtml(input.advertiserId)}</span></td></tr>
        <tr><td style="padding:8px 12px 8px 0;font-size:13px;color:#57524b;border-top:1px solid #e8e4dd;">Monto</td><td style="padding:8px 0;font-size:14px;color:#1a1917;border-top:1px solid #e8e4dd;">${escapeHtml(amount)} USD</td></tr>
        <tr><td style="padding:8px 12px 8px 0;font-size:13px;color:#57524b;border-top:1px solid #e8e4dd;">BM</td><td style="padding:8px 0;font-size:14px;color:#1a1917;border-top:1px solid #e8e4dd;">${escapeHtml(bm)} · ${escapeHtml(input.bcId)}</td></tr>
        <tr><td style="padding:8px 12px 8px 0;font-size:13px;color:#57524b;border-top:1px solid #e8e4dd;">TikTok dijo</td><td style="padding:8px 0;font-size:14px;color:#8f1d12;border-top:1px solid #e8e4dd;">${escapeHtml(detail)}</td></tr>
      </table>`;
    const html = wrapInternalEmail({
      label: "Fondos BM",
      preview: subject,
      bodyHtml,
      footerNote: "Holistic Marketing · aviso interno para gerencia · máximo un aviso por BM cada 2 horas",
    });
    const text = [
      subject,
      `Cuenta: ${account} (ID ${input.advertiserId})`,
      `Monto: ${amount} USD`,
      `${bm} (${input.bcId})`,
      `TikTok dijo: ${detail}`,
      "La plata volvió a la cartera del cliente. Carguen cash en el BM y avísenle que vuelva a asignar.",
    ].join("\n");

    // Llave por BM y ventana de 2 h: aunque falle el registro, no se duplica en la misma ventana.
    const window = Math.floor(Date.now() / (REALERT_AFTER_HOURS * 3_600_000));
    let sent = 0;
    for (let i = 0; i < managers.length; i += MANAGER_EMAILS_PER_SECOND) {
      if (i > 0) await new Promise((resolve) => setTimeout(resolve, 1000));
      const batch = await Promise.allSettled(
        managers.slice(i, i + MANAGER_EMAILS_PER_SECOND).map((to) =>
          sendTransactionalEmail({
            to,
            subject,
            html,
            text,
            templateKey: "ops.tiktok_bm_no_funds.alert",
            idempotencyKey: `email:tiktok_bm_no_funds:${input.bcId}:${window}:${to}`,
            metadata: { bc_id: input.bcId, advertiser_id: input.advertiserId, amount_cents: input.amountCents },
          }),
        ),
      );
      sent += batch.filter((r) => r.status === "fulfilled").length;
    }
    if (sent === 0) return;

    await admin.from("audit_logs").insert({
      action: AUDIT_ACTION,
      entity_type: "ad_accounts",
      metadata: {
        bc_id: input.bcId,
        bm_bucket: input.bmBucket,
        advertiser_id: input.advertiserId,
        amount_cents: input.amountCents,
        tiktok_message: detail.slice(0, 300),
      },
    });
  } catch (error) {
    console.error("[payments/bm-no-funds-alert] failed", {
      bcId: input.bcId,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}
