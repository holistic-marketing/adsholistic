"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { CreativeDraftListItem } from "@/lib/creatives/types";
import { cleanCreativeDisplayName, creativeCardTitle } from "@/lib/creatives/clean-display-name";
import {
  classifyTikTokRejectReasons,
  clientFixAction,
  extractPrimaryRejectReason,
} from "@/lib/creatives/tiktok-reject-action";
import { parseRejectRecommendation } from "@/lib/creatives/reject-recommendation";
import { Button, buttonClass } from "@/components/ui/Button";
import { PanelCard } from "@/components/ui/PageHeader";
import { EmptyState, Note, Segmented, ToneBadge } from "@/components/ui/PanelKit";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { CreativeMediaTile } from "@/features/creative-analyzer/components/CreativeMediaTile";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import { cn } from "@/lib/cn";

type FilterId = "action" | "ready" | "all";

function isRejected(d: CreativeDraftListItem) {
  return d.status === "published" && d.tiktokReviewStatus === "rejected";
}

function isReady(d: CreativeDraftListItem) {
  return (
    d.status === "draft" || d.status === "approved" || d.status === "failed"
  );
}

function draftTitle(d: CreativeDraftListItem) {
  return creativeCardTitle({
    adName: d.brief.adName,
    campaignName: d.brief.campaignName,
    assetName: d.assetName,
    adText: d.brief.adText,
  });
}

function formatDraftWhen(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function reviewRank(d: CreativeDraftListItem): number {
  if (isRejected(d)) return 0;
  if (d.status === "failed") return 1;
  if (isReady(d)) return 2;
  return 3;
}

export function AgentProDraftsPanel({
  drafts,
  publishEnabled,
  expectDiscoverRefresh = false,
}: {
  drafts: CreativeDraftListItem[];
  publishEnabled: boolean;
  /** Una sola refresh diferida si hay advertisers y aún no hay rechazos TikTok. */
  expectDiscoverRefresh?: boolean;
}) {
  const t = useTranslations("creatives.drafts");
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const softRefreshDone = useRef(false);

  const counts = useMemo(() => {
    let rejected = 0;
    let ready = 0;
    let failed = 0;
    for (const d of drafts) {
      if (isRejected(d)) rejected += 1;
      else if (d.status === "failed") failed += 1;
      else if (isReady(d)) ready += 1;
    }
    return {
      rejected,
      ready,
      failed,
      action: rejected + failed,
    };
  }, [drafts]);

  useEffect(() => {
    if (!expectDiscoverRefresh) return;
    if (softRefreshDone.current) return;
    const missingHint = drafts.some(
      (d) =>
        isRejected(d) &&
        (!d.rejectFixHint ||
          !String(d.rejectFixHint).includes('"plan"') ||
          /Modifica el producto o servicio/i.test(String(d.rejectFixHint))),
    );
    const missingMedia = drafts.some(
      (d) => isRejected(d) && !d.previewUrl && !d.posterUrl,
    );
    const thinReasons = drafts.some(
      (d) =>
        isRejected(d) &&
        d.tiktokRejectReasons.every((r) =>
          /no dejó el motivo|material no disponible|problema de revisión/i.test(
            r,
          ),
        ),
    );
    if (
      counts.rejected > 0 &&
      !missingHint &&
      !missingMedia &&
      !thinReasons
    )
      return;
    if (typeof window === "undefined") return;
    const storageKey =
      counts.rejected === 0
        ? "creatives:discover-soft-refresh"
        : thinReasons
          ? "creatives:reasons-soft-refresh"
          : missingHint
            ? "creatives:hint-soft-refresh"
            : "creatives:media-soft-refresh";
    try {
      if (sessionStorage.getItem(storageKey) === "1") {
        softRefreshDone.current = true;
        return;
      }
    } catch {
      /* private mode */
    }
    softRefreshDone.current = true;
    const timer = window.setTimeout(() => {
      try {
        sessionStorage.setItem(storageKey, "1");
      } catch {
        /* ignore */
      }
      router.refresh();
    }, 12_000);
    return () => window.clearTimeout(timer);
  }, [expectDiscoverRefresh, counts.rejected, drafts, router]);

  const [filter, setFilter] = useState<FilterId>("action");
  const activeFilter: FilterId =
    filter === "action" && counts.action === 0 && drafts.length > 0
      ? counts.ready > 0
        ? "ready"
        : "all"
      : filter;

  const sorted = useMemo(
    () =>
      [...drafts].sort((a, b) => {
        const r = reviewRank(a) - reviewRank(b);
        if (r !== 0) return r;
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }),
    [drafts],
  );

  const visible = useMemo(() => {
    if (activeFilter === "all") return sorted;
    if (activeFilter === "action") {
      return sorted.filter((d) => isRejected(d) || d.status === "failed");
    }
    return sorted.filter(isReady);
  }, [sorted, activeFilter]);

  async function runAction(
    draftId: string,
    action: "approve" | "reject" | "publish",
    publish = false,
  ) {
    setBusyId(draftId);
    setError(null);
    setMessage(null);
    try {
      const res = await apiClient<{
        ok: boolean;
        status?: string;
        published?: boolean;
      }>("/api/creative-drafts", {
        method: "POST",
        body: JSON.stringify({ draftId, action, publish }),
      });
      if (action === "reject") setMessage(t("rejectedMsg"));
      else if (res.published || action === "publish")
        setMessage(t("publishedMsg"));
      else setMessage(t("approvedMsg"));
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : t("updateError"),
      );
    } finally {
      setBusyId(null);
    }
  }

  async function onAppeal(draftId: string, reason: string) {
    setBusyId(draftId);
    setError(null);
    setMessage(null);
    try {
      await apiClient<{ ok: boolean }>("/api/creative-drafts/appeal", {
        method: "POST",
        body: JSON.stringify({
          draftId,
          reason,
        }),
      });
      setMessage(t("appealSent"));
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : t("appealError"),
      );
    } finally {
      setBusyId(null);
    }
  }

  const panelTitle =
    counts.rejected > 0 ? t("titleRecent") : t("title");
  const panelSubtitle =
    counts.rejected > 0
      ? t("subtitleRecent")
      : publishEnabled
        ? t("subtitleEnabled")
        : t("subtitleDisabled");

  const showFilters =
    counts.rejected === 0 && (counts.ready > 0 || activeFilter !== "action");
  const filters: { id: FilterId; label: string; count: number }[] = [
    { id: "action", label: t("filterAction"), count: counts.action },
    { id: "ready", label: t("filterReady"), count: counts.ready },
    { id: "all", label: t("filterAll"), count: drafts.length },
  ];

  // El orden ya deja primero los rechazados: van como tarjetas y el resto como filas.
  const visibleRejected = visible.filter(isRejected);
  const visibleRows = visible.filter((d) => !isRejected(d));

  return (
    <PanelCard title={panelTitle} description={panelSubtitle} ruled>
      {drafts.length > 0 && showFilters ? (
        <div className="mb-4 overflow-x-auto">
          <Segmented
            label={panelTitle}
            value={activeFilter}
            onChange={setFilter}
            options={filters.map((f) => ({
              value: f.id,
              label: (
                <>
                  {f.label}
                  <span className="num text-ink-3">{f.count}</span>
                </>
              ),
            }))}
          />
        </div>
      ) : null}

      {!publishEnabled || error || message ? (
        <div className="mb-4 grid gap-2">
          {!publishEnabled ? (
            <Note tone="warn">
              {t("publishHintBefore")}
              <code className="rounded bg-surface px-1 font-mono text-xs">TIKTOK_CREATIVE_PUBLISH_ENABLED=true</code>
              {t("publishHintAfter")}
            </Note>
          ) : null}
          {error ? <Note tone="danger">{error}</Note> : null}
          {message ? (
            <Note tone="ok" icon="check-circle">
              {message}
            </Note>
          ) : null}
        </div>
      ) : null}

      {drafts.length === 0 ? (
        <EmptyState
          icon="video"
          title={t("emptyTitle")}
          description={t("emptyBody")}
          action={
            <Link href="#creative-upload" className={buttonClass("primary")}>
              <PanelIcon name="upload" />
              {t("emptyCta")}
            </Link>
          }
        />
      ) : visible.length === 0 ? (
        <div className="grid justify-items-center gap-2 py-8 text-center">
          <p className="text-ink-2">{activeFilter === "action" ? t("noProblemsBody") : t("filterEmpty")}</p>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className="text-[13px] font-medium text-accent-text underline-offset-[3px] hover:underline"
          >
            {t("filterShowAll")}
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {visibleRejected.length > 0 ? (
            <ul className={cn("grid gap-3", counts.rejected > 1 ? "lg:grid-cols-2" : null)}>
              {visibleRejected.map((draft) => (
                <RejectedDraftCard
                  key={draft.id}
                  draft={draft}
                  busy={busyId === draft.id}
                  onAppeal={onAppeal}
                />
              ))}
            </ul>
          ) : null}

          {visibleRows.length > 0 ? (
            <ul className="divide-y divide-line">
              {visibleRows.map((draft) => {
                const title = draftTitle(draft);
                const failed = draft.status === "failed";
                const canSend = isReady(draft);
                const canApproveOnly = draft.status === "draft" || draft.status === "failed";
                const canReject = draft.status === "draft";
                const isDiscovered = draft.discoverSource === "tiktok_ads_manager";
                const sameFail = draft.brief.notes
                  .find((n) => n.startsWith("SAME_FAIL:"))
                  ?.replace(/^SAME_FAIL:\s*/, "");
                const status = failed
                  ? { tone: "danger" as const, label: t("statusFailed") }
                  : draft.status === "approved"
                    ? { tone: "info" as const, label: t("statusApproved") }
                    : draft.status === "published"
                      ? { tone: "ok" as const, label: t("statusPublished") }
                      : { tone: "neutral" as const, label: t("statusDraft") };

                return (
                  <li key={draft.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 md:flex-row md:items-center">
                    <div className="flex min-w-0 flex-1 gap-3">
                      <CreativeMediaTile
                        previewUrl={draft.previewUrl}
                        posterUrl={draft.posterUrl}
                        mediaKind={draft.mediaKind ?? (draft.previewUrl ? "video" : null)}
                        label={title}
                        playLabel={t("playVideo")}
                        closeLabel={t("closeVideo")}
                        size="row"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="min-w-0 truncate font-semibold text-ink">{title}</p>
                          <ToneBadge tone={status.tone} dot>
                            {status.label}
                          </ToneBadge>
                        </div>
                        {draft.parentDraftId ? (
                          <p className="mt-0.5 text-xs font-medium text-accent-text">
                            {t("fixOf", {
                              name: cleanCreativeDisplayName(draft.parentLabel || t("briefFallback")),
                            })}
                          </p>
                        ) : null}
                        {failed && draft.errorMessage ? (
                          <p className="mt-1 text-xs text-danger-fg">{draft.errorMessage}</p>
                        ) : null}
                        {sameFail ? (
                          <Note tone="danger" className="mt-2">
                            {sameFail}
                          </Note>
                        ) : null}
                        {!isDiscovered && draft.brief.hookCopy ? (
                          <p className="mt-1 line-clamp-2 text-xs text-ink-2">{draft.brief.hookCopy}</p>
                        ) : null}
                      </div>
                    </div>

                    {canSend ? (
                      <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">
                        <Button
                          size="sm"
                          disabled={busyId === draft.id || !publishEnabled}
                          onClick={() => {
                            if (draft.status === "approved") {
                              void runAction(draft.id, "publish");
                            } else {
                              void runAction(draft.id, "approve", true);
                            }
                          }}
                        >
                          <PanelIcon name="send" />
                          {busyId === draft.id ? t("sending") : t("sendToTikTok")}
                          <span className="sr-only">: {title}</span>
                        </Button>
                        {canApproveOnly ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === draft.id}
                            onClick={() => void runAction(draft.id, "approve", false)}
                          >
                            {t("approveOnly")}
                          </Button>
                        ) : null}
                        {canReject ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busyId === draft.id}
                            onClick={() => void runAction(draft.id, "reject")}
                          >
                            {t("reject")}
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      )}
    </PanelCard>
  );
}

/** Anuncio rechazado por TikTok: qué pasó, cómo arreglarlo y qué hacer ahora. */
function RejectedDraftCard({
  draft,
  busy,
  onAppeal,
}: {
  draft: CreativeDraftListItem;
  busy: boolean;
  onAppeal: (draftId: string, reason: string) => Promise<void>;
}) {
  const t = useTranslations("creatives.drafts");
  const locale = useLocale();
  const title = draftTitle(draft);
  const actionKind = classifyTikTokRejectReasons(draft.tiktokRejectReasons);
  const recommended = parseRejectRecommendation(draft.rejectFixHint);
  const whyLines = draft.tiktokRejectReasons
    .map((reason) =>
      reason
        .replace(/\(\s*UNAVAILABLE\s*\)/gi, "")
        .replace(/\bUNAVAILABLE\b/gi, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((reason) => reason.length > 12)
    .slice(0, 3);
  const whyPrimary =
    extractPrimaryRejectReason(draft.tiktokRejectReasons) || t(`simpleReason_${actionKind}`);
  const description = draft.brief.adText.trim();
  const canUpload = clientFixAction(actionKind) !== "fix_page";
  const howto = recommended?.plan || t(`fixHint_${actionKind}`);
  const suggestedAd =
    recommended?.adText && !/Video\s*\d+/i.test(recommended.adText) ? recommended.adText : null;
  const appealCopy = recommended?.appeal?.trim() || null;
  const weightBan =
    /p[eé]rdida de peso|bajar de peso|weight|grasa|metabolismo|sector prohibido|suplement/i.test(
      draft.tiktokRejectReasons.join(" "),
    );
  const appealStatus = (draft.appealStatus || "").toUpperCase();
  const canAppeal =
    Boolean(draft.externalAdId) &&
    Boolean(appealCopy) &&
    !weightBan &&
    (appealStatus === "NOT_APPEALED" || appealStatus === "");
  const appealing = /APPEALING|IN_APPEAL|PENDING/i.test(appealStatus);
  const whyUnique = whyLines.filter(
    (line, index) => whyLines.findIndex((other) => other.slice(0, 60) === line.slice(0, 60)) === index,
  );
  const when = formatDraftWhen(draft.publishedAt || draft.createdAt, locale);

  return (
    <li className="flex min-w-0 flex-col overflow-hidden rounded-box border border-line bg-surface">
      <div className="flex gap-3.5 p-4">
        <CreativeMediaTile
          previewUrl={draft.previewUrl}
          posterUrl={draft.posterUrl}
          mediaKind={
            draft.mediaKind ??
            (draft.posterUrl && !draft.previewUrl ? "image" : draft.previewUrl ? "video" : null)
          }
          label={title}
          playLabel={t("playVideo")}
          closeLabel={t("closeVideo")}
          emptyLabel={
            draft.posterUrl || draft.previewUrl
              ? undefined
              : actionKind === "media_invalid"
                ? t("mediaGone")
                : t("noPreview")
          }
          size="poster"
        />
        <div className="min-w-0 flex-1">
          <ToneBadge tone="danger" dot>
            {t("tiktokRejected")}
          </ToneBadge>
          <p className="mt-1.5 line-clamp-2 text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</p>
          {draft.accountName || when ? (
            <p className="mt-0.5 line-clamp-2 text-xs text-ink-3">
              {[draft.accountName, when].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mx-4 mb-4 rounded-box border border-accent-line bg-accent-soft px-3 py-2.5">
        <p className="text-xs font-semibold text-accent-text">{t("howtoLabel")}</p>
        <p className="mt-0.5 text-[13px] leading-5 text-ink">{howto}</p>
        {recommended?.videoFix ? (
          <p className="mt-1.5 text-[13px] leading-5 text-ink-2">
            <span className="font-semibold text-ink">{t("videoFixLabel")}:</span> {recommended.videoFix}
          </p>
        ) : null}
        {recommended?.editFocus ? (
          <ToneBadge tone="accent" className="mt-2">
            {t(`editFocus_${recommended.editFocus}`)}
          </ToneBadge>
        ) : null}
      </div>

      <div className="mt-auto grid gap-3 border-t border-line px-4 py-3">
        {draft.hasActiveFix ? (
          <Note tone="ok" icon="check-circle">
            {t("fixInProgress")}
          </Note>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {canUpload ? (
              <Link
                href={`?fixDraft=${encodeURIComponent(draft.id)}${
                  draft.adAccountId ? `&fixAccount=${encodeURIComponent(draft.adAccountId)}` : ""
                }&fixLabel=${encodeURIComponent(title)}&fixKind=${encodeURIComponent(actionKind)}#creative-upload`}
                className={buttonClass("primary", "sm")}
              >
                <PanelIcon name="upload" />
                {t("uploadFixed")}
              </Link>
            ) : (
              <p className="text-xs font-semibold text-ink">{t("ctaPage")}</p>
            )}
            {appealing ? (
              <span className="text-xs font-medium text-ink-2">{t("appealPending")}</span>
            ) : canAppeal && appealCopy ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const ok = window.confirm(
                    `${t("appealConfirmTitle")}\n\n${appealCopy}\n\n${t("appealConfirmBody")}`,
                  );
                  if (ok) void onAppeal(draft.id, appealCopy);
                }}
                className="text-[13px] font-medium text-accent-text underline-offset-[3px] hover:underline disabled:opacity-60"
              >
                {t("ctaAppeal")}
              </button>
            ) : null}
          </div>
        )}

        <details className="group rounded-box border border-line bg-field px-3 py-2">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-semibold text-ink-2 [&::-webkit-details-marker]:hidden">
            {t("tiktokRejectReasonsLabel")}
            <PanelIcon name="chevron-down" className="size-4 text-ink-3 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2 grid gap-2 text-[13px] leading-5 text-ink-2">
            {whyUnique.length > 0 ? (
              whyUnique.map((line) => (
                <p key={line.slice(0, 64)}>{line.length > 260 ? `${line.slice(0, 257).trim()}…` : line}</p>
              ))
            ) : (
              <p>{whyPrimary}</p>
            )}
            {recommended?.quote ? (
              <p>
                <span className="font-semibold text-ink">{t("videoSaysLabel")}:</span> “{recommended.quote}”
              </p>
            ) : null}
            {suggestedAd ? (
              <p>
                <span className="font-semibold text-ink">{t("aiAdTextLabel")}:</span> “{suggestedAd}”
              </p>
            ) : null}
            <p>
              <span className="font-semibold text-ink">{t("descLabel")}:</span> {description || t("noAdText")}
            </p>
            {weightBan || actionKind === "claims" || actionKind === "policy" ? (
              <p className="text-xs text-ink-3">{t("appealHintWeak")}</p>
            ) : null}
          </div>
        </details>
      </div>
    </li>
  );
}
