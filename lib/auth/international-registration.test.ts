import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import * as countries from "./register-countries.shared.ts";

const require = createRequire(import.meta.url);
const ts = require("typescript") as typeof import("typescript");
const root = new URL("../../", import.meta.url);

/** Run the actual server modules with no network, credentials or unlisted imports. */
function loadServerModule<T>(path: string, dependencies: Record<string, unknown>): T {
  const exports = {};
  const { outputText } = ts.transpileModule(readFileSync(new URL(path, root), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  runInNewContext(outputText, {
    exports,
    require(name: string) {
      if (Object.hasOwn(dependencies, name)) return dependencies[name];
      throw new Error(`Unmocked dependency: ${name}`);
    },
    URL,
    Response,
    process: { env: { NODE_ENV: "test" } },
    console: { info() {}, warn() {}, error() {} },
  }, { filename: path });
  return exports as T;
}

type Registration = { name?: string; dni?: string | null; email: string; phone: string; country?: unknown };
type Insert = { name: string; dni: string | null; emails: string[]; phones: string[] };
type CreateResult = { ok: boolean; message?: string };
type BridgeResult = { ok: boolean; error?: string };

function registrationHarness() {
  const inserts: Insert[] = [];
  const signupInputs: Registration[] = [];
  let authCreates = 0;
  const clientes = loadServerModule<{
    createHecomCliente: (input: Registration) => Promise<CreateResult>;
  }>("lib/hecom/clientes.server.ts", {
    "server-only": {},
    react: { cache: (fn: unknown) => fn },
    "@/lib/payments/deposit-fee": { DEFAULT_DEPOSIT_FEE_PERCENT: 10 },
    "@/lib/auth/register-countries.shared": countries,
    "@/lib/hecom/backup.server": {
      getHecomClienteFromBackup: async () => null,
      listHecomClientesFromBackup: async () => null,
    },
    "@/lib/hecom/supabase.server": {
      getHecomSupabaseConfig: () => ({ configured: true }),
      createHecomAdminClient: () => ({
        from(table: string) {
          assert.equal(table, "clientes");
          const query = {
            select: () => query,
            filter: () => query,
            order: () => query,
            limit: async () => ({ data: [], error: null }),
            insert(payload: Insert) {
              inserts.push(JSON.parse(JSON.stringify(payload)) as Insert);
              return {
                select: () => ({ single: async () => ({ data: { id: "test-client", ...payload }, error: null }) }),
              };
            },
          };
          return query;
        },
      }),
    },
  });
  const user = { id: "test-user", user_metadata: { clerk_user_id: "clerk-test" } };
  const bridge = loadServerModule<{
    completeClerkLoginToHolistic: (clerkUser: unknown, attribution: unknown) => Promise<BridgeResult>;
  }>("lib/auth/clerk-bridge.server.ts", {
    "server-only": {},
    "@supabase/ssr": { createServerClient: () => ({ auth: { verifyOtp: async () => ({ data: { user }, error: null }) } }) },
    "next/server": { NextResponse: { redirect: (url: URL) => ({ url: url.href, cookies: { set() {} } }) } },
    "@/lib/auth/account-provisioning.server": { ensureAccountProvisionedForUser: async () => ({ ready: true }) },
    "@/lib/auth/hecom-otp.server": {
      normalizeHecomOtpEmail: (email: string) => email.trim().toLowerCase(),
      resolveHecomClientesForEmail: async () => [],
      provisionHecomClienteAccess: async () => ({ nextPath: "/overview" }),
    },
    "@/lib/auth/hecom-otp-log.server": { logHecomOtp() {}, maskEmail: () => "masked" },
    "@/lib/auth/register-countries.shared": countries,
    "@/lib/auth/staff.server": { isStaffUser: async () => false },
    "@/config/routes": { routes: { overview: "/overview", accountSetup: "/account-setup" } },
    "@/lib/env/env.server": { serverEnv: { appUrl: "https://example.invalid", supabaseUrl: "https://example.invalid" } },
    "@/lib/hecom/clientes.server": {
      createHecomCliente: async (input: Registration) => {
        signupInputs.push(input);
        return clientes.createHecomCliente(input);
      },
    },
    "@/lib/partners/partners.server": { recordSignupAttribution: async () => undefined },
    "@/lib/supabase/admin": {
      createAdminClient: () => ({ auth: { admin: {
        createUser: async () => { authCreates += 1; return { error: null }; },
        generateLink: async () => ({ data: { properties: { hashed_token: "test-token" } }, error: null }),
      } } }),
    },
    "@/lib/supabase/auth-cookie": { supabaseAuthCookieOptions: {} },
  });

  return {
    inserts,
    signupInputs,
    authCreates: () => authCreates,
    createClient: clientes.createHecomCliente,
    complete: (metadata: Record<string, unknown>, verified = true) => bridge.completeClerkLoginToHolistic({
      id: "clerk-test",
      primaryEmailAddress: { emailAddress: "test@example.invalid", verification: { status: verified ? "verified" : "unverified" } },
      unsafeMetadata: { source: "ah_register", fullName: "Test Customer", ...metadata },
    }, { partnerSlug: null, referralCode: null, visitorId: null }),
  };
}

test("Clerk country and phone reach the actual Hecom insert in E.164", async () => {
  for (const [country, phone, expected] of [
    ["CO", "300 123 4567", "+573001234567"],
    ["CO", "+57 300 123 4567", "+573001234567"],
    ["GB", "07700 900123", "+447700900123"],
    ["US", "202 555 0123", "+12025550123"],
    ["ES", "612 345 678", "+34612345678"],
    ["PE", "987 654 321", "+51987654321"],
  ]) {
    const harness = registrationHarness();
    assert.equal((await harness.complete({ country, phone })).ok, true, country);
    assert.equal(harness.signupInputs[0]?.country, country);
    assert.equal(harness.inserts.length, 1);
    assert.deepEqual(harness.inserts[0]?.phones, [expected]);
    assert.equal(harness.inserts[0]?.dni, null);
    assert.equal(harness.authCreates(), 1);
  }
});

test("invalid country or phone cannot silently create a Peruvian account", async () => {
  for (const metadata of [
    { country: "ZZ", phone: "987654321" },
    { country: "", phone: "987654321" },
    { country: null, phone: "987654321" },
    { country: "CO", phone: "+51987654321" },
    { country: "CO", phone: "300" },
  ]) {
    const harness = registrationHarness();
    const result = await harness.complete(metadata);
    assert.equal(result.ok, false);
    assert.equal(result.error, "clerk_phone");
    assert.equal(harness.signupInputs.length, 0);
    assert.equal(harness.inserts.length, 0);
    assert.equal(harness.authCreates(), 0);
  }
});

test("existing pending Peru signup without country remains compatible", async () => {
  const harness = registrationHarness();
  assert.equal((await harness.complete({ phone: "987654321" })).ok, true);
  assert.deepEqual(harness.inserts[0]?.phones, ["+51987654321"]);
});

test("email verification is still required before any customer insert", async () => {
  const harness = registrationHarness();
  const result = await harness.complete({ country: "CO", phone: "+573001234567" }, false);
  assert.equal(result.ok, false);
  assert.equal(result.error, "clerk_email_unverified");
  assert.equal(harness.inserts.length, 0);
  assert.equal(harness.authCreates(), 0);
});

test("Hecom registration accepts foreign documents and validates country before writes", async () => {
  const harness = registrationHarness();
  assert.equal((await harness.createClient({
    name: "Test Customer", email: "test@example.invalid", country: "ES", phone: "612345678", dni: "AB123456",
  })).ok, true);
  assert.equal(harness.inserts[0]?.dni, "ES-AB123456");
  assert.equal((await harness.createClient({
    email: "test@example.invalid", country: "ZZ", phone: "987654321",
  })).ok, false);
  assert.equal(harness.inserts.length, 1);
});

test("OTP endpoint rejects an explicit invalid country before invoking registration", async () => {
  let calls = 0;
  const route = loadServerModule<{ POST: (request: unknown) => Promise<Response> }>("app/api/auth/otp/register/route.ts", {
    "next/server": { NextResponse: { json: Response.json } },
    "@/lib/auth/hecom-otp.server": { registerHecomClientOtp: async () => { calls += 1; throw new Error("Registration must not run"); } },
    "@/lib/auth/register-countries.shared": countries,
    "@/lib/auth/hecom-otp-email": { HECOM_OTP_COOLDOWN_SECONDS: 30 },
    "@/lib/auth/hecom-otp-log.server": { logHecomOtp() {}, maskEmail: () => "masked" },
    "@/lib/partners/partners.server": { resolveSignupCode: async () => null },
  });
  for (const country of ["ZZ", "", null]) {
    const response = await route.POST({ json: async () => ({ country, phone: "987654321" }) });
    assert.equal(response.status, 400);
  }
  assert.equal(calls, 0);
});
