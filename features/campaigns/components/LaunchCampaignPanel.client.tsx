"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { buttonClass } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { PanelCard } from "@/components/ui/PageHeader";
import { Note, PropList, ToneBadge } from "@/components/ui/PanelKit";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { cn } from "@/lib/cn";
import type { CreativeAccountOption } from "@/lib/creatives/types";
import type { LaunchOptions } from "@/lib/campaigns/launch-options.server";
import { COUNTRY_LOCATION_IDS, MIN_DAILY_BUDGET, type CampaignCountry } from "@/lib/campaigns/smart-plus-plan";
import type { CampaignBriefEvent } from "@/features/campaigns/components/CampaignBriefPanel.client";
import { VideoPickGrid } from "@/features/campaigns/components/VideoPickGrid";

type CreateResponse =
  | { ok: true; campaignId: string; adgroupId: string; adId: string; advertiserId: string }
  | { ok: false; step?: string; errors?: string[]; message?: string; error?: string; campaignId?: string };

const COUNTRIES = Object.keys(COUNTRY_LOCATION_IDS) as CampaignCountry[];
/** Opción para crear un perfil propio de la cuenta con el nombre de la tienda. */
const NEW_IDENTITY = "NEW";
/** Smart+ prueba varios videos y se queda con el que vende; más de 10 no ayuda. */
const MAX_PICK = 10;

function todayLabel(): string {
  return new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
}

/**
 * Lanza una campaña Smart+ de ventas web en la cuenta elegida, con el molde de
 * las campañas que más venden. Queda pausada en TikTok para revisarla.
 */
export function LaunchCampaignPanel({
  clienteName,
  accounts = [],
}: {
  clienteName?: string;
  accounts?: CreativeAccountOption[];
}) {
  const t = useTranslations("creatives.launch");
  const fieldId = useId();
  const approved = accounts.filter((a) => a.status === "active");
  const [adAccountId, setAdAccountId] = useState(approved[0]?.id ?? "");
  const [options, setOptions] = useState<LaunchOptions | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(() => Boolean(approved[0]?.id));
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const [videoIds, setVideoIds] = useState<string[]>([]);
  const [pixelId, setPixelId] = useState("");
  const [identityKey, setIdentityKey] = useState("");
  const [campaignName, setCampaignName] = useState(() => `${clienteName ?? t("defaultName")} · ${todayLabel()}`);
  const [dailyBudget, setDailyBudget] = useState(String(MIN_DAILY_BUDGET));
  const [country, setCountry] = useState<CampaignCountry>("PE");
  const [texts, setTexts] = useState(["", ""]);
  const [landingPageUrl, setLandingPageUrl] = useState("");

  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<CreateResponse | null>(null);
  /** Se llenó con el asistente de IA (se avisa para que lo revisen). */
  const [fromBrief, setFromBrief] = useState(false);

  useEffect(() => {
    const onBrief = (event: Event) => {
      const detail = (event as CustomEvent<CampaignBriefEvent>).detail;
      if (!detail) return;
      if (detail.texts.length > 0) setTexts(detail.texts);
      setLandingPageUrl(detail.landingPageUrl);
      setDailyBudget(String(detail.dailyBudget));
      setCampaignName(detail.campaignName);
      if (detail.country in COUNTRY_LOCATION_IDS) setCountry(detail.country);
      setResult(null);
      setFromBrief(true);
    };
    window.addEventListener("campaign-brief", onBrief);
    return () => window.removeEventListener("campaign-brief", onBrief);
  }, []);

  useEffect(() => {
    if (!adAccountId) return;
    let cancelled = false;
    fetch(`/api/campaigns/launch?adAccountId=${encodeURIComponent(adAccountId)}`)
      .then(async (response) => {
        const data = (await response.json()) as LaunchOptions & { error?: string };
        if (cancelled) return;
        if (!response.ok) {
          setOptionsError(data.error ?? t("errors.options"));
          return;
        }
        setOptions(data);
        setPixelId(data.pixels[0]?.id ?? "");
        const first = data.identities[0];
        setIdentityKey(first ? `${first.type}:${first.id}` : NEW_IDENTITY);
        setVideoIds(data.videos.slice(0, 1).map((v) => v.videoId));
      })
      .catch(() => {
        if (!cancelled) setOptionsError(t("errors.options"));
      })
      .finally(() => {
        if (!cancelled) setLoadingOptions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [adAccountId, t]);

  function changeAccount(id: string) {
    setAdAccountId(id);
    setLoadingOptions(true);
    setOptionsError(null);
    setOptions(null);
    setResult(null);
  }

  function toggleVideo(id: string) {
    setVideoIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : prev.length >= MAX_PICK ? prev : [...prev, id],
    );
  }

  async function handleCreate() {
    const identity = options?.identities.find((i) => `${i.type}:${i.id}` === identityKey);
    const identityBody =
      identityKey === NEW_IDENTITY
        ? { type: "NEW", name: clienteName ?? campaignName }
        : identity
          ? { type: identity.type, id: identity.id, bcId: identity.bcId }
          : {};
    setCreating(true);
    setResult(null);
    try {
      const response = await fetch("/api/campaigns/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adAccountId,
          campaignName,
          dailyBudget: Number(dailyBudget),
          country,
          pixelId,
          videoIds,
          adTexts: texts,
          landingPageUrl,
          identity: identityBody,
        }),
      });
      const data = (await response.json()) as CreateResponse;
      setResult(data);
      // La lista de campañas lanzadas (abajo) se recarga para prenderla desde ahí.
      if (data.ok) window.dispatchEvent(new Event("campaign-launched"));
    } catch {
      setResult({ ok: false, message: t("errors.network") });
    } finally {
      setCreating(false);
    }
  }

  const resultError =
    result && !result.ok
      ? result.errors?.length
        ? result.errors.map((e) => t(`errors.${e}` as "errors.noPixel")).join(" ")
        : `${result.step ? `${t(`steps.${result.step}` as "steps.ad")}: ` : ""}${result.message ?? result.error ?? t("errors.network")}`
      : null;

  return (
    <PanelCard
      id="launch-campaign"
      className="scroll-mt-4 overflow-hidden"
      ruled
      title={
        <>
          <span className="eyebrow mb-1 block leading-4">{t("kicker")}</span>
          {t("title")}
        </>
      }
      description={t("subtitle")}
      bodyClassName="p-0 sm:p-0 grid lg:grid-cols-[minmax(0,1.3fr)_minmax(260px,0.7fr)]"
    >
      <div className="grid min-w-0 content-start gap-4 px-4 py-4 sm:px-6 sm:py-5">
        {fromBrief ? (
          <Note tone="accent" icon="sparkle">
            {t("fromBrief")}
          </Note>
        ) : null}

        <Field label={t("account")} htmlFor={approved.length === 0 ? undefined : `${fieldId}-account`}>
          {approved.length === 0 ? (
            <Note tone="warn">{t("errors.noAccount")}</Note>
          ) : (
            <Select
              id={`${fieldId}-account`}
              value={adAccountId}
              disabled={creating}
              onChange={(e) => changeAccount(e.target.value)}
            >
              {approved.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                  {account.bmLabel ? ` · ${account.bmLabel}` : ""}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {loadingOptions ? (
          <p role="status" className="text-[13px] text-ink-2">
            {t("loading")}
          </p>
        ) : optionsError ? (
          <Note tone="danger">{optionsError}</Note>
        ) : options ? (
          <>
            <Field label={t("videos", { count: videoIds.length, max: MAX_PICK })} labelId={`${fieldId}-videos`} hint={t("videosHint")}>
              {options.videos.length === 0 ? (
                <Note tone="warn">{t("errors.noVideosInLibrary")}</Note>
              ) : (
                <VideoPickGrid
                  videos={options.videos}
                  picked={videoIds}
                  disabled={creating}
                  onToggle={toggleVideo}
                  labelledBy={`${fieldId}-videos`}
                />
              )}
            </Field>

            <div className="grid gap-x-3 gap-y-4 sm:grid-cols-2">
              <Field label={t("name")} htmlFor={`${fieldId}-name`} className="sm:col-span-2">
                <Input
                  id={`${fieldId}-name`}
                  value={campaignName}
                  maxLength={100}
                  disabled={creating}
                  onChange={(e) => setCampaignName(e.target.value)}
                />
              </Field>
              <Field label={t("budget")} htmlFor={`${fieldId}-budget`}>
                <Input
                  id={`${fieldId}-budget`}
                  value={dailyBudget}
                  inputMode="decimal"
                  disabled={creating}
                  onChange={(e) => setDailyBudget(e.target.value)}
                  className="tabular-nums"
                />
              </Field>
              <Field label={t("country")} htmlFor={`${fieldId}-country`}>
                <Select
                  id={`${fieldId}-country`}
                  value={country}
                  disabled={creating}
                  onChange={(e) => setCountry(e.target.value as CampaignCountry)}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>
                      {t(`countries.${c}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("pixel")} htmlFor={options.pixels.length === 0 ? undefined : `${fieldId}-pixel`}>
                {options.pixels.length === 0 ? (
                  <Note tone="warn">{t("errors.noPixel")}</Note>
                ) : (
                  <Select id={`${fieldId}-pixel`} value={pixelId} disabled={creating} onChange={(e) => setPixelId(e.target.value)}>
                    {options.pixels.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label={t("identity")} htmlFor={`${fieldId}-identity`} hint={t("identityHint")}>
                <Select
                  id={`${fieldId}-identity`}
                  value={identityKey}
                  disabled={creating}
                  onChange={(e) => setIdentityKey(e.target.value)}
                >
                  {options.identities.map((i) => (
                    <option key={`${i.type}:${i.id}`} value={`${i.type}:${i.id}`}>
                      {i.name}
                    </option>
                  ))}
                  <option value={NEW_IDENTITY}>{t("newIdentity", { name: clienteName ?? t("defaultName") })}</option>
                </Select>
              </Field>
              {texts.map((text, i) => (
                <Field key={i} label={t("text", { n: i + 1 })} htmlFor={`${fieldId}-text-${i}`} className="sm:col-span-2">
                  <Input
                    id={`${fieldId}-text-${i}`}
                    value={text}
                    maxLength={100}
                    disabled={creating}
                    placeholder={t(i === 0 ? "textPlaceholder1" : "textPlaceholder2")}
                    onChange={(e) => setTexts((prev) => prev.map((v, k) => (k === i ? e.target.value : v)))}
                  />
                </Field>
              ))}
              <Field label={t("landing")} htmlFor={`${fieldId}-landing`} className="sm:col-span-2">
                <Input
                  id={`${fieldId}-landing`}
                  value={landingPageUrl}
                  inputMode="url"
                  disabled={creating}
                  placeholder="https://tutienda.com/products/…"
                  onChange={(e) => setLandingPageUrl(e.target.value)}
                />
              </Field>
            </div>

            {resultError ? <Note tone="danger">{resultError}</Note> : null}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || videoIds.length === 0}
                className={buttonClass("primary")}
              >
                <PanelIcon name="send" />
                {creating ? t("creating") : t("create")}
              </button>
              <span className="text-xs text-ink-2">{t("pausedNote")}</span>
            </div>
          </>
        ) : null}
      </div>

      <aside className="border-t border-line bg-field px-4 py-4 sm:px-6 sm:py-5 lg:border-l lg:border-t-0">
        {result?.ok ? (
          <div role="status">
            <ToneBadge tone="ok" icon="check-circle">
              {t("done.kicker")}
            </ToneBadge>
            <h3 className="mt-2 text-base font-semibold text-ink">{t("done.title")}</h3>
            <PropList
              className="mt-3"
              items={(
                [
                  ["campaign", result.campaignId],
                  ["adgroup", result.adgroupId],
                  ["ad", result.adId],
                ] as const
              ).map(([k, v]) => ({ label: t(`done.${k}`), value: <span className="num">{v}</span> }))}
            />
            <a
              href={`https://ads.tiktok.com/i18n/perf/campaign?aadvid=${result.advertiserId}`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass("outline", "md", "mt-4")}
            >
              {t("done.open")}
              <PanelIcon name="external" />
            </a>
            <p className="mt-3 text-xs leading-snug text-ink-2">{t("done.next")}</p>
          </div>
        ) : (
          <>
            <h3 className="text-sm font-semibold text-ink">{t("recipeTitle")}</h3>
            <ul className="mt-3 grid gap-2.5">
              {(["recipe1", "recipe2", "recipe3", "recipe4", "recipe5"] as const).map((key) => (
                <li key={key} className="flex items-start gap-2.5 text-[13px] leading-snug text-ink-2">
                  <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-accent" />
                  {t(key)}
                </li>
              ))}
            </ul>
          </>
        )}
      </aside>
    </PanelCard>
  );
}

/** Campo v3: rótulo de 14 px, el control y una ayuda opcional en gris. */
function Field({
  label,
  htmlFor,
  labelId,
  hint,
  className,
  children,
}: {
  label: string;
  /** Id del control que nombra el rótulo. */
  htmlFor?: string;
  /** Id del rótulo cuando nombra a un grupo (no a un solo control). */
  labelId?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  const labelClass = "text-sm font-medium text-ink";
  return (
    <div className={cn("grid min-w-0 content-start gap-1.5", className)}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className={labelClass}>
          {label}
        </label>
      ) : (
        <p id={labelId} className={labelClass}>
          {label}
        </p>
      )}
      {children}
      {hint ? <p className="text-xs leading-snug text-ink-3">{hint}</p> : null}
    </div>
  );
}
