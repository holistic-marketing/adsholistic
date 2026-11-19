"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, buttonClass } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Note } from "@/components/ui/PanelKit";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { cn } from "@/lib/cn";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import type { CreativeAccountOption } from "@/lib/creatives/types";
import { productImageSrc, type StudioBriefEvent } from "@/features/campaigns/components/CampaignBriefPanel.client";
import {
  STUDIO_DURATION,
  STUDIO_HEIGHT,
  STUDIO_MAX_BENEFITS,
  STUDIO_MAX_MEDIA,
  STUDIO_WIDTH,
  buildStudioTimeline,
  buildVoiceoverScript,
  formatStudioPrice,
  studioFileName,
  validateStudioInput,
  type StudioCurrency,
  type StudioInput,
  type StudioTemplate,
  type StudioVoice,
} from "@/lib/creatives/video-studio";
import {
  drawStudioFrame,
  isLowResolution,
  loadStudioMedia,
  recordStudioVideo,
  supportedStudioMimeType,
  type StudioMedia,
} from "@/lib/creatives/video-studio-render.client";

type Loaded = { id: string; name: string; url: string; media: StudioMedia };

const TEMPLATES: StudioTemplate[] = ["auto", "orange", "dark", "fresh"];
const TEMPLATE_SWATCH: Record<StudioTemplate, string> = {
  auto: "bg-[conic-gradient(#ff781f,#19c2b3,#6366f1,#ff781f)]",
  orange: "bg-accent",
  dark: "bg-[#141416]",
  fresh: "bg-ok-solid",
};
const CURRENCIES: StudioCurrency[] = ["PEN", "USD", "COP"];
const VOICES: StudioVoice[] = ["female", "male", "none"];

/** Pide la voz de cada frase del guion (en paralelo). */
async function fetchVoiceover(studio: StudioInput, mediaCount: number, voice: Exclude<StudioVoice, "none">) {
  const scenes = buildStudioTimeline({
    mediaCount,
    benefits: studio.benefits,
    hasPrice: Boolean(formatStudioPrice(studio.price, studio.currency)),
  });
  return Promise.all(
    buildVoiceoverScript(studio, scenes).map(async (line) => {
      const response = await fetch("/api/creatives/voiceover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: line.text, voice }),
      });
      if (!response.ok) throw new Error("voice");
      return { at: line.at, audio: await response.arrayBuffer() };
    }),
  );
}
/** Límite de subida de la API (Vercel corta en 4.5 MB). */
const MAX_UPLOAD_BYTES = 4.3 * 1024 * 1024;

const noopSubscribe = () => () => {};

const labelClass = "text-sm font-medium text-ink";

/** Opción elegible (v3 «pick»): se marca en naranja suave cuando está activa. */
const pickClass = (on: boolean) =>
  cn(
    "inline-flex h-8 items-center gap-1.5 rounded-ctl border px-3 text-[13px] font-medium shadow-ctl disabled:opacity-60",
    on ? "border-accent-line bg-accent-soft text-accent-text" : "border-line bg-field text-ink hover:bg-hover",
  );

/** Arma un video vertical de 15 s con las fotos del producto y lo manda al flujo de Agent Pro. */
export function VideoStudioPanel({
  clienteName,
  accounts = [],
}: {
  clienteName?: string;
  accounts?: CreativeAccountOption[];
}) {
  const t = useTranslations("creatives.videoStudio");
  const router = useRouter();
  const fieldId = useId();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recordingRef = useRef(false);

  const [items, setItems] = useState<Loaded[]>([]);
  const [studio, setStudio] = useState<StudioInput>(() => ({
    template: "auto",
    hook: "",
    productName: "",
    benefits: ["", "", ""],
    price: "",
    oldPrice: "",
    currency: "PEN",
    promo: "",
    cta: t("defaults.cta"),
    storeName: clienteName ?? "",
    labels: { before: t("canvas.before"), today: t("canvas.today"), price: t("canvas.price"), button: t("canvas.button") },
  }));
  const [adAccountId, setAdAccountId] = useState(
    () => accounts.find((a) => a.status === "active")?.id ?? accounts[0]?.id ?? "",
  );
  const [phase, setPhase] = useState<"edit" | "voice" | "recording" | "ready" | "uploading">("edit");
  const [voice, setVoice] = useState<StudioVoice>("female");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // En el servidor se asume que sí; el navegador dice la verdad al hidratar.
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => supportedStudioMimeType() !== null,
    () => true,
  );

  const media = useMemo(() => items.map((i) => i.media), [items]);

  // Vista previa en bucle mientras se edita (la grabación dibuja por su cuenta).
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || phase === "recording") return;
    for (const m of media) if (m.kind === "video") void m.el.play().catch(() => undefined);
    let frame = 0;
    const start = performance.now();
    const loop = () => {
      if (recordingRef.current) return;
      const tt = ((performance.now() - start) / 1000) % STUDIO_DURATION;
      drawStudioFrame(ctx, tt, studio, media);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [studio, media, phase]);

  // Libera los archivos al salir.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(
    () => () => {
      for (const i of itemsRef.current) URL.revokeObjectURL(i.url);
    },
    [],
  );
  useEffect(() => () => {
    if (result) URL.revokeObjectURL(result.url);
  }, [result]);

  function update<K extends keyof StudioInput>(key: K, value: StudioInput[K]) {
    setStudio((prev) => ({ ...prev, [key]: value }));
    if (result) setResult(null);
    if (phase === "ready") setPhase("edit");
    setSuccess(null);
  }

  // Asistente de IA: llena el guion y trae las fotos del producto.
  useEffect(() => {
    const onBrief = (event: Event) => {
      const detail = (event as CustomEvent<StudioBriefEvent>).detail;
      if (!detail) return;
      setStudio((prev) => ({
        ...prev,
        hook: detail.hook,
        productName: detail.productName,
        benefits: [...detail.benefits, "", "", ""].slice(0, 3),
        price: detail.price,
        oldPrice: detail.oldPrice,
        currency: detail.currency,
        cta: detail.cta || prev.cta,
      }));
      setResult(null);
      setPhase("edit");
      void Promise.all(
        detail.images.slice(0, STUDIO_MAX_MEDIA).map(async (src, i) => {
          const response = await fetch(productImageSrc(src));
          if (!response.ok) return null;
          const blob = await response.blob();
          return new File([blob], `producto-${i + 1}.${blob.type.split("/")[1] ?? "jpg"}`, { type: blob.type });
        }),
      )
        .then((files) => addFiles(files.filter((f): f is File => f !== null)))
        .catch(() => setError(t("errors.briefPhotos")));
    };
    window.addEventListener("studio-brief", onBrief);
    return () => window.removeEventListener("studio-brief", onBrief);
  });

  async function addFiles(files: FileList | File[] | null) {
    if (!files) return;
    setError(null);
    const room = STUDIO_MAX_MEDIA - items.length;
    const picked = [...files].filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/")).slice(0, room);
    const loaded: Loaded[] = [];
    for (const file of picked) {
      try {
        const { media: m, url } = await loadStudioMedia(file);
        loaded.push({ id: `${file.name}-${file.size}-${Math.random()}`, name: file.name, url, media: m });
      } catch {
        setError(t("errors.mediaLoad", { name: file.name }));
      }
    }
    if (files.length > room) setError(t("errors.tooMany", { max: STUDIO_MAX_MEDIA }));
    setItems((prev) => [...prev, ...loaded]);
    setResult(null);
    setPhase("edit");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const gone = prev.find((i) => i.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return prev.filter((i) => i.id !== id);
    });
    setResult(null);
    setPhase("edit");
  }

  async function handleRecord() {
    const problems = validateStudioInput(studio, items.length);
    if (problems.length > 0) {
      setError(t(`errors.${problems[0]}`));
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    setError(null);
    setSuccess(null);
    setProgress(0);
    let voiceLines: { at: number; audio: ArrayBuffer }[] = [];
    if (voice !== "none") {
      setPhase("voice");
      try {
        voiceLines = await fetchVoiceover(studio, items.length, voice);
      } catch {
        setError(t("errors.voice"));
        setPhase("edit");
        return;
      }
    }
    setPhase("recording");
    recordingRef.current = true;
    try {
      const blob = await recordStudioVideo({ canvas, studio, media, voice: voiceLines, onProgress: setProgress });
      setResult({ blob, url: URL.createObjectURL(blob) });
      setPhase("ready");
    } catch (recordError) {
      setError(
        recordError instanceof Error && recordError.message === "unsupported"
          ? t("errors.unsupported")
          : t("errors.record"),
      );
      setPhase("edit");
    } finally {
      recordingRef.current = false;
    }
  }

  async function handleSend() {
    if (!result) return;
    if (!adAccountId) {
      setError(t("errors.noAccount"));
      return;
    }
    if (result.blob.size > MAX_UPLOAD_BYTES) {
      setError(t("errors.tooBig"));
      return;
    }
    setPhase("uploading");
    setError(null);
    try {
      const fileName = studioFileName(studio.productName);
      const formData = new FormData();
      formData.append("asset", new File([result.blob], fileName, { type: "video/mp4" }));
      formData.append(
        "name",
        clienteName ? `${clienteName} · ${t("assetName", { product: studio.productName.trim() })}` : t("assetName", { product: studio.productName.trim() }),
      );
      formData.append("adAccountId", adAccountId);
      const selected = accounts.find((a) => a.id === adAccountId);
      if (selected?.externalAccountId) formData.append("advertiserId", selected.externalAccountId);
      await apiClient("/api/creative-assets", { method: "POST", body: formData });
      setSuccess(t("sent"));
      setResult(null);
      setPhase("edit");
      router.refresh();
    } catch (sendError) {
      setError(sendError instanceof ApiClientError ? sendError.message : t("errors.send"));
      setPhase("ready");
    }
  }

  const approved = accounts.filter((a) => a.status === "active");
  const accountChoices = approved.length > 0 ? approved : accounts;
  const busy = phase === "voice" || phase === "recording" || phase === "uploading";

  return (
    <section
      id="video-studio"
      aria-labelledby={`${fieldId}-title`}
      className="min-w-0 scroll-mt-4 overflow-hidden rounded-card border border-line bg-surface shadow-card"
    >
      <div className="border-b border-line px-4 pb-4 pt-4 sm:px-6 sm:pt-5">
        <p className="eyebrow">{t("kicker")}</p>
        <h2 id={`${fieldId}-title`} className="mt-1 text-base font-semibold leading-6 tracking-[-0.01em] text-ink">
          {t("title")}
        </h2>
        <p className="mt-0.5 max-w-[78ch] text-[13px] text-ink-2">{t("subtitle")}</p>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.3fr)_minmax(260px,0.7fr)]">
        <div className="grid content-start gap-4 px-4 py-4 sm:px-6 sm:py-5">
          {!supported ? <Note tone="warn">{t("errors.unsupported")}</Note> : null}

          {/* Fotos y clips */}
          <div className="grid gap-1.5">
            <p className={labelClass}>{t("mediaLabel", { max: STUDIO_MAX_MEDIA })}</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => void addFiles(e.target.files)}
            />
            <div className="flex flex-wrap gap-2">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="group relative h-24 w-[3.4rem] overflow-hidden rounded-ctl border border-line bg-subtle"
                  title={item.name}
                >
                  {item.media.kind === "video" ? (
                    <video src={item.url} className="h-full w-full object-cover" muted playsInline />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.url} alt="" className="h-full w-full object-cover" />
                  )}
                  <span className="num absolute left-1 top-1 rounded-[4px] bg-surface/90 px-1 text-[10px] font-semibold text-ink">
                    {index + 1}
                  </span>
                  {isLowResolution(item.media) ? (
                    <span className="absolute inset-x-0 bottom-0 bg-warn-bg py-0.5 text-center text-[9px] font-semibold text-warn-fg">
                      {t("lowResBadge")}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => removeItem(item.id)}
                    aria-label={t("remove")}
                    className="absolute right-1 top-1 grid size-5 place-items-center rounded-[6px] bg-surface/90 text-ink hover:bg-surface"
                  >
                    <PanelIcon name="x" className="size-3" />
                  </button>
                </div>
              ))}
              {items.length < STUDIO_MAX_MEDIA ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => fileInputRef.current?.click()}
                  className="grid h-24 w-[3.4rem] place-items-center rounded-ctl border border-dashed border-line-strong bg-field text-ink-2 hover:border-accent-line hover:bg-accent-soft hover:text-accent-text"
                  aria-label={t("addMedia")}
                >
                  <PanelIcon name="plus" />
                </button>
              ) : null}
            </div>
            <p className="text-xs text-ink-3">{t("mediaHint")}</p>
            {items.some((i) => isLowResolution(i.media)) ? <Note tone="warn">{t("lowRes")}</Note> : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5 sm:col-span-2">
              <label htmlFor={`${fieldId}-hook`} className={labelClass}>
                {t("hook")}
              </label>
              <Input
                id={`${fieldId}-hook`}
                value={studio.hook}
                maxLength={60}
                disabled={busy}
                onChange={(e) => update("hook", e.target.value)}
                placeholder={t("hookPlaceholder")}
              />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <label htmlFor={`${fieldId}-product`} className={labelClass}>
                {t("product")}
              </label>
              <Input
                id={`${fieldId}-product`}
                value={studio.productName}
                maxLength={50}
                disabled={busy}
                onChange={(e) => update("productName", e.target.value)}
                placeholder={t("productPlaceholder")}
              />
            </div>
            {Array.from({ length: STUDIO_MAX_BENEFITS }, (_, i) => (
              <div key={i} className={cn("grid gap-1.5", i === 0 && "sm:col-span-2")}>
                <label htmlFor={`${fieldId}-benefit-${i}`} className={labelClass}>
                  {t("benefit", { n: i + 1 })}
                </label>
                <Input
                  id={`${fieldId}-benefit-${i}`}
                  value={studio.benefits[i] ?? ""}
                  maxLength={32}
                  disabled={busy}
                  onChange={(e) => {
                    const next = [...studio.benefits];
                    next[i] = e.target.value;
                    update("benefits", next);
                  }}
                  placeholder={t(`benefitPlaceholder${i + 1}` as "benefitPlaceholder1")}
                />
              </div>
            ))}
            <div className="grid gap-1.5">
              <label htmlFor={`${fieldId}-price`} className={labelClass}>
                {t("price")}
              </label>
              <div className="flex gap-2">
                <Select
                  value={studio.currency}
                  disabled={busy}
                  aria-label={t("price")}
                  onChange={(e) => update("currency", e.target.value as StudioCurrency)}
                  className="w-auto shrink-0"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {t(`currency.${c}`)}
                    </option>
                  ))}
                </Select>
                <Input
                  id={`${fieldId}-price`}
                  value={studio.price}
                  inputMode="decimal"
                  disabled={busy}
                  onChange={(e) => update("price", e.target.value)}
                  placeholder="89"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <label htmlFor={`${fieldId}-old`} className={labelClass}>
                {t("oldPrice")}
              </label>
              <Input
                id={`${fieldId}-old`}
                value={studio.oldPrice}
                inputMode="decimal"
                disabled={busy}
                onChange={(e) => update("oldPrice", e.target.value)}
                placeholder="129"
              />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor={`${fieldId}-promo`} className={labelClass}>
                {t("promo")}
              </label>
              <Input
                id={`${fieldId}-promo`}
                value={studio.promo}
                maxLength={24}
                disabled={busy}
                onChange={(e) => update("promo", e.target.value)}
                placeholder={t("promoPlaceholder")}
              />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor={`${fieldId}-cta`} className={labelClass}>
                {t("cta")}
              </label>
              <Input
                id={`${fieldId}-cta`}
                value={studio.cta}
                maxLength={40}
                disabled={busy}
                onChange={(e) => update("cta", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor={`${fieldId}-store`} className={labelClass}>
                {t("store")}
              </label>
              <Input
                id={`${fieldId}-store`}
                value={studio.storeName}
                maxLength={40}
                disabled={busy}
                onChange={(e) => update("storeName", e.target.value)}
              />
            </div>
            <fieldset className="grid gap-1.5 sm:col-span-2">
              <legend className={cn(labelClass, "mb-1.5")}>{t("template")}</legend>
              <div className="flex flex-wrap items-center gap-1.5">
                {TEMPLATES.map((tpl) => (
                  <button
                    key={tpl}
                    type="button"
                    disabled={busy}
                    aria-pressed={studio.template === tpl}
                    onClick={() => update("template", tpl)}
                    className={pickClass(studio.template === tpl)}
                  >
                    {/* Muestra del color que tendrá el video. */}
                    <span aria-hidden className={cn("size-3.5 rounded-full", TEMPLATE_SWATCH[tpl])} />
                    {t(`templates.${tpl}`)}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="grid gap-1.5 sm:col-span-2">
              <legend className={cn(labelClass, "mb-1.5")}>{t("voice")}</legend>
              <div className="flex flex-wrap items-center gap-1.5">
                {VOICES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    disabled={busy}
                    aria-pressed={voice === v}
                    onClick={() => {
                      setVoice(v);
                      setResult(null);
                      if (phase === "ready") setPhase("edit");
                    }}
                    className={pickClass(voice === v)}
                  >
                    {t(`voices.${v}`)}
                  </button>
                ))}
              </div>
              <p className="text-xs text-ink-3">{t("voiceHint")}</p>
            </fieldset>
          </div>

          <div className="grid gap-1.5">
            <label htmlFor={`${fieldId}-account`} className={labelClass}>
              {t("account")}
            </label>
            {accountChoices.length === 0 ? (
              <Note tone="warn">{t("errors.noAccount")}</Note>
            ) : (
              <Select
                id={`${fieldId}-account`}
                value={adAccountId}
                disabled={busy}
                onChange={(e) => setAdAccountId(e.target.value)}
              >
                {accountChoices.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                    {account.bmLabel ? ` · ${account.bmLabel}` : ""}
                    {account.status !== "active" ? ` · ${account.status}` : ""}
                  </option>
                ))}
              </Select>
            )}
          </div>

          {error ? <Note tone="danger">{error}</Note> : null}
          {success ? (
            <Note tone="ok" icon="check-circle">
              {success}
            </Note>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {phase === "ready" || phase === "uploading" ? (
              <>
                <Button onClick={handleSend} disabled={busy}>
                  <PanelIcon name="send" />
                  {phase === "uploading" ? t("sending") : t("send")}
                </Button>
                {result ? (
                  <a href={result.url} download={studioFileName(studio.productName)} className={buttonClass("outline")}>
                    <PanelIcon name="download" />
                    {t("download")}
                  </a>
                ) : null}
                <Button
                  variant="outline"
                  onClick={() => {
                    setResult(null);
                    setPhase("edit");
                  }}
                  disabled={busy}
                >
                  <PanelIcon name="pencil" />
                  {t("edit")}
                </Button>
              </>
            ) : (
              <Button onClick={handleRecord} disabled={busy || !supported}>
                <PanelIcon name="video" />
                {phase === "voice"
                  ? t("voicing")
                  : phase === "recording"
                    ? t("recording", { pct: Math.round(progress * 100) })
                    : t("create")}
              </Button>
            )}
          </div>
          {phase === "recording" ? <p className="text-xs text-ink-3">{t("recordingHint")}</p> : null}
        </div>

        <aside className="flex flex-col items-center gap-3 border-t border-line bg-field px-4 py-5 sm:px-6 lg:border-l lg:border-t-0">
          <h3 className="self-start text-sm font-semibold text-ink">
            {phase === "ready" ? t("resultTitle") : t("previewTitle")}
          </h3>
          <div className="relative w-full max-w-[240px] overflow-hidden rounded-card border border-line bg-subtle shadow-card">
            {result && phase !== "recording" ? (
              <video src={result.url} className="aspect-[9/16] w-full" controls playsInline />
            ) : null}
            <canvas
              ref={canvasRef}
              width={STUDIO_WIDTH}
              height={STUDIO_HEIGHT}
              className={cn("aspect-[9/16] w-full", result && phase !== "recording" ? "hidden" : "block")}
            />
            {phase === "recording" ? (
              <div className="absolute inset-x-0 bottom-0 h-1 bg-accent-soft">
                <div className="h-full bg-accent" style={{ width: `${progress * 100}%` }} />
              </div>
            ) : null}
          </div>
          <p className="text-center text-xs text-ink-3">{t("previewHint")}</p>
        </aside>
      </div>
    </section>
  );
}
