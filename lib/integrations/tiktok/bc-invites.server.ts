import "server-only";
import { resolveTikTokFinanceAccessToken } from "@/lib/integrations/tiktok/bc-finance.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTransactionalEmail } from "@/lib/email/email.server";
import { resolveManualPaymentManagerEmails } from "@/lib/email/manual-payment-notify.server";
import { escapeHtml, wrapInternalEmail } from "@/lib/email/templates/layout";

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

type AdvertiserPixel = { pixelId: string; code: string; name: string };

async function listAdvertiserPixels(advertiserId: string, token: string): Promise<AdvertiserPixel[]> {
  const j = await tiktok(`/pixel/list/?advertiser_id=${advertiserId}&page=1&page_size=50`, token);
  if (j.code !== 0) throw new Error(`No se pudieron leer los píxeles de ${advertiserId}: ${String(j.message ?? "")}`);
  const pixels = (j.data?.pixels ?? []) as Array<Record<string, unknown>>;
  return pixels.map((p) => ({
    pixelId: String(p.pixel_id ?? ""),
    code: String(p.pixel_code ?? ""),
    name: String(p.pixel_name ?? ""),
  }));
}

/**
 * Píxeles que ve un BM: código → nombre del BM dueño ("" si el dueño es una
 * cuenta publicitaria; TikTok lo devuelve vacío en ese caso).
 */
async function listBcPixels(bcId: string, token: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let page = 1; page <= 40; page++) {
    const j = await tiktok(`/bc/pixel/get/?bc_id=${bcId}&page=${page}&page_size=50`, token);
    if (j.code !== 0) throw new Error(`No se pudieron leer los píxeles del BM ${bcId}: ${String(j.message ?? "")}`);
    const rows = (j.data?.list ?? []) as Array<Record<string, unknown>>;
    for (const r of rows) out.set(String(r.pixel_code ?? ""), String(r.owner_bc_name ?? ""));
    if (rows.length < 50) break;
  }
  return out;
}

async function bcName(bcId: string, token: string): Promise<string> {
  const j = await tiktok(`/bc/get/?bc_id=${bcId}`, token);
  const list = (j.data?.list ?? []) as Array<{ bc_info?: { name?: string } }>;
  return String(list[0]?.bc_info?.name ?? "");
}

/**
 * Los píxeles que la cuenta usaba vía el BM socio (BM 10) dejan de verse al quitar lo
 * compartido (Robinson, 23/11: su cuenta 200 quedó sin píxel). Antes de quitarlo:
 * - si el píxel es de una cuenta publicitaria del socio, se transfiere al socio;
 * - el socio lo comparte al BM de la cuenta (solo publicar anuncios);
 * - se vincula a la cuenta desde ese BM.
 * Devuelve los problemas; si hay alguno, no se quita lo compartido.
 */
async function carryPartnerPixels(
  bcId: string,
  partnerId: string,
  advertiserId: string,
  token: string,
): Promise<string[]> {
  const problems: string[] = [];
  const pixels = (await listAdvertiserPixels(advertiserId, token)).filter((p) => p.code && p.pixelId);
  if (!pixels.length) return problems;
  const [ownPixels, partnerPixels, partnerName] = await Promise.all([
    listBcPixels(bcId, token),
    listBcPixels(partnerId, token),
    bcName(partnerId, token),
  ]);

  for (const px of pixels) {
    // El BM de la cuenta todavía no lo ve: hay que traerlo desde el socio.
    if (!ownPixels.has(px.code)) {
      const owner = partnerPixels.get(px.code);
      if (owner === undefined || (owner && owner !== partnerName)) {
        problems.push(`Píxel "${px.name}" (${px.code}): es de otro BM${owner ? ` (${owner})` : ""}; su dueño debe compartirlo directo al BM ${bcId}.`);
        continue;
      }
      if (owner === "") {
        // Dueño = una cuenta publicitaria del socio: se pasa al socio (conserva historial y vínculos).
        const t = await tiktok("/bc/pixel/transfer/", token, {
          bc_id: partnerId,
          pixel_code: px.code,
          sync_bc_permission: false,
        });
        if (t.code !== 0) {
          problems.push(`Píxel "${px.name}" (${px.code}): no se pudo pasar al BM socio (${String(t.message ?? "error")}).`);
          continue;
        }
      }
      const share = await tiktok("/bc/partner/add/", token, {
        bc_id: partnerId,
        partner_id: bcId,
        asset_type: "PIXEL",
        asset_ids: [px.pixelId],
        pixel_roles: ["PIXEL_AD_DELIVERY"],
      });
      if (share.code !== 0) {
        problems.push(`Píxel "${px.name}" (${px.code}): no se pudo compartir al BM ${bcId} (${String(share.message ?? "error")}).`);
        continue;
      }
    }

    // Vincular desde el BM de la cuenta (si ya estaba vinculado, TikTok lo deja igual).
    const link = await tiktok("/bc/pixel/link/update/", token, {
      bc_id: bcId,
      pixel_code: px.code,
      advertiser_ids: [advertiserId],
      relation_status: "LINK",
    });
    if (link.code !== 0) {
      problems.push(`Píxel "${px.name}" (${px.code}): no se pudo vincular a la cuenta ${advertiserId} (${String(link.message ?? "error")}).`);
    }
  }
  return problems;
}

/**
 * Quita lo compartido al BM socio, cuenta por cuenta, después de llevarse sus píxeles.
 * Si un píxel no se pudo llevar, esa cuenta queda compartida (no pierde el píxel) y
 * se devuelve el problema para avisar a gerencia.
 */
async function removeTempPartnerShares(bcId: string, advertiserIds: string[], token: string): Promise<string[]> {
  const problems: string[] = [];
  for (const partnerId of TEMP_PARTNER_SHARES[bcId] ?? []) {
    const ready: string[] = [];
    for (const advertiserId of advertiserIds) {
      const issues = await carryPartnerPixels(bcId, partnerId, advertiserId, token).catch((err: unknown) => [
        err instanceof Error ? err.message : `No se pudieron revisar los píxeles de ${advertiserId}.`,
      ]);
      if (issues.length) problems.push(`Cuenta ${advertiserId}: ${issues.join(" ")}`);
      else ready.push(advertiserId);
    }
    if (!ready.length) continue;
    const j = await tiktok("/bc/partner/asset/delete/", token, {
      bc_id: bcId,
      partner_id: partnerId,
      asset_type: "ADVERTISER",
      asset_ids: ready,
    });
    if (j.code !== 0) {
      console.warn("[bc-invites] unshare_failed", { bcId, partnerId, message: j.message });
    }
  }
  return problems;
}

/** Correo a gerencia cuando una cuenta no pudo dejar el BM socio por sus píxeles. */
async function alertPixelCarryProblems(email: string, problems: string[]) {
  const managers = await resolveManualPaymentManagerEmails();
  if (!managers.length) return;
  const subject = `[Revisar] Píxel sin pasar al BM 200 (${email})`;
  const bodyHtml = `
      <p style="margin:0;font-size:22px;line-height:1.25;font-weight:700;color:#1a1917;">Un píxel no se pudo pasar al BM 200</p>
      <p style="margin:10px 0 18px;font-size:15px;line-height:1.5;color:#57524b;">El cliente ${escapeHtml(email)} aceptó la invitación al BM 200. Su cuenta sigue compartida desde el BM 10 para que no pierda el píxel. Hay que compartir el píxel al BM 200 a mano (o pedírselo a su dueño) y luego quitar lo compartido.</p>
      ${problems.map((p) => `<p style="margin:0 0 8px;font-size:14px;color:#8f1d12;">${escapeHtml(p)}</p>`).join("")}`;
  const html = wrapInternalEmail({
    label: "Píxeles TikTok",
    preview: subject,
    bodyHtml,
    footerNote: "Holistic Marketing · aviso interno para gerencia",
  });
  const day = new Date().toISOString().slice(0, 10);
  await Promise.allSettled(
    managers.map((to) =>
      sendTransactionalEmail({
        to,
        subject,
        html,
        text: [subject, ...problems].join("\n"),
        templateKey: "ops.tiktok_pixel_carry.alert",
        idempotencyKey: `email:tiktok_pixel_carry:${email}:${day}:${to}`,
        metadata: { email, problems },
      }),
    ),
  );
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
          const problems = await removeTempPartnerShares(row.bc_id, row.advertiser_ids, token).catch((err: unknown) => [
            err instanceof Error ? err.message : "No se pudo quitar lo compartido.",
          ]);
          if (problems.length) {
            await admin
              .from("tiktok_bc_invites")
              .update({ last_error: problems.join(" | ").slice(0, 1000), updated_at: new Date().toISOString() })
              .eq("id", row.id);
            await alertPixelCarryProblems(row.email, problems).catch(() => undefined);
          }
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
