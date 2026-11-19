"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { buttonClass } from "@/components/ui/Button";
import { Note } from "@/components/ui/PanelKit";
import type { LaunchOptions } from "@/lib/campaigns/launch-options.server";
import { VideoPickGrid } from "@/features/campaigns/components/VideoPickGrid";

/** Pocos a la vez: Smart+ necesita días para aprender con cada video nuevo. */
const MAX_PICK = 5;

/**
 * Elige videos de la biblioteca de la cuenta para sumarlos a una campaña
 * lanzada. `onSubmit` hace el pedido (sumar directo o aprobar una sugerencia).
 */
export function AddVideosPicker({
  launchId,
  onSubmit,
  onCancel,
}: {
  launchId: string;
  onSubmit: (videoIds: string[]) => Promise<void>;
  onCancel: () => void;
}) {
  const t = useTranslations("creatives.launched.addVideos");
  const titleId = useId();
  const [videos, setVideos] = useState<LaunchOptions["videos"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/campaigns/videos?launchId=${encodeURIComponent(launchId)}`)
      .then(async (response) => {
        const data = (await response.json()) as { videos?: LaunchOptions["videos"]; message?: string; error?: string };
        if (!response.ok) throw new Error(data.message ?? data.error);
        if (!cancelled) setVideos(data.videos ?? []);
      })
      .catch(() => {
        if (!cancelled) setError(t("loadError"));
      });
    return () => {
      cancelled = true;
    };
  }, [launchId, t]);

  function toggle(id: string) {
    setPicked((list) => (list.includes(id) ? list.filter((v) => v !== id) : list.length >= MAX_PICK ? list : [...list, id]));
  }

  async function submit() {
    setSaving(true);
    try {
      await onSubmit(picked);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 grid gap-2.5 rounded-box border border-line bg-surface p-3 shadow-ctl">
      <p id={titleId} className="text-[13px] font-medium text-ink">
        {t("title", { count: picked.length, max: MAX_PICK })}
      </p>
      {error ? (
        <Note tone="danger">{error}</Note>
      ) : videos === null ? (
        <p role="status" className="text-xs text-ink-2">
          {t("loading")}
        </p>
      ) : videos.length === 0 ? (
        <Note tone="warn">{t("empty")}</Note>
      ) : (
        <VideoPickGrid videos={videos} picked={picked} disabled={saving} onToggle={toggle} labelledBy={titleId} />
      )}
      <p className="text-xs leading-snug text-ink-3">{t("hint")}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving || picked.length === 0}
          onClick={() => void submit()}
          className={buttonClass("primary", "sm")}
        >
          {saving ? t("saving") : t("submit", { count: picked.length })}
        </button>
        <button type="button" disabled={saving} onClick={onCancel} className={buttonClass("outline", "sm")}>
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
