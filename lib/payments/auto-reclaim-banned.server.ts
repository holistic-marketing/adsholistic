import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotificationBestEffort } from "@/lib/notifications/create-notification.server";
import { reclaimFromAdAccountWithTikTok } from "@/lib/payments/reclaim-with-tiktok.server";
import { isRecord } from "@/lib/records";

/**
 * Cuenta TikTok baneada con saldo sin gastar → cartera del cliente, solo.
 *
 * Regla: el saldo vuelve a cartera SOLO si TikTok lo suelta (REFUND en BM
 * cash, baja de presupuesto en BM de crédito). Si TikTok lo retiene:
 *  - retención temporal ("maximum amount you can transfer out is X"):
 *    se saca lo que deja ahora y se reintenta en la próxima vuelta;
 *  - cuenta castigada ("abnormal state") u otro fallo repetido: queda como
 *    "retenido por TikTok", se avisa una vez al cliente y soporte lo atiende.
 * Nunca se acredita en cartera algo que TikTok no devolvió.
 */

const SYSTEM_ACTOR = "system:auto-reclaim-banned";
const MAX_PER_RUN = 15;
/** Desde cuántos centavos vale la pena intentar (TikTok no deja sacar montos muy chicos). */
const MIN_RECLAIM_CENTS = 100;
/** Fallos genéricos antes de darlo por retenido. */
const MAX_GENERIC_ATTEMPTS = 3;
/** Espera entre intentos para la misma cuenta. */
const RETRY_AFTER_MS = 60 * 60 * 1000;

type AutoReclaimState = {
  /** legacy_skip: ya estaba baneada antes de activar esto (2026-11-19); no se toca. */
  status: "recovered" | "hold" | "retained" | "retrying" | "legacy_skip";
  attempts: number;
  last_attempt_at: string;
  last_error?: string | null;
  recovered_cents?: number;
  retained_notified_at?: string | null;
};

type Candidate = {
  id: string;
  organization_id: string;
  name: string;
  advertiser_id: string | null;
  metadata: Record<string, unknown>;
  available_cents: number;
};

export type AutoReclaimRunResult = {
  scanned: number;
  recovered: Array<{ adAccountId: string; cents: number }>;
  held: string[];
  retained: string[];
  skipped: number;
};

function usd(cents: number): string {
  return `USD ${(cents / 100).toFixed(2)}`;
}

function readState(metadata: Record<string, unknown>): AutoReclaimState | null {
  const raw = metadata.auto_reclaim;
  return isRecord(raw) ? (raw as unknown as AutoReclaimState) : null;
}

async function saveState(account: Candidate, state: AutoReclaimState): Promise<void> {
  const admin = createAdminClient();
  // Relee metadata para no pisar cambios del sync de TikTok.
  const { data } = await admin.from("ad_accounts").select("metadata").eq("id", account.id).maybeSingle();
  const current = isRecord(data?.metadata) ? data.metadata : {};
  await admin
    .from("ad_accounts")
    .update({ metadata: { ...current, auto_reclaim: state }, updated_at: new Date().toISOString() })
    .eq("id", account.id);
}

async function audit(account: Candidate, action: string, metadata: Record<string, unknown>) {
  await createAdminClient()
    .from("audit_logs")
    .insert({
      organization_id: account.organization_id,
      actor_user_id: null,
      action,
      entity_type: "ad_account",
      entity_id: account.id,
      metadata,
    })
    .then(
      () => undefined,
      () => undefined,
    );
}

async function loadCandidates(): Promise<Candidate[]> {
  const admin = createAdminClient();
  const { data: balances, error } = await admin
    .from("v_ad_account_ledger_balances")
    .select("ad_account_id, available_balance_cents")
    .gt("available_balance_cents", MIN_RECLAIM_CENTS - 1);
  if (error) throw new Error(error.message);
  const byId = new Map<string, number>(
    (balances ?? []).map((b) => [String(b.ad_account_id), Number(b.available_balance_cents)]),
  );
  if (byId.size === 0) return [];

  const { data: accounts, error: accErr } = await admin
    .from("ad_accounts")
    .select("id, organization_id, name, external_account_id, metadata, platform, status")
    .in("id", [...byId.keys()])
    .eq("status", "disabled");
  if (accErr) throw new Error(accErr.message);

  return (accounts ?? [])
    .filter((a) => String(a.platform ?? "tiktok").toLowerCase() === "tiktok")
    .map((a) => ({
      id: a.id,
      organization_id: a.organization_id,
      name: a.name,
      advertiser_id: a.external_account_id ?? null,
      metadata: isRecord(a.metadata) ? a.metadata : {},
      available_cents: byId.get(a.id) ?? 0,
    }));
}

function parseTransferOutCap(message: string): number | null {
  const m = /maximum amount you can transfer out is ([\d.]+)/i.exec(message);
  if (!m) return null;
  const cents = Math.floor(Number(m[1]) * 100);
  return Number.isFinite(cents) ? cents : null;
}

async function notifyRecovered(account: Candidate, cents: number, partial: boolean) {
  await createNotificationBestEffort({
    organizationId: account.organization_id,
    title: "Recuperamos tu saldo a cartera",
    body: partial
      ? `TikTok suspendió tu cuenta "${account.name}". Ya pasamos ${usd(cents)} a tu cartera y el resto lo seguimos recuperando automáticamente.`
      : `TikTok suspendió tu cuenta "${account.name}". Pasamos los ${usd(cents)} que no se gastaron a tu cartera; ya puedes asignarlos a otra cuenta.`,
    type: "ad_account_balance_recovered",
    data: { ad_account_id: account.id, amount_cents: cents, url: "/payments" },
  });
}

async function notifyRetained(account: Candidate, cents: number) {
  await createNotificationBestEffort({
    organizationId: account.organization_id,
    title: "Tu saldo quedó retenido por TikTok",
    body: `TikTok suspendió tu cuenta "${account.name}" y retuvo ${usd(cents)} que no se habían gastado. Tu dinero no se perdió: soporte ya está atendiendo tu caso y, apenas TikTok lo libere, vuelve a tu cartera. No necesitas hacer nada.`,
    type: "ad_account_balance_retained",
    data: { ad_account_id: account.id, amount_cents: cents, url: "/support" },
  });
}

function escapeHtml(v: string): string {
  return v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Correo a gerentes (los mismos de vouchers): saldo que TikTok no soltó. */
async function emailStaffRetained(account: Candidate, cents: number, reason: string, error: string) {
  try {
    const { resolveManualPaymentManagerEmails } = await import("@/lib/email/manual-payment-notify.server");
    const { sendTransactionalEmail } = await import("@/lib/email/email.server");
    const managers = await resolveManualPaymentManagerEmails();
    const meta = account.metadata;
    const cliente = String(meta.hecom_cliente_name ?? "").trim() || "Cliente sin nombre";
    const advertiserId = account.advertiser_id ?? "";
    const motivo = reason === "tiktok_punished" ? "Cuenta castigada por TikTok (estado anormal)" : "TikTok no dejó sacar el saldo tras varios intentos";
    const subject = `Saldo retenido por TikTok: ${cliente} · ${usd(cents)}`;
    const rows: Array<[string, string]> = [
      ["Cliente", cliente],
      ["Cuenta", account.name],
      ["Saldo retenido", usd(cents)],
      ["Motivo", motivo],
      ["Detalle TikTok", error.slice(0, 200)],
    ];
    if (advertiserId) rows.splice(2, 0, ["ID TikTok", advertiserId]);
    const html = `<div style="font-family:system-ui,sans-serif;color:#1c1917;max-width:560px">
<h2 style="margin:0 0 8px;font-size:18px">Saldo retenido por TikTok</h2>
<p style="margin:0 0 16px;color:#57534e;font-size:14px">La cuenta se baneó y TikTok no soltó el saldo sin gastar. No se acreditó nada en la cartera del cliente; ya se le avisó que soporte lo atiende.</p>
<table style="border-collapse:collapse;font-size:14px;width:100%">${rows
      .map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#78716c;white-space:nowrap">${k}</td><td style="padding:6px 0;font-weight:600">${escapeHtml(v)}</td></tr>`)
      .join("")}</table>
<p style="margin:16px 0 0;font-size:14px"><b>Qué hacer:</b> gestionar con TikTok (apelación o soporte). Cuando lo liberen, recuperar el saldo desde Pagos → "Recuperar a saldo disponible".</p>
</div>`;
    const text = [
      "Saldo retenido por TikTok",
      ...rows.map(([k, v]) => `${k}: ${v}`),
      "Qué hacer: gestionar con TikTok; cuando lo liberen, recuperar desde Pagos.",
    ].join("\n");
    // Un correo por gerente, de a dos por segundo (límite de Resend).
    for (let i = 0; i < managers.length; i += 2) {
      if (i > 0) await new Promise((r) => setTimeout(r, 1000));
      await Promise.allSettled(
        managers.slice(i, i + 2).map((to) =>
          sendTransactionalEmail({
            to,
            subject,
            html,
            text,
            templateKey: "ad_account.balance_retained.staff",
            organizationId: account.organization_id,
            idempotencyKey: `email:auto_reclaim_retained:${account.id}:${to}`,
            metadata: { ad_account_id: account.id, amount_cents: cents, reason },
          }),
        ),
      );
    }
  } catch (err) {
    console.error("[auto-reclaim] staff email failed", account.id, err);
  }
}

async function processAccount(
  account: Candidate,
  result: AutoReclaimRunResult,
): Promise<void> {
  const prev = readState(account.metadata);
  const now = Date.now();

  // Ya retenida y avisada (soporte la atiende) o baneada antes de activar esto.
  if (prev?.status === "retained" || prev?.status === "legacy_skip") {
    result.skipped += 1;
    return;
  }
  // Sin nada que recuperar la última vez (gastado en TikTok): revisar una vez al día.
  const waitMs = prev?.status === "recovered" ? 24 * RETRY_AFTER_MS : RETRY_AFTER_MS;
  if (prev && now - Date.parse(prev.last_attempt_at) < waitMs) {
    result.skipped += 1;
    return;
  }

  const attempts = (prev?.attempts ?? 0) + 1;
  const attemptAt = new Date(now).toISOString();
  const reclaim = (amountCents?: number) =>
    reclaimFromAdAccountWithTikTok({
      organizationId: account.organization_id,
      adAccountId: account.id,
      amountCents,
      requestedBy: SYSTEM_ACTOR,
      idempotencyKey: `auto-reclaim:${account.id}:${attemptAt}${amountCents ? `:${amountCents}` : ""}`,
    });

  try {
    // Si TikTok tenía menos que el ledger, la diferencia ya se gastó: es todo lo recuperable.
    const done = await reclaim();
    const partial = false;
    await saveState(account, {
      status: "recovered",
      attempts: 0,
      last_attempt_at: attemptAt,
      last_error: null,
      recovered_cents: (prev?.recovered_cents ?? 0) + done.amountCents,
    });
    await audit(account, "ad_account.auto_reclaim.recovered", {
      cents: done.amountCents,
      path: done.path,
      journal_id: done.journalId,
      partial,
    });
    await notifyRecovered(account, done.amountCents, partial);
    result.recovered.push({ adAccountId: account.id, cents: done.amountCents });
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Retención temporal: saca lo que TikTok deja ahora, el resto en la próxima vuelta.
    const cap = parseTransferOutCap(message);
    if (cap != null) {
      let recoveredNow = 0;
      if (cap >= MIN_RECLAIM_CENTS) {
        try {
          const partial = await reclaim(Math.min(cap, account.available_cents));
          recoveredNow = partial.amountCents;
          await audit(account, "ad_account.auto_reclaim.recovered", {
            cents: recoveredNow,
            path: partial.path,
            journal_id: partial.journalId,
            partial: true,
          });
          await notifyRecovered(account, recoveredNow, true);
          result.recovered.push({ adAccountId: account.id, cents: recoveredNow });
        } catch (inner) {
          console.warn("[auto-reclaim] partial failed", account.id, inner);
        }
      }
      await saveState(account, {
        status: "hold",
        attempts,
        last_attempt_at: attemptAt,
        last_error: message.slice(0, 300),
        recovered_cents: (prev?.recovered_cents ?? 0) + recoveredNow,
      });
      result.held.push(account.id);
      return;
    }

    // Saldo ya gastado en TikTok: nada que recuperar ni avisar.
    if (/no tiene saldo disponible|No quedó monto recuperable|no tiene saldo Holistic recuperable/i.test(message)) {
      await saveState(account, {
        status: "recovered",
        attempts: 0,
        last_attempt_at: attemptAt,
        last_error: message.slice(0, 300),
        recovered_cents: prev?.recovered_cents ?? 0,
      });
      result.skipped += 1;
      return;
    }

    const punished = /abnormal state/i.test(message);
    if (punished || attempts >= MAX_GENERIC_ATTEMPTS) {
      await saveState(account, {
        status: "retained",
        attempts,
        last_attempt_at: attemptAt,
        last_error: message.slice(0, 300),
        recovered_cents: prev?.recovered_cents ?? 0,
        retained_notified_at: attemptAt,
      });
      await audit(account, "ad_account.auto_reclaim.retained", {
        cents: account.available_cents,
        reason: punished ? "tiktok_punished" : "repeated_failure",
        error: message.slice(0, 300),
      });
      await notifyRetained(account, account.available_cents);
      await emailStaffRetained(
        account,
        account.available_cents,
        punished ? "tiktok_punished" : "repeated_failure",
        message,
      );
      result.retained.push(account.id);
      return;
    }

    await saveState(account, {
      status: "retrying",
      attempts,
      last_attempt_at: attemptAt,
      last_error: message.slice(0, 300),
      recovered_cents: prev?.recovered_cents ?? 0,
    });
    result.held.push(account.id);
  }
}

/** Cuenta que volvió a estar activa: se limpia la marca para que un baneo futuro sí se procese. */
async function clearReactivated(): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("ad_accounts")
    .select("id, metadata")
    .neq("status", "disabled")
    .not("metadata->auto_reclaim", "is", null)
    .limit(200);
  for (const row of data ?? []) {
    if (!isRecord(row.metadata)) continue;
    const { auto_reclaim: _drop, ...rest } = row.metadata;
    void _drop;
    await admin.from("ad_accounts").update({ metadata: rest }).eq("id", row.id);
  }
}

export async function runAutoReclaimBanned(): Promise<AutoReclaimRunResult> {
  const result: AutoReclaimRunResult = { scanned: 0, recovered: [], held: [], retained: [], skipped: 0 };
  await clearReactivated().catch((error) => console.warn("[auto-reclaim] clear failed", error));
  const candidates = (await loadCandidates()).slice(0, MAX_PER_RUN);
  result.scanned = candidates.length;
  for (const account of candidates) {
    try {
      await processAccount(account, result);
    } catch (error) {
      console.error("[auto-reclaim] account failed", account.id, error);
    }
  }
  // Rastro de cada corrida (también cuando no hay nada que hacer).
  await createAdminClient()
    .from("audit_logs")
    .insert({
      action: "ad_account.auto_reclaim.run",
      entity_type: "auto_reclaim",
      metadata: {
        scanned: result.scanned,
        recovered: result.recovered.length,
        held: result.held.length,
        retained: result.retained.length,
        skipped: result.skipped,
      },
    })
    .then(
      () => undefined,
      () => undefined,
    );
  return result;
}
