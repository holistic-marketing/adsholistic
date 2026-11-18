#!/usr/bin/env node
// BlueFocus (蓝瀚) Meta relay worker.
//
// Corre en el droplet bluefocus-relay (IP fija en la lista blanca de BlueFocus).
// Sin dependencias: Node >= 20 (fetch nativo). Solo hace conexiones salientes:
//   - Supabase (cola bluefocus_meta_topups, snapshots, latido)
//   - BlueFocus OpenAPI
//
// Uso:
//   node worker.mjs            -> loop continuo (systemd)
//   node worker.mjs --probe    -> prueba de solo lectura; no escribe nada
//
// Variables (archivo /etc/bluefocus-relay.env):
//   BLUEFOCUS_API_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   opcionales: BLUEFOCUS_BASE_URL, RELAY_TICK_MS, RELAY_SUBMIT_ENABLED

const VERSION = "1.0.0";

const BF_BASE = (process.env.BLUEFOCUS_BASE_URL ||
  "https://akms-openapi.bluemediagroup.cn/open_api/v1.0").replace(/\/+$/, "");
const BF_TOKEN = (process.env.BLUEFOCUS_API_TOKEN || "").trim();
const SB_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SB_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const TICK_MS = Number(process.env.RELAY_TICK_MS || 5000);
// Interruptor de seguridad: con "false" el worker no envía recargas nuevas
// (sigue sincronizando saldos y revisando las ya enviadas).
const SUBMIT_ENABLED = (process.env.RELAY_SUBMIT_ENABLED ?? "true") !== "false";

const BF_TIMEOUT_MS = 20_000;
const POLL_EVERY_MS = 30_000; // cada cuánto revisar una recarga ya enviada
const SUBMITTED_MAX_AGE_MS = 72 * 3600_000; // sin respuesta en 72h -> revisión manual
const HEARTBEAT_EVERY_MS = 60_000;
const SNAPSHOT_EVERY_MS = 10 * 60_000;
const CONFIG_ERROR_PAUSE_MS = 5 * 60_000;
const BUSY_RETRY_PAUSE_MS = 60_000;

// Códigos globales BlueFocus (doc §二).
const BF = {
  OK: 0,
  BUSY: -1,
  PERMISSION: 40001,
  PARAM: 40002,
  IP_NOT_ALLOWED: 40004,
  EMPTY_TOKEN: 40104,
  NOT_FOUND: 40105,
  CONFLICT: 40409,
};
const CONFIG_ERRORS = new Set([BF.PERMISSION, BF.IP_NOT_ALLOWED, BF.EMPTY_TOKEN]);

// operate_record.operate_status: 1 procesando, 2 éxito, 3 fallo/rechazo.
const OP_PROCESSING = 1;
const OP_SUCCESS = 2;
const OP_FAILED = 3;

function log(level, event, data = {}) {
  const line = JSON.stringify({ t: new Date().toISOString(), level, event, ...data });
  (level === "error" ? console.error : console.log)(line);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Error donde no sabemos si BlueFocus procesó la orden (timeout, red, 5xx). */
class UncertainError extends Error {}

// ---------------------------------------------------------------- BlueFocus

async function bfRequest(method, path, { query, body } = {}) {
  const url = new URL(`${BF_BASE}/${path.replace(/^\/+/, "")}`);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${BF_TOKEN}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(BF_TIMEOUT_MS),
    });
  } catch (err) {
    throw new UncertainError(`bluefocus_network: ${err?.message ?? err}`);
  }
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new UncertainError(`bluefocus_non_json http=${res.status} body=${text.slice(0, 200)}`);
  }
  if (typeof json?.code !== "number") {
    throw new UncertainError(`bluefocus_no_code http=${res.status}`);
  }
  return json; // { code, info, data, request_id }
}

const bf = {
  facebookList: (page = 1, size = 100, accountIds) =>
    bfRequest("GET", "application/facebook/list", {
      query: {
        current_page: page,
        page_size: size,
        account_id: accountIds?.length ? accountIds.join(",") : undefined,
      },
    }),
  accountDetails: (accountIds) =>
    bfRequest("POST", "application/account_details", { body: { account_ids: accountIds } }),
  facebookTopup: (fbAccountId, amountUsd) =>
    bfRequest("POST", "application/facebook/amount_spend", {
      body: {
        is_prepay: false, // la doc pide false para llamadas por API
        applications: [
          { account_id: fbAccountId, amount: amountUsd, currency: 0, type: "1" }, // 0=USD, 1=充值
        ],
      },
    }),
  operateRecords: (applyIds) =>
    bfRequest("GET", "application/operate_record", {
      query: {
        category: 1, // 额度管理
        medium: 0, // facebook
        apply_ids: applyIds.join(","),
        current_page: 1,
        page_size: 200,
      },
    }),
};

// ----------------------------------------------------------------- Supabase

async function sb(method, path, { query, body, prefer } = {}) {
  const url = new URL(`${SB_URL}/rest/v1/${path}`);
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`supabase ${method} ${path} ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

const db = {
  rpc: (fn, args = {}) => sb("POST", `rpc/${fn}`, { body: args }),
  updateTopup: (id, patch) =>
    sb("PATCH", "bluefocus_meta_topups", {
      query: { id: `eq.${id}` },
      body: { ...patch, updated_at: new Date().toISOString() },
      prefer: "return=minimal",
    }),
  topupsByStatus: (status, extra = {}) =>
    sb("GET", "bluefocus_meta_topups", {
      query: { select: "*", status: `eq.${status}`, order: "created_at.asc", limit: "200", ...extra },
    }),
};

// ------------------------------------------------------------------- Lógica

const centsToUsd = (cents) => Math.round(Number(cents)) / 100;

async function refundToWallet(topup, reason) {
  try {
    const journalId = await db.rpc("ledger_refund_from_ad_account_to_wallet", {
      p_ad_account_id: topup.ad_account_id,
      p_amount_cents: Number(topup.amount_cents),
      p_source_balance: "available",
      p_idempotency_key: `bluefocus-meta-refund:${topup.id}`,
      p_description: "Reverso automático: BlueFocus no aceptó la recarga Meta",
      p_metadata: {
        source: "bluefocus_meta_compensation",
        bluefocus_topup_id: topup.id,
        bluefocus_apply_id: topup.bf_apply_id ?? null,
        reason: String(reason ?? "").slice(0, 500),
      },
    });
    await db.updateTopup(topup.id, {
      status: "refunded",
      refund_journal_id: journalId,
      bf_reason: String(reason ?? "").slice(0, 1000),
      finished_at: new Date().toISOString(),
    });
    log("info", "topup_refunded", { id: topup.id, journalId, reason });
  } catch (err) {
    // Sin devolución automática: queda para que un humano la resuelva.
    await db.updateTopup(topup.id, {
      status: "needs_review",
      bf_reason: `refund_failed: ${err.message}; original: ${reason}`.slice(0, 1000),
    });
    log("error", "topup_refund_failed", { id: topup.id, error: err.message, reason });
  }
}

let pausedUntil = 0;
let lastError = null;

async function submitNextTopup() {
  if (!SUBMIT_ENABLED || Date.now() < pausedUntil) return;

  const claimed = await db.rpc("bluefocus_claim_next_meta_topup");
  const topup = Array.isArray(claimed) ? claimed[0] : null;
  if (!topup) return;

  const amountUsd = centsToUsd(topup.amount_cents);
  log("info", "topup_submitting", { id: topup.id, fb: topup.fb_account_id, amountUsd });

  let res;
  try {
    res = await bf.facebookTopup(topup.fb_account_id, amountUsd);
  } catch (err) {
    // No sabemos si llegó: jamás reintentar sola (podría recargar dos veces).
    await db.updateTopup(topup.id, { status: "needs_review", bf_reason: err.message.slice(0, 1000) });
    lastError = err.message;
    log("error", "topup_uncertain", { id: topup.id, error: err.message });
    return;
  }

  const base = { bf_last_code: res.code, bf_last_info: res.info ?? null, bf_request_id: res.request_id ?? null };
  const applyId = res.data?.apply_id ?? null;

  if (res.code === BF.OK && applyId != null) {
    await db.updateTopup(topup.id, {
      ...base,
      status: "submitted",
      bf_apply_id: applyId,
      submitted_at: new Date().toISOString(),
    });
    log("info", "topup_submitted", { id: topup.id, applyId });
    return;
  }

  if (res.code === BF.OK) {
    // Aceptado pero sin apply_id: no podemos seguirlo -> humano.
    await db.updateTopup(topup.id, { ...base, status: "needs_review", bf_reason: "ok_without_apply_id" });
    log("error", "topup_ok_without_apply_id", { id: topup.id, res });
    return;
  }

  if (CONFIG_ERRORS.has(res.code) || res.code === BF.BUSY) {
    // No se procesó. Vuelve a la cola y pausamos los envíos un rato.
    await db.updateTopup(topup.id, { ...base, status: "pending" });
    const pause = res.code === BF.BUSY ? BUSY_RETRY_PAUSE_MS : CONFIG_ERROR_PAUSE_MS;
    pausedUntil = Date.now() + pause;
    lastError = `bluefocus_code_${res.code}: ${res.info ?? ""}`;
    log("error", "submit_paused", { id: topup.id, code: res.code, info: res.info, pauseMs: pause });
    return;
  }

  if (res.code === BF.CONFLICT) {
    // "Ya enviado, no repetir en 5 s": puede que sí haya entrado -> humano.
    await db.updateTopup(topup.id, { ...base, status: "needs_review", bf_reason: "conflict_40409" });
    log("error", "topup_conflict", { id: topup.id });
    return;
  }

  if (res.code === BF.PARAM || res.code === BF.NOT_FOUND) {
    // Rechazo claro (cuenta inexistente, monto inválido...): devolver la plata.
    await db.updateTopup(topup.id, { ...base, status: "failed" });
    await refundToWallet({ ...topup, ...base }, `bluefocus_code_${res.code}: ${res.info ?? ""}`);
    return;
  }

  // 40300 / 50000 / otros: error del servidor, no sabemos si entró.
  await db.updateTopup(topup.id, { ...base, status: "needs_review", bf_reason: `bluefocus_code_${res.code}` });
  lastError = `bluefocus_code_${res.code}: ${res.info ?? ""}`;
  log("error", "topup_unknown_code", { id: topup.id, code: res.code, info: res.info });
}

async function pollSubmittedTopups() {
  const cutoff = new Date(Date.now() - POLL_EVERY_MS).toISOString();
  const rows = await db.topupsByStatus("submitted", {
    or: `(last_polled_at.is.null,last_polled_at.lt.${cutoff})`,
  });
  const withApply = (rows ?? []).filter((r) => r.bf_apply_id != null);
  if (!withApply.length) return;

  const res = await bf.operateRecords(withApply.map((r) => r.bf_apply_id));
  if (res.code !== BF.OK) {
    lastError = `operate_record_code_${res.code}: ${res.info ?? ""}`;
    log("error", "poll_failed", { code: res.code, info: res.info });
    return;
  }
  const byApply = new Map((res.data?.list ?? []).map((r) => [String(r.apply_id), r]));
  const now = new Date().toISOString();

  for (const topup of withApply) {
    const rec = byApply.get(String(topup.bf_apply_id));
    const status = rec ? Number(rec.operate_status) : null;

    if (status === OP_SUCCESS) {
      await db.updateTopup(topup.id, {
        status: "succeeded",
        last_polled_at: now,
        finished_at: rec.operate_time ?? now,
        metadata: { ...(topup.metadata ?? {}), bf_operator: rec.operator ?? null, bf_change_amount: rec.change_amount ?? null },
      });
      log("info", "topup_succeeded", { id: topup.id, applyId: topup.bf_apply_id });
    } else if (status === OP_FAILED) {
      await db.updateTopup(topup.id, { status: "failed", last_polled_at: now, bf_reason: rec.reason ?? null });
      await refundToWallet(topup, `bluefocus_rejected: ${rec.reason ?? "sin motivo"}`);
    } else {
      const age = Date.now() - new Date(topup.submitted_at ?? topup.created_at).getTime();
      if (age > SUBMITTED_MAX_AGE_MS) {
        await db.updateTopup(topup.id, { status: "needs_review", last_polled_at: now, bf_reason: "no_result_after_72h" });
        log("error", "topup_stale", { id: topup.id, applyId: topup.bf_apply_id });
      } else {
        await db.updateTopup(topup.id, { last_polled_at: now });
        if (status !== OP_PROCESSING) log("info", "topup_not_in_records_yet", { id: topup.id, applyId: topup.bf_apply_id });
      }
    }
  }
}

async function syncAccountSnapshots() {
  const accounts = await sb("GET", "ad_accounts", {
    query: { select: "external_account_id", platform: "eq.meta", external_account_id: "not.is.null" },
  });
  const ids = [...new Set((accounts ?? []).map((a) => String(a.external_account_id).trim()).filter(Boolean))];
  for (let i = 0; i < ids.length; i += 50) {
    const res = await bf.accountDetails(ids.slice(i, i + 50));
    if (res.code !== BF.OK) {
      log("error", "snapshot_failed", { code: res.code, info: res.info });
      return;
    }
    const rows = (res.data ?? []).map((a) => ({
      fb_account_id: String(a.account_id),
      account_name: a.account_name ?? null,
      entity_name: a.entity_name ?? null,
      account_status: a.account_status ?? null,
      balance: a.balance != null ? Number(a.balance) : null,
      currency: a.currency ?? null,
      raw: a,
      synced_at: new Date().toISOString(),
    }));
    if (rows.length) {
      await sb("POST", "bluefocus_meta_account_snapshots", {
        query: { on_conflict: "fb_account_id" },
        body: rows,
        prefer: "resolution=merge-duplicates,return=minimal",
      });
    }
  }
  log("info", "snapshots_synced", { accounts: ids.length });
}

let egressIp = null;
async function detectEgressIp() {
  try {
    const r = await fetch("https://api.ipify.org", { signal: AbortSignal.timeout(10_000) });
    egressIp = (await r.text()).trim();
  } catch {
    egressIp = null;
  }
}

async function heartbeat() {
  await sb("POST", "bluefocus_relay_heartbeat", {
    query: { on_conflict: "id" },
    body: {
      id: "main",
      last_seen_at: new Date().toISOString(),
      egress_ip: egressIp,
      version: VERSION,
      last_error: lastError,
      details: { submit_enabled: SUBMIT_ENABLED, paused_until: pausedUntil ? new Date(pausedUntil).toISOString() : null },
    },
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}

/** Si el proceso murió a mitad de un envío, no sabemos si llegó: revisión manual. */
async function recoverInterruptedSubmits() {
  const stuck = await db.topupsByStatus("submitting");
  for (const t of stuck ?? []) {
    await db.updateTopup(t.id, { status: "needs_review", bf_reason: "worker_restarted_during_submit" });
    log("error", "topup_interrupted", { id: t.id });
  }
}

// ------------------------------------------------------------------- Probe

async function probe() {
  await detectEgressIp();
  console.log(`IP de salida: ${egressIp ?? "desconocida"}`);
  if (!BF_TOKEN) throw new Error("Falta BLUEFOCUS_API_TOKEN");

  const list = await bf.facebookList(1, 20);
  console.log(`facebook/list -> code=${list.code} info=${list.info ?? ""}`);
  if (list.code !== BF.OK) return process.exitCode = 1;

  const items = list.data?.list ?? [];
  console.log(`Cuentas Meta en BlueFocus: ${list.data?.pagination?.total ?? items.length}`);
  for (const a of items.slice(0, 20)) {
    console.log(`  ${a.account_id}  status=${a.status ?? "?"}  ${a.entity_name ?? ""}`);
  }

  const ids = items.map((a) => String(a.account_id)).filter(Boolean).slice(0, 20);
  if (ids.length) {
    const det = await bf.accountDetails(ids);
    console.log(`account_details -> code=${det.code} info=${det.info ?? ""}`);
    for (const d of det.data ?? []) {
      console.log(`  ${d.account_id}  ${d.account_name ?? ""}  saldo=${d.balance} moneda=${d.currency} estado=${d.account_status}`);
    }
  }
}

// -------------------------------------------------------------------- Loop

async function main() {
  if (process.argv.includes("--probe")) return probe();

  for (const [k, v] of Object.entries({ BLUEFOCUS_API_TOKEN: BF_TOKEN, SUPABASE_URL: SB_URL, SUPABASE_SERVICE_ROLE_KEY: SB_KEY })) {
    if (!v) throw new Error(`Falta ${k}`);
  }
  await detectEgressIp();
  log("info", "relay_start", { version: VERSION, egressIp, submitEnabled: SUBMIT_ENABLED });
  await recoverInterruptedSubmits();

  let stopping = false;
  for (const sig of ["SIGTERM", "SIGINT"]) {
    process.on(sig, () => {
      stopping = true;
      log("info", "relay_stopping", { signal: sig });
    });
  }

  let lastBeat = 0;
  let lastSnap = 0;
  while (!stopping) {
    const step = async (name, fn) => {
      try {
        await fn();
      } catch (err) {
        lastError = `${name}: ${err.message}`;
        log("error", "step_failed", { step: name, error: err.message });
      }
    };
    await step("poll", pollSubmittedTopups);
    await step("submit", submitNextTopup);
    if (Date.now() - lastSnap > SNAPSHOT_EVERY_MS) {
      lastSnap = Date.now();
      await step("snapshots", syncAccountSnapshots);
    }
    if (Date.now() - lastBeat > HEARTBEAT_EVERY_MS) {
      lastBeat = Date.now();
      await step("heartbeat", heartbeat);
    }
    await sleep(TICK_MS);
  }
}

main().catch((err) => {
  log("error", "relay_fatal", { error: err.message });
  process.exit(1);
});
