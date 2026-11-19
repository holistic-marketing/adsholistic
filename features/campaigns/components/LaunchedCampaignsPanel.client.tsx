"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { buttonClass } from "@/components/ui/Button";
import { PanelCard } from "@/components/ui/PageHeader";
import { EmptyState, Note, SquareIcon, ToneBadge, type Tone } from "@/components/ui/PanelKit";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { cn } from "@/lib/cn";
import type { LaunchSummary } from "@/lib/campaigns/launch-actions.server";
import type { LaunchAction } from "@/lib/campaigns/launch-optimizer";
import { AddVideosPicker } from "@/features/campaigns/components/AddVideosPicker.client";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

const KIND_TONE: Record<LaunchAction["kind"], Tone> = {
  pause_video: "danger",
  raise_budget: "ok",
  new_video: "warn",
  all_losing: "danger",
};

/** Tono de lo ya decidido en el historial de cada campaña. */
const STATUS_TONE: Record<string, Tone> = { applied: "ok", failed: "danger", dismissed: "neutral" };

type Action = LaunchSummary["actions"][number];

/** Sugerencias que se resuelven sumando videos nuevos a la campaña. */
const NEEDS_VIDEOS = new Set<LaunchAction["kind"]>(["new_video", "all_losing"]);

async function fetchLaunches(): Promise<LaunchSummary[]> {
  const response = await fetch("/api/campaigns/actions");
  const data = (await response.json()) as { launches?: LaunchSummary[]; error?: string };
  if (!response.ok) throw new Error(data.error);
  return data.launches ?? [];
}

/** Campañas lanzadas desde Ads Holistic con las sugerencias del día para aprobar o descartar. */
export function LaunchedCampaignsPanel() {
  const t = useTranslations("creatives.launched");
  const [launches, setLaunches] = useState<LaunchSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ id: string; ok: boolean; text: string } | null>(null);
  /** Selector de videos abierto: para la campaña o para resolver una sugerencia. */
  const [picker, setPicker] = useState<{ launchId: string; actionId: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetchLaunches()
        .then((list) => {
          if (!cancelled) setLaunches(list);
        })
        .catch(() => {
          if (!cancelled) setError(t("errors.load"));
        });
    void load();
    window.addEventListener("campaign-launched", load);
    return () => {
      cancelled = true;
      window.removeEventListener("campaign-launched", load);
    };
  }, [t]);

  async function decide(action: Action, decision: "apply" | "dismiss", videoIds?: string[]) {
    setBusy(action.id);
    setNotice(null);
    try {
      const response = await fetch("/api/campaigns/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId: action.id, decision, videoIds }),
      });
      const data = (await response.json()) as { ok: boolean; status?: string; message?: string; error?: string };
      setNotice({
        id: action.id,
        ok: data.ok,
        text: data.ok
          ? t(decision === "dismiss" ? "done.dismissed" : videoIds?.length ? "done.videosAdded" : NEEDS_VIDEOS.has(action.kind) ? "done.handled" : "done.applied")
          : (data.message ?? data.error ?? t("errors.decide")),
      });
      if (data.ok) {
        setPicker(null);
        setLaunches(await fetchLaunches());
      }
    } catch {
      setNotice({ id: action.id, ok: false, text: t("errors.decide") });
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  }

  async function setRunning(launch: LaunchSummary, running: boolean) {
    if (running && !window.confirm(t("running.confirm", { budget: usd.format(launch.dailyBudget) }))) return;
    setBusy(launch.id);
    setNotice(null);
    try {
      const response = await fetch("/api/campaigns/actions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ launchId: launch.id, running }),
      });
      const data = (await response.json()) as { ok: boolean; message?: string; error?: string };
      if (data.ok) setLaunches((list) => (list ?? []).map((l) => (l.id === launch.id ? { ...l, running } : l)));
      setNotice({
        id: launch.id,
        ok: data.ok,
        text: data.ok ? t(running ? "running.on" : "running.off") : (data.message ?? data.error ?? t("errors.decide")),
      });
    } catch {
      setNotice({ id: launch.id, ok: false, text: t("errors.decide") });
    } finally {
      setBusy(null);
    }
  }

  async function changeMode(launch: LaunchSummary, mode: "suggest" | "auto") {
    if (mode === "auto" && !window.confirm(t("autoMode.confirm"))) return;
    setBusy(launch.id);
    setNotice(null);
    try {
      const response = await fetch("/api/campaigns/actions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ launchId: launch.id, mode }),
      });
      if (!response.ok) throw new Error();
      setLaunches((list) => (list ?? []).map((l) => (l.id === launch.id ? { ...l, optimizeMode: mode } : l)));
      setNotice({ id: launch.id, ok: true, text: t(mode === "auto" ? "autoMode.on" : "autoMode.off") });
    } catch {
      setNotice({ id: launch.id, ok: false, text: t("errors.decide") });
    } finally {
      setBusy(null);
    }
  }

  async function addVideos(launchId: string, videoIds: string[]) {
    setNotice(null);
    try {
      const response = await fetch("/api/campaigns/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ launchId, videoIds }),
      });
      const data = (await response.json()) as { ok: boolean; added?: string[]; message?: string; error?: string };
      setNotice({
        id: launchId,
        ok: data.ok,
        text: data.ok ? t("addVideos.done", { count: data.added?.length ?? 0 }) : (data.message ?? data.error ?? t("errors.decide")),
      });
      if (data.ok) setPicker(null);
    } catch {
      setNotice({ id: launchId, ok: false, text: t("errors.decide") });
    }
  }

  function describe(p: LaunchAction): string {
    switch (p.kind) {
      case "pause_video":
        return p.costPerResult === null
          ? t("describe.pauseNoSales", { video: p.videoName, spend: usd.format(p.spend), avg: usd.format(p.campaignCostPerResult) })
          : t("describe.pause", { video: p.videoName, cpr: usd.format(p.costPerResult), avg: usd.format(p.campaignCostPerResult) });
      case "raise_budget":
        return t("describe.raise", {
          from: usd.format(p.fromBudget),
          to: usd.format(p.toBudget),
          cpr: usd.format(p.costPerResult),
          avg: usd.format(p.clientCostPerResult),
          pct: p.cheaperPct,
        });
      case "new_video":
        return t("describe.newVideo", { video: p.videoName, pct: p.ctrDropPct });
      case "all_losing":
        return t("describe.allLosing", { count: p.losers });
    }
  }

  return (
    <PanelCard
      id="launched-campaigns"
      className="scroll-mt-4"
      ruled
      title={
        <>
          <span className="eyebrow mb-1 block leading-4">{t("kicker")}</span>
          {t("title")}
        </>
      }
      description={t("subtitle")}
    >
      {error ? (
        <Note tone="danger">{error}</Note>
      ) : launches === null ? (
        <p role="status" className="text-[13px] text-ink-2">
          {t("loading")}
        </p>
      ) : launches.length === 0 ? (
        <EmptyState icon="megaphone" title={t("empty")} className="py-8" />
      ) : (
        <ul className="grid gap-4">
          {launches.map((launch) => {
            const pending = launch.actions.filter((a) => a.status === "suggested");
            const history = launch.actions.filter((a) => a.status !== "suggested").slice(0, 3);
            return (
              <li key={launch.id} className="grid min-w-0 gap-3 rounded-box border border-line p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-[1_1_240px] items-start gap-2.5">
                    <SquareIcon icon="megaphone" tone="accent" />
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h3 className="min-w-0 max-w-full truncate text-sm font-semibold text-ink" title={launch.campaignName}>
                          {launch.campaignName}
                        </h3>
                        {launch.running !== null ? (
                          <ToneBadge tone={launch.running ? "ok" : "neutral"} dot>
                            {t(launch.running ? "running.badgeOn" : "running.badgeOff")}
                          </ToneBadge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-ink-2">
                        <span className="tabular-nums">
                          {t("meta", {
                            budget: usd.format(launch.dailyBudget),
                            date: new Date(launch.createdAt).toLocaleDateString("es-PE", { day: "2-digit", month: "short" }),
                          })}
                        </span>
                        {" · "}
                        {t(`mode.${launch.optimizeMode}`)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {launch.running !== null ? (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void setRunning(launch, !launch.running)}
                        className={buttonClass(launch.running ? "outline" : "primary", "sm")}
                      >
                        <PanelIcon name={launch.running ? "pause-circle" : "bolt"} />
                        {busy === launch.id ? t("applying") : t(launch.running ? "running.pause" : "running.start")}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => setPicker({ launchId: launch.id, actionId: null })}
                      className={buttonClass("outline", "sm")}
                    >
                      {t("addVideos.open")}
                    </button>
                    <a
                      href={`https://ads.tiktok.com/i18n/perf/campaign?aadvid=${launch.advertiserId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonClass("ghost", "sm")}
                    >
                      {t("openAdsManager")}
                      <PanelIcon name="external" />
                    </a>
                  </div>
                </div>

                <AutoModeSwitch
                  checked={launch.optimizeMode === "auto"}
                  disabled={busy !== null || launch.optimizeMode === "off"}
                  label={t("autoMode.label")}
                  hint={t("autoMode.hint")}
                  onChange={(on) => void changeMode(launch, on ? "auto" : "suggest")}
                />

                {notice?.id === launch.id ? <Note tone={notice.ok ? "ok" : "danger"}>{notice.text}</Note> : null}
                {picker?.launchId === launch.id && picker.actionId === null ? (
                  <AddVideosPicker
                    launchId={launch.id}
                    onSubmit={(videoIds) => addVideos(launch.id, videoIds)}
                    onCancel={() => setPicker(null)}
                  />
                ) : null}

                {pending.length === 0 ? (
                  <p className="text-xs text-ink-2">{t("noPending")}</p>
                ) : (
                  <ul className="grid gap-2.5">
                    {pending.map((action) => (
                      <li key={action.id} className="rounded-box border border-line bg-field p-3">
                        <ToneBadge tone={KIND_TONE[action.kind]}>{t(`kind.${action.kind}`)}</ToneBadge>
                        <p className="mt-2 text-[13px] leading-5 text-ink">{describe(action.payload)}</p>
                        {action.error ? <p className="mt-1 text-xs text-danger-fg">{action.error}</p> : null}
                        {notice?.id === action.id ? (
                          <Note tone={notice.ok ? "ok" : "danger"} className="mt-2">
                            {notice.text}
                          </Note>
                        ) : null}
                        <div className="mt-2.5 flex flex-wrap gap-2">
                          {confirming === action.id ? (
                            <>
                              <button
                                type="button"
                                disabled={busy !== null}
                                onClick={() => void decide(action, "apply")}
                                className={buttonClass("primary", "sm")}
                              >
                                {busy === action.id ? t("applying") : t(`confirm.${action.kind}`)}
                              </button>
                              <button
                                type="button"
                                disabled={busy !== null}
                                onClick={() => setConfirming(null)}
                                className={buttonClass("outline", "sm")}
                              >
                                {t("cancel")}
                              </button>
                            </>
                          ) : (
                            <>
                              {NEEDS_VIDEOS.has(action.kind) ? (
                                <button
                                  type="button"
                                  disabled={busy !== null}
                                  onClick={() => setPicker({ launchId: launch.id, actionId: action.id })}
                                  className={buttonClass("primary", "sm")}
                                >
                                  {t("addVideos.fromSuggestion")}
                                </button>
                              ) : null}
                              <button
                                type="button"
                                disabled={busy !== null}
                                onClick={() => setConfirming(action.id)}
                                className={buttonClass(NEEDS_VIDEOS.has(action.kind) ? "outline" : "primary", "sm")}
                              >
                                {t(`apply.${action.kind}`)}
                              </button>
                              <button
                                type="button"
                                disabled={busy !== null}
                                onClick={() => void decide(action, "dismiss")}
                                className={buttonClass("ghost", "sm")}
                              >
                                {t("dismiss")}
                              </button>
                            </>
                          )}
                        </div>
                        {picker?.actionId === action.id ? (
                          <AddVideosPicker
                            launchId={launch.id}
                            onSubmit={(videoIds) => decide(action, "apply", videoIds)}
                            onCancel={() => setPicker(null)}
                          />
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}

                {history.length > 0 ? (
                  <ul className="border-t border-line">
                    {history.map((action) => (
                      <li
                        key={action.id}
                        className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line py-2 text-xs text-ink-2 last:border-b-0 last:pb-0"
                      >
                        <ToneBadge tone={STATUS_TONE[action.status] ?? "neutral"}>
                          {t(`status.${action.status as "applied" | "failed" | "dismissed"}`)}
                        </ToneBadge>
                        <span className="font-medium text-ink">{t(`kind.${action.kind}`)}</span>
                        {action.auto ? <span>· {t("autoMode.badge")}</span> : null}
                        {action.error ? <span className="min-w-0 [overflow-wrap:anywhere]">· {action.error}</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </PanelCard>
  );
}

/** Interruptor v3 del modo automático: casilla nativa con pista y bolita. */
function AutoModeSwitch({
  checked,
  disabled,
  label,
  hint,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  hint: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "relative flex items-start gap-3 rounded-box bg-field px-3 py-2.5",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
      )}
    >
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer absolute left-3 top-3 m-0 h-5 w-[34px] cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
      <span
        aria-hidden
        className="relative mt-0.5 h-5 w-[34px] shrink-0 rounded-full bg-line-strong transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-on-accent after:shadow-ctl after:transition-transform peer-checked:bg-accent-btn peer-checked:after:translate-x-3.5 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus peer-disabled:opacity-50 motion-reduce:transition-none motion-reduce:after:transition-none"
      />
      <span className="min-w-0 text-[13px] leading-snug text-ink">
        <span className="font-medium">{label}</span>
        <span className="mt-0.5 block text-xs text-ink-2">{hint}</span>
      </span>
    </label>
  );
}
