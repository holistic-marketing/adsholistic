"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * TEMPORAL: mide cuánto tarda cada cambio de sección (clic → página pintada)
 * y la carga completa, y lo manda a /api/perf. También lo deja en consola.
 */
function send(event: Record<string, unknown>) {
  const body = JSON.stringify(event);
  try {
    if (navigator.sendBeacon?.("/api/perf", new Blob([body], { type: "application/json" }))) return;
  } catch {
    // sigue con fetch
  }
  void fetch("/api/perf", { method: "POST", body, keepalive: true, credentials: "include" }).catch(() => undefined);
}

export function PerfReporter() {
  const pathname = usePathname();
  const pending = useRef<{ from: string; to: string; at: number } | null>(null);
  const firstPath = useRef(pathname);

  // Carga completa (F5 / primera entrada).
  useEffect(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (!nav) return;
    const report = () => {
      const r = (v: number) => Math.round(v);
      // Desglose: redirecciones, red (DNS/conexión/TLS), espera del servidor,
      // descarga del HTML y lo que tarda el navegador en armar la página.
      const meta = {
        ttfb: r(nav.responseStart),
        dcl: r(nav.domContentLoadedEventEnd),
        load: r(nav.loadEventEnd),
        redirects: nav.redirectCount,
        redirect_ms: r(nav.redirectEnd - nav.redirectStart),
        dns_ms: r(nav.domainLookupEnd - nav.domainLookupStart),
        connect_ms: r(nav.connectEnd - nav.connectStart),
        tls_ms: nav.secureConnectionStart > 0 ? r(nav.connectEnd - nav.secureConnectionStart) : 0,
        server_wait_ms: r(nav.responseStart - nav.requestStart),
        download_ms: r(nav.responseEnd - nav.responseStart),
        browser_ms: r(nav.domContentLoadedEventEnd - nav.responseEnd),
        transfer_kb: r((nav.transferSize || 0) / 1024),
        js_kb: r(
          performance
            .getEntriesByType("resource")
            .filter((e) => (e as PerformanceResourceTiming).initiatorType === "script")
            .reduce((t, e) => t + ((e as PerformanceResourceTiming).transferSize || 0), 0) / 1024,
        ),
      };
      console.info("[perf] carga", firstPath.current, meta);
      send({ kind: "client_load", path: firstPath.current, ms: meta.load || meta.dcl, meta });
    };
    if (document.readyState === "complete") setTimeout(report, 0);
    else window.addEventListener("load", () => setTimeout(report, 0), { once: true });
  }, []);

  // Clic en un enlace interno: arranca el cronómetro.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank") return;
      const url = new URL(anchor.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      pending.current = { from: location.pathname, to: url.pathname, at: performance.now() };
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // La ruta cambió: espera a que se pinte y mide.
  useEffect(() => {
    const p = pending.current;
    if (!p || pathname !== p.to) return;
    pending.current = null;
    // Con loading.tsx la URL cambia al mostrar el esqueleto: medimos las dos
    // cosas, cuándo se ve el esqueleto y cuándo llega el contenido real.
    let done = false;
    let skeletonMs: number | null = null;
    const finish = () => {
      if (done) return;
      done = true;
      observer.disconnect();
      clearTimeout(timeout);
      requestAnimationFrame(() => {
        const ms = Math.round(performance.now() - p.at);
        console.info(`[perf] ${p.from} → ${p.to}: ${ms} ms (esqueleto ${skeletonMs ?? "-"} ms)`);
        send({ kind: "client_nav", path: p.to, from: p.from, ms, meta: { skeleton_ms: skeletonMs } });
      });
    };
    const check = () => {
      if (document.querySelector("[data-page-skeleton]")) {
        if (skeletonMs == null) skeletonMs = Math.round(performance.now() - p.at);
        return;
      }
      finish();
    };
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    const timeout = setTimeout(finish, 60_000);
    requestAnimationFrame(() => requestAnimationFrame(check));
    return () => {
      observer.disconnect();
      clearTimeout(timeout);
    };
  }, [pathname]);

  return null;
}
