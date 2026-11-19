"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { ComprobanteLightbox } from "./ComprobanteLightbox.client";

type ComprobanteKind = "image" | "pdf" | "unknown";

function guessKindFromUrl(url: string): ComprobanteKind {
  const path = url.split("?")[0]?.toLowerCase() ?? "";
  if (path.endsWith(".pdf")) return "pdf";
  if (/\.(jpe?g|png|webp|gif|heic|bmp)$/.test(path)) return "image";
  return "unknown";
}

export function CobroComprobantePreview({
  cobroId,
  index = 0,
  label,
  endpoint,
}: {
  cobroId: string;
  index?: number;
  label?: string;
  /** GET que devuelve { url, kind }. Vacío = ruta de staff. */
  endpoint?: string;
}) {
  const t = useTranslations("cobros");
  const resolvedLabel = label ?? t("proof");
  const [url, setUrl] = useState<string | null>(null);
  const [kind, setKind] = useState<ComprobanteKind>("unknown");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Sin setters síncronos: al montar `loading` ya arranca en true; `retry` pone el spinner.
  const fetchProof = useCallback(async () => {
    try {
      const data = await apiClient<{
        url: string;
        kind?: ComprobanteKind;
      }>(
        endpoint ??
          `/api/hecom/cobros/${encodeURIComponent(cobroId)}/comprobante?index=${index}`,
      );
      if (!data.url) throw new Error(t("proofUnavailable"));
      setUrl(data.url);
      setKind(data.kind ?? guessKindFromUrl(data.url));
    } catch (err) {
      setUrl(null);
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : t("proofLoadError"),
      );
    } finally {
      setLoading(false);
    }
  }, [cobroId, endpoint, index, t]);

  useEffect(() => {
    // Carga asíncrona: fetchProof() solo actualiza estado después del await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchProof();
  }, [fetchProof]);

  function retry() {
    setLoading(true);
    setError(null);
    void fetchProof();
  }

  if (loading) {
    return (
      <div
        className="size-14 shrink-0 animate-pulse rounded-box border border-line bg-subtle motion-reduce:animate-none"
        title={t("proofLoading")}
      />
    );
  }

  if (error || !url) {
    return (
      <button
        type="button"
        onClick={retry}
        className="flex size-14 shrink-0 items-center justify-center rounded-box border border-danger-line bg-danger-bg text-[10px] font-medium text-danger-fg"
        title={error ?? t("retry")}
      >
        {t("retry")}
      </button>
    );
  }

  const isPdf = kind === "pdf";

  return (
    <>
      <button
        type="button"
        onClick={() => setLightboxOpen(true)}
        className="group relative size-14 shrink-0 overflow-hidden rounded-box border border-line bg-field shadow-ctl hover:border-accent-line"
        title={t("enlargeProof", { label: resolvedLabel })}
        aria-label={t("enlargeProof", { label: resolvedLabel })}
      >
        {isPdf ? (
          <span className="flex size-full flex-col items-center justify-center gap-0.5 text-ink-2">
            <PanelIcon name="file" className="size-5" />
            <span className="font-mono text-[9px] font-semibold uppercase">PDF</span>
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={resolvedLabel} className="size-full object-cover" />
        )}
        <span
          className="absolute bottom-1 right-1 grid size-5 place-items-center rounded-[6px] bg-surface/90 text-ink opacity-0 shadow-ctl transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden
        >
          <PanelIcon name="search" className="size-3" />
        </span>
      </button>

      <ComprobanteLightbox
        open={lightboxOpen}
        url={url}
        title={resolvedLabel}
        kind={isPdf ? "pdf" : "image"}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
}
