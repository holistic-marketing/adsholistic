import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Mediciones TEMPORALES de velocidad del panel (tabla perf_events).
 * Se quitan cuando se encuentre la causa de la lentitud entre secciones.
 */

export type PerfEvent = {
  kind: "server_proxy" | "server_layout" | "server_page" | "client_nav" | "client_load";
  path: string | null;
  label?: string | null;
  ms: number;
  userId?: string | null;
  meta?: Record<string, unknown>;
};

export function logPerf(event: PerfEvent): void {
  if (!Number.isFinite(event.ms) || event.ms < 0) return;
  console.info(`[perf] ${event.kind} ${event.path ?? ""} ${event.label ?? ""} ${Math.round(event.ms)}ms`);
  void createAdminClient()
    .from("perf_events")
    .insert({
      kind: event.kind,
      path: event.path?.slice(0, 200) ?? null,
      label: event.label?.slice(0, 120) ?? null,
      ms: Math.min(Math.round(event.ms), 600_000),
      user_id: event.userId ?? null,
      meta: event.meta ?? {},
    })
    .then(
      () => undefined,
      () => undefined,
    );
}

const now = () => performance.now();

/** Envuelve una página del panel y registra cuánto tarda en tener listo su contenido. */
export function timedPage<P>(path: string, Page: (props: P) => Promise<React.ReactNode>) {
  return async function TimedPage(props: P) {
    const started = now();
    try {
      return await Page(props);
    } finally {
      logPerf({ kind: "server_page", path, ms: now() - started });
    }
  };
}

/** Cronómetro por pasos para el layout. */
export function perfSteps() {
  const started = now();
  let last = started;
  const steps: Record<string, number> = {};
  return {
    mark(name: string) {
      const t = now();
      steps[name] = Math.round(t - last);
      last = t;
    },
    total: () => Math.round(now() - started),
    steps,
  };
}
