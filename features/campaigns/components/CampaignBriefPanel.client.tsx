"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { buttonClass } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { PanelCard } from "@/components/ui/PageHeader";
import { Note, StatCard, ToneBadge } from "@/components/ui/PanelKit";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { cn } from "@/lib/cn";
import type { BriefResult } from "@/lib/campaigns/campaign-brief.server";
import { COUNTRY_LOCATION_IDS, type CampaignCountry } from "@/lib/campaigns/smart-plus-plan";

const COUNTRIES = Object.keys(COUNTRY_LOCATION_IDS) as CampaignCountry[];
/** Mensajes que rotan mientras la IA trabaja (lectura + IA tardan ~10-20 s). */
const STEPS = ["reading", "writing", "budget"] as const;
const MAX_LAUNCH_TEXTS = 5;

export type CampaignBriefEvent = {
  texts: string[];
  landingPageUrl: string;
  dailyBudget: number;
  campaignName: string;
  country: CampaignCountry;
};

export type StudioBriefEvent = BriefResult["brief"]["studio"] & { images: string[] };

/** Fotos de la tienda por nuestro dominio (la CSP no deja cargar dominios ajenos). */
export function productImageSrc(url: string): string {
  return `/api/campaigns/brief/image?url=${encodeURIComponent(url)}`;
}

const money = (amount: number, currency: string | null) => {
  try {
    return new Intl.NumberFormat("es-PE", { style: "currency", currency: currency ?? "USD", maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency ?? ""} ${amount}`.trim();
  }
};

/**
 * Asistente de campañas: el cliente pega el link de su producto y la IA arma
 * los textos, el guion del video y el presupuesto. Con un clic llena "Lanzar
 * campaña" (y "Crear video" para el equipo); nada se crea sin revisarlo.
 */
export function CampaignBriefPanel({ showVideoStudio = false }: { showVideoStudio?: boolean }) {
  const t = useTranslations("creatives.brief");
  const textsLabelId = useId();
  const [url, setUrl] = useState("");
  const [country, setCountry] = useState<CampaignCountry>("PE");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BriefResult | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [sent, setSent] = useState<"launch" | "studio" | null>(null);

  useEffect(() => {
    if (!loading) return;
    const timer = window.setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 4500);
    return () => window.clearInterval(timer);
  }, [loading]);

  async function generate() {
    setLoading(true);
    setStep(0);
    setError(null);
    setResult(null);
    setSent(null);
    try {
      const response = await fetch("/api/campaigns/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, country }),
      });
      const data = (await response.json()) as BriefResult & { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        setError(data.error ?? t("errors.generic"));
        return;
      }
      setResult(data);
      // Por defecto, los textos sin frases riesgosas.
      setPicked(data.brief.texts.map((x, i) => (x.risky ? -1 : i)).filter((i) => i >= 0).slice(0, MAX_LAUNCH_TEXTS));
    } catch {
      setError(t("errors.generic"));
    } finally {
      setLoading(false);
    }
  }

  function toggle(i: number) {
    setPicked((list) => (list.includes(i) ? list.filter((x) => x !== i) : [...list, i].sort((a, b) => a - b)));
  }

  function sendToLaunch() {
    if (!result) return;
    const detail: CampaignBriefEvent = {
      texts: picked.map((i) => result.brief.texts[i].text).slice(0, MAX_LAUNCH_TEXTS),
      landingPageUrl: result.product.url,
      dailyBudget: result.budget.amount,
      campaignName: result.brief.campaignName,
      country,
    };
    window.dispatchEvent(new CustomEvent<CampaignBriefEvent>("campaign-brief", { detail }));
    setSent("launch");
    document.getElementById("launch-campaign")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function sendToStudio() {
    if (!result) return;
    const detail: StudioBriefEvent = { ...result.brief.studio, images: result.product.images };
    window.dispatchEvent(new CustomEvent<StudioBriefEvent>("studio-brief", { detail }));
    setSent("studio");
    document.getElementById("video-studio")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const product = result?.product;
  const budgetReason = result
    ? t(`budget.${result.budget.reason}`, {
        cpr: result.budget.costPerResult !== null ? money(result.budget.costPerResult, "USD") : "",
      })
    : "";

  return (
    <PanelCard
      id="campaign-brief"
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
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (url.trim() && !loading) void generate();
        }}
      >
        <Input
          value={url}
          inputMode="url"
          disabled={loading}
          placeholder={t("urlPlaceholder")}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1"
        />
        <Select
          value={country}
          disabled={loading}
          onChange={(e) => setCountry(e.target.value as CampaignCountry)}
          aria-label={t("country")}
          className="sm:w-40"
        >
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {t(`countries.${c}`)}
            </option>
          ))}
        </Select>
        <button type="submit" disabled={loading || !url.trim()} className={buttonClass("primary")}>
          <PanelIcon name="sparkle" />
          {loading ? t("generating") : result ? t("again") : t("generate")}
        </button>
      </form>

      {loading ? (
        <div role="status" className="mt-4 flex items-center gap-3 rounded-box border border-line bg-field px-3 py-2.5">
          <span
            aria-hidden
            className="size-4 shrink-0 animate-spin rounded-full border-2 border-accent border-t-transparent motion-reduce:animate-none"
          />
          <p className="text-[13px] font-medium text-ink">{t(`steps.${STEPS[step]}`)}</p>
        </div>
      ) : null}
      {error ? (
        <Note tone="danger" className="mt-4">
          {error}
        </Note>
      ) : null}

      {result && product ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="grid content-start gap-3">
            <div className="flex gap-3.5 rounded-box border border-line p-3">
              {product.images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={productImageSrc(product.images[0])}
                  alt=""
                  className="size-24 shrink-0 rounded-ctl bg-subtle object-cover"
                />
              ) : null}
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-semibold text-ink">{product.title}</p>
                {product.price !== null ? (
                  <p className="mt-1 text-[15px] font-semibold text-ink tabular-nums">
                    {money(product.price, product.currency)}
                    {product.oldPrice !== null ? (
                      <span className="ml-2 text-xs font-normal text-ink-3 line-through">
                        {money(product.oldPrice, product.currency)}
                      </span>
                    ) : null}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-ink-3">{t("photos", { count: product.images.length })}</p>
              </div>
            </div>

            <StatCard
              flat
              label={t("budget.title")}
              value={t("budget.amount", { amount: money(result.budget.amount, "USD") })}
              sub={budgetReason}
            />

            <div className="rounded-box border border-line p-4">
              <p className="eyebrow">{t("script.title")}</p>
              <p className="mt-2 text-sm font-semibold text-ink">{result.brief.studio.hook}</p>
              <ul className="mt-2 grid gap-1">
                {result.brief.studio.benefits.filter(Boolean).map((b) => (
                  <li key={b} className="flex gap-2 text-[13px] text-ink">
                    <PanelIcon name="check" className="mt-0.5 size-3.5 text-ok-fg" />
                    {b}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs font-semibold text-accent-text">{result.brief.studio.cta}</p>
              {showVideoStudio ? (
                <button type="button" onClick={sendToStudio} className={buttonClass("outline", "sm", "mt-3")}>
                  <PanelIcon name="video" />
                  {t("toStudio")}
                </button>
              ) : null}
            </div>
          </div>

          <div className="min-w-0">
            <p id={textsLabelId} className="text-sm font-medium text-ink">
              {t("texts.title", { count: picked.length, max: MAX_LAUNCH_TEXTS })}
            </p>
            <ul aria-labelledby={textsLabelId} className="mt-2 grid gap-2">
              {result.brief.texts.map((item, i) => {
                const on = picked.includes(i);
                return (
                  <li key={item.text}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-box border px-3.5 py-3 transition-colors motion-reduce:transition-none",
                        on ? "border-accent bg-accent-soft ring-1 ring-accent" : "border-line bg-surface hover:border-line-strong",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggle(i)}
                        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-accent-btn"
                      />
                      <span className="min-w-0">
                        <span className="block text-[13px] leading-5 text-ink">{item.text}</span>
                        <span className="mt-1.5 flex flex-wrap gap-1.5">
                          <ToneBadge tone="neutral">{item.angle}</ToneBadge>
                          {item.risky ? (
                            <ToneBadge tone="warn" icon="alert" className="h-auto min-h-[22px] whitespace-normal py-0.5">
                              {t("texts.risky", { reason: item.risky })}
                            </ToneBadge>
                          ) : null}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" disabled={picked.length === 0} onClick={sendToLaunch} className={buttonClass("primary")}>
                <PanelIcon name="send" />
                {t("toLaunch")}
              </button>
              <p role="status" className="text-xs font-medium text-ok-fg">
                {sent ? t(sent === "launch" ? "sentLaunch" : "sentStudio") : null}
              </p>
            </div>
            <p className="mt-2 text-xs text-ink-3">{t("reviewHint")}</p>
          </div>
        </div>
      ) : null}
    </PanelCard>
  );
}
