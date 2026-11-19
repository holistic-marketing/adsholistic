import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env/env.server";
import { runAutoReclaimBanned } from "@/lib/payments/auto-reclaim-banned.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(request: Request): boolean {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  const headerSecret =
    request.headers.get("x-cron-secret") ?? request.headers.get("x-job-secret") ?? "";
  const expected = serverEnv.cronSecret || serverEnv.internalJobSecret;
  return Boolean(expected && (token === expected || headerSecret === expected));
}

/** Cuentas TikTok baneadas con saldo sin gastar → cartera (solo si TikTok lo suelta). */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  try {
    const result = await runAutoReclaimBanned();
    return NextResponse.json({
      ok: true,
      scanned: result.scanned,
      recovered: result.recovered,
      held: result.held.length,
      retained: result.retained.length,
      skipped: result.skipped,
    });
  } catch (error) {
    console.error("[reclaim-banned] failed", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Error al recuperar saldos." },
      { status: 500 },
    );
  }
}
