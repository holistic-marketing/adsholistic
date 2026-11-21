import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env/env.server";
import { processPendingBcInvites } from "@/lib/integrations/tiktok/bc-invites.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function isAuthorized(request: Request): boolean {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  const headerSecret =
    request.headers.get("x-cron-secret") ?? request.headers.get("x-job-secret") ?? "";
  const expected = serverEnv.cronSecret || serverEnv.internalJobSecret;
  return Boolean(expected && (token === expected || headerSecret === expected));
}

/** Invitaciones a BMs de TikTok: asigna cuentas al aceptar y reinvita cada 6 h. */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  try {
    const result = await processPendingBcInvites();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[bc-invites] failed", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Error al revisar invitaciones." },
      { status: 500 },
    );
  }
}
