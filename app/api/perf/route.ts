import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { logPerf } from "@/lib/perf/perf-log.server";

export const runtime = "nodejs";

/** Recibe mediciones del navegador (cambio de sección / carga completa). Temporal. */
export async function POST(request: Request) {
  const session = await getSession().catch(() => null);
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  let body: unknown;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const events = Array.isArray(body) ? body.slice(0, 20) : [body];
  for (const raw of events) {
    if (!raw || typeof raw !== "object") continue;
    const e = raw as Record<string, unknown>;
    const kind = e.kind === "client_load" ? "client_load" : "client_nav";
    const ms = Number(e.ms);
    if (!Number.isFinite(ms) || ms < 0 || ms > 600_000) continue;
    logPerf({
      kind,
      path: typeof e.path === "string" ? e.path : null,
      label: typeof e.from === "string" ? `from ${e.from}` : null,
      ms,
      userId: session.id,
      meta: typeof e.meta === "object" && e.meta ? (e.meta as Record<string, unknown>) : {},
    });
  }
  return NextResponse.json({ ok: true });
}
