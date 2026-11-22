import "server-only";
import { resolveTikTokFinanceAccessToken } from "@/lib/integrations/tiktok/bc-finance.server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Invitaciones de clientes a un BM de TikTok.
 *
 * Se invita como miembro Estándar, sin rol financiero y solo con sus cuentas.
 * El cron revisa si aceptó; al aceptar se le asignan las cuentas (ADMIN de la
 * cuenta, nunca del BM). Si sigue pendiente, se reinvita cada 6 h hasta 8 veces.
 */

const API = "https://business-api.tiktok.com/open_api/v1.3";
export const REINVITE_AFTER_MS = 6 * 60 * 60 * 1000;
export const MAX_INVITES = 8;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type TikTokJson = { code?: number; message?: string; data?: Record<string, unknown> };

export type BcInviteRow = {
  id: string;
  bc_id: string;
  email: string;
  advertiser_ids: string[];
  status: string;
  invite_count: number;
  last_invited_at: string | null;
};

async function tiktok(path: string, token: string, body?: unknown): Promise<TikTokJson> {
  const res = await fetch(`${API}${path}`, {
    method: body ? "POST" : "GET",
    headers: { "Access-Token": token, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  // IDs grandes como string exacto (Number pierde precisión).
  return JSON.parse(await res.text(), (k, v, ctx?: { source?: string }) =>
    typeof v === "number" && /_id$/.test(k) && ctx?.source ? ctx.source : v,
  ) as TikTokJson;
}

function normEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Como TikTok muestra a un miembro ya aceptado: primera y última letra del usuario. */
function maskEmail(email: string): string {
  const [user = "", domain = ""] = email.split("@");
  return `${user.slice(0, 1)}***${user.slice(-1)}@${domain}`;
}

/** Manda la invitación a TikTok (Estándar, sin finanzas, con acceso ADMIN solo a esas cuentas). */
async function sendInvite(bcId: string, email: string, advertiserIds: string[], token: string) {
  const body: Record<string, unknown> = { bc_id: bcId, emails: [email], user_role: "STANDARD" };
  if (advertiserIds.length) {
    Object.assign(body, { asset_type: "ADVERTISER", asset_ids: advertiserIds, advertiser_role: "ADMIN" });
  }
  const j = await tiktok("/bc/member/invite/", token, body);
  return { ok: j.code === 0, message: j.code === 0 ? "OK" : String(j.message ?? "TikTok no envió la invitación") };
}

type BcMember = { email: string; status: string; userId: string | null };
const memberCache = new Map<string, { at: number; list: BcMember[] }>();

/** Todos los miembros del BM (el filtro por correo de TikTok no encuentra a los ya aceptados). */
async function listMembers(bcId: string, token: string): Promise<BcMember[]> {
  const cached = memberCache.get(bcId);
  if (cached && Date.now() - cached.at < 60_000) return cached.list;
  const list: BcMember[] = [];
  for (let page = 1; page <= 100; page++) {
    const j = await tiktok(`/bc/member/get/?bc_id=${bcId}&page=${page}&page_size=20`, token);
    if (j.code !== 0) throw new Error(`TikTok no devolvió los miembros: ${String(j.message ?? "")}`);
    const rows = (j.data?.list ?? []) as Array<Record<string, unknown>>;
    for (const m of rows) {
      list.push({
        email: normEmail(String(m.user_email ?? "")),
        status: String(m.relation_status ?? ""),
        userId: m.user_id ? String(m.user_id) : null,
      });
    }
    if (rows.length < 20) break;
  }
  memberCache.set(bcId, { at: Date.now(), list });
  return list;
}

/**
 * Estado del miembro en el BM: null si no figura.
 * Pendiente: TikTok muestra el correo completo. Aceptado (BOUND): lo enmascara ("p***4@gmail.com"),
 * así que solo se toma el enmascarado si ya no hay pendiente y es el único que coincide.
 */
async function findMember(bcId: string, email: string, token: string) {
  const list = await listMembers(bcId, token);
  const exact = list.find((m) => m.email === email);
  if (exact) return { status: exact.status, userId: exact.userId };
  const masked = list.filter((m) => m.email === maskEmail(email) && m.userId);
  if (masked.length === 1) return { status: masked[0]!.status, userId: masked[0]!.userId };
  return null;
}

async function assignAdvertiser(bcId: string, advertiserId: string, userId: string, token: string) {
  const j = await tiktok("/bc/asset/assign/", token, {
    bc_id: bcId,
    user_id: userId,
    asset_type: "ADVERTISER",
    asset_id: advertiserId,
    advertiser_role: "ADMIN",
  });
  return { ok: j.code === 0, message: j.code === 0 ? "OK" : String(j.message ?? "error") };
}

/**
 * Mientras el cliente no aceptaba, su cuenta del BM 200 se le compartió vía el BM 10
 * (socio). Al aceptar ya la tiene directo, así que se quita esa copia para que el BM 10
 * no muestre cuentas del BM 200.
 */
const TEMP_PARTNER_SHARES: Record<string, string[]> = {
  "7575005779271614480": ["7652451146933698576"], // BM 200 → BM 10
};

async function removeTempPartnerShares(bcId: string, advertiserIds: string[], token: string) {
  for (const partnerId of TEMP_PARTNER_SHARES[bcId] ?? []) {
    const j = await tiktok("/bc/partner/asset/delete/", token, {
      bc_id: bcId,
      partner_id: partnerId,
      asset_type: "ADVERTISER",
      asset_ids: advertiserIds,
    });
    if (j.code !== 0) {
      console.warn("[bc-invites] unshare_failed", { bcId, partnerId, message: j.message });
    }
  }
}

/**
 * Invita a un cliente a un BM con sus cuentas y lo deja en seguimiento.
 * Si ya hay una invitación pendiente al mismo correo en ese BM, le suma las cuentas.
 */
export async function inviteClienteToBc(input: {
  bcId: string;
  email: string;
  advertiserIds: string[];
  hecomClienteId?: string | null;
  organizationId?: string | null;
  createdBy?: string | null;
}): Promise<{ ok: boolean; message: string; inviteId: string | null }> {
  const email = normEmail(input.email);
  if (!EMAIL.test(email)) return { ok: false, message: "Correo inválido.", inviteId: null };
  const advertiserIds = [...new Set(input.advertiserIds.map(String).filter(Boolean))];
  const admin = createAdminClient();
  const { token } = await resolveTikTokFinanceAccessToken(input.organizationId ?? undefined);

  // Si ya es miembro activo, no hace falta invitar: se le asignan las cuentas al toque.
  const member = await findMember(input.bcId, email, token).catch(() => null);
  if (member?.userId && member.status !== "PENDING") {
    const results = await Promise.all(advertiserIds.map((a) => assignAdvertiser(input.bcId, a, member.userId!, token)));
    const failed = results.filter((r) => !r.ok);
    return { ok: failed.length === 0, message: failed.length ? failed.map((f) => f.message).join("; ") : "Ya era miembro: cuentas asignadas.", inviteId: null };
  }

  const { data: open } = await admin
    .from("tiktok_bc_invites")
    .select("id, advertiser_ids")
    .eq("bc_id", input.bcId)
    .eq("status", "pending")
    .ilike("email", email)
    .maybeSingle();

  const allIds = [...new Set([...((open?.advertiser_ids as string[] | null) ?? []), ...advertiserIds])];
  const sent = await sendInvite(input.bcId, email, allIds, token);
  const now = new Date().toISOString();

  if (open?.id) {
    await admin
      .from("tiktok_bc_invites")
      .update({ advertiser_ids: allIds, updated_at: now, last_error: sent.ok ? null : sent.message, ...(sent.ok ? { last_invited_at: now } : {}) })
      .eq("id", open.id);
    return { ok: sent.ok, message: sent.message, inviteId: open.id as string };
  }

  const { data: row, error } = await admin
    .from("tiktok_bc_invites")
    .insert({
      bc_id: input.bcId,
      email,
      advertiser_ids: allIds,
      hecom_cliente_id: input.hecomClienteId ?? null,
      organization_id: input.organizationId ?? null,
      invite_count: sent.ok ? 1 : 0,
      last_invited_at: sent.ok ? now : null,
      last_error: sent.ok ? null : sent.message,
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();
  if (error) console.warn("[bc-invites] insert_failed", { error: error.message });
  return { ok: sent.ok, message: sent.message, inviteId: (row?.id as string | undefined) ?? null };
}

/**
 * Cron: por cada invitación pendiente,
 * - si ya aceptó → asigna sus cuentas y la cierra;
 * - si pasaron 6 h → reinvita (hasta MAX_INVITES; después queda "failed").
 */
export async function processPendingBcInvites(): Promise<{
  checked: number;
  accepted: number;
  reinvited: number;
  failed: number;
}> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tiktok_bc_invites")
    .select("id, bc_id, email, advertiser_ids, status, invite_count, last_invited_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as BcInviteRow[];
  const summary = { checked: rows.length, accepted: 0, reinvited: 0, failed: 0 };
  if (rows.length === 0) return summary;
  const { token } = await resolveTikTokFinanceAccessToken();

  for (const row of rows) {
    const now = new Date();
    try {
      const member = await findMember(row.bc_id, row.email, token);

      if (member?.userId && member.status !== "PENDING") {
        const results = await Promise.all(row.advertiser_ids.map((a) => assignAdvertiser(row.bc_id, a, member.userId!, token)));
        const failed = results.filter((r) => !r.ok);
        await admin
          .from("tiktok_bc_invites")
          .update({
            status: failed.length ? "pending" : "accepted",
            accepted_at: failed.length ? null : now.toISOString(),
            tiktok_user_id: member.userId,
            last_error: failed.length ? failed.map((f) => f.message).join("; ") : null,
            updated_at: now.toISOString(),
          })
          .eq("id", row.id);
        if (!failed.length) {
          summary.accepted += 1;
          await removeTempPartnerShares(row.bc_id, row.advertiser_ids, token).catch(() => undefined);
        }
        continue;
      }

      const last = row.last_invited_at ? Date.parse(row.last_invited_at) : 0;
      if (now.getTime() - last < REINVITE_AFTER_MS) continue;

      if (row.invite_count >= MAX_INVITES) {
        await admin
          .from("tiktok_bc_invites")
          .update({ status: "failed", last_error: `No aceptó tras ${row.invite_count} invitaciones.`, updated_at: now.toISOString() })
          .eq("id", row.id);
        summary.failed += 1;
        continue;
      }

      const sent = await sendInvite(row.bc_id, row.email, row.advertiser_ids, token);
      await admin
        .from("tiktok_bc_invites")
        .update({
          invite_count: row.invite_count + (sent.ok ? 1 : 0),
          // Si TikTok rechaza el reenvío, igual se espera otras 6 h para no insistir cada corrida.
          last_invited_at: now.toISOString(),
          last_error: sent.ok ? null : sent.message,
          updated_at: now.toISOString(),
        })
        .eq("id", row.id);
      if (sent.ok) summary.reinvited += 1;
    } catch (err) {
      await admin
        .from("tiktok_bc_invites")
        .update({ last_error: err instanceof Error ? err.message : "error", updated_at: now.toISOString() })
        .eq("id", row.id);
    }
  }
  return summary;
}
