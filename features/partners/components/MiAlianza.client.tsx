"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import {
  saveMyPartnerAction,
  uploadMyPartnerImageAction,
  type MyPartnerImageKind,
  type MyPartnerInput,
} from "../my-partner-actions";
import {
  PARTNER_ACCENT_RE,
  PARTNER_LOGO_SIZE,
  PARTNER_THEME_COLORS,
  partnerLogoSize,
  partnerPalette,
  type Partner,
} from "@/lib/partners/partners.shared";
import type { PartnerPanelData } from "@/lib/partners/partner-panel.server";
import { Button, buttonClass } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { PageHeader, PanelCard } from "@/components/ui/PageHeader";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { Note, StatCard } from "@/components/ui/PanelKit";
import { PartnerInvites } from "./PartnerInvites.client";

const SITE = "https://www.adsholistic.com";
const DEFAULT_HEADLINE = "Lanza y escala tus campañas de TikTok";
const DEFAULT_SUB = "Cuentas de agencia, recarga desde cualquier país y saldo al instante. Todo en una sola app.";

const usd = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Lima" });

type Props = {
  partner: Partner & { contractSignedAt: string };
  panel: PartnerPanelData | null;
};

export function MiAlianza({ partner, panel }: Props) {
  const [form, setForm] = useState<MyPartnerInput>({
    name: partner.name,
    companyName: partner.companyName ?? "",
    headline: partner.headline ?? "",
    subheadline: partner.subheadline ?? "",
    accentColor: partner.accentColor,
    theme: partner.theme,
    whatsapp: partner.whatsapp ?? "",
    secondaryColor: partner.secondaryColor ?? partner.accentColor,
    backgroundColor: partner.backgroundColor ?? PARTNER_THEME_COLORS[partner.theme].background,
    textColor: partner.textColor ?? PARTNER_THEME_COLORS[partner.theme].text,
    logoSize: partnerLogoSize(partner.logoSize),
    bannerLink: partner.bannerLink ?? "",
  });
  const [images, setImages] = useState<Record<MyPartnerImageKind, string | null>>({
    logo: partner.logoUrl,
    photo: partner.photoUrl,
    favicon: partner.faviconUrl,
    banner: partner.bannerUrl,
    banner_mobile: partner.bannerMobileUrl,
  });
  const [saved, setSaved] = useState<MyPartnerInput>(form);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState<MyPartnerImageKind | null>(null);

  const link = `${SITE}/a/${partner.slug}`;
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const set = <K extends keyof MyPartnerInput>(key: K, value: MyPartnerInput[K]) => {
    setNotice(null);
    setForm((f) => ({ ...f, [key]: value }));
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const r = await saveMyPartnerAction(form);
      if (!r.ok) return setError(r.error);
      setSaved(form);
      setNotice("Listo. Tu landing ya muestra los cambios.");
    });
  };

  const upload = async (kind: MyPartnerImageKind, file: File | null) => {
    setError(null);
    setNotice(null);
    setUploading(kind);
    const data = new FormData();
    data.set("kind", kind);
    if (file) data.set("file", file);
    const r = await uploadMyPartnerImageAction(data);
    setUploading(null);
    if (!r.ok) return setError(r.error);
    setImages((prev) => ({ ...prev, [kind]: r.url ?? null }));
    setNotice(file ? "Imagen actualizada." : "Imagen quitada.");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt("Copia tu link:", link);
    }
  };

  const signups = panel?.clients.length ?? 0;
  const paying = panel?.clients.filter((c) => c.payments > 0).length ?? 0;
  // Alianza sin comisión (p. ej. el aliado y sus clientes pagan fee preferencial).
  const earns = partner.commissionRate > 0;
  const imageField = (kind: MyPartnerImageKind) => ({
    url: images[kind],
    busy: uploading === kind,
    onPick: (f: File) => upload(kind, f),
    onRemove: () => upload(kind, null),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Tu alianza"
        title="Alianzas"
        lede={
          <>
            Comparte tu link o un código de invitación. Cuando alguien se registra, confirmas si es de tu gente y recién
            ahí queda a tu nombre
            {earns ? (
              <>
                {" "}y ganas el <strong className="font-semibold text-ink">{Math.round(partner.commissionRate * 100)}% del fee</strong> que le
                cobramos durante {partner.commissionDays} días desde que se registra
              </>
            ) : null}
            .
            {partner.clientFeePercent != null ? (
              <>
                {" "}Tú y tus clientes pagan <strong className="font-semibold text-ink">{partner.clientFeePercent}% de fee</strong> en cada
                recarga.
              </>
            ) : null}{" "}
            Contrato firmado el {fecha(partner.contractSignedAt)}.
          </>
        }
      />

      <div className="grid gap-4">
        <PanelCard title="Tu link para compartir">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex min-w-0 flex-[1_1_260px] items-center gap-2 rounded-ctl border border-line bg-field py-1 pl-3 pr-1">
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink">{link.replace("https://", "")}</span>
              <Button size="sm" onClick={copy}>
                <PanelIcon name={copied ? "check" : "copy"} />
                {copied ? "Copiado ✓" : "Copiar link"}
              </Button>
            </div>
            <a href={link} target="_blank" rel="noreferrer" className={buttonClass("outline", "sm")}>
              <PanelIcon name="external" />
              Ver mi landing
            </a>
          </div>
        </PanelCard>

        <PartnerInvites pending={panel?.pending ?? []} invites={panel?.invites ?? []} />

        {/* Números */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-4">
          <StatCard label="Visitas, últimos 30 días" value={panel?.visits30d ?? 0} sub={`${panel?.uniqueVisitors30d ?? 0} personas`} />
          <StatCard label="Registros" value={signups} sub="a tu nombre" />
          <StatCard
            label="Clientes que pagan"
            value={paying}
            sub={signups ? `${Math.round((paying / signups) * 100)}% de registros` : "—"}
          />
          {earns ? (
            <StatCard
              label="Comisión por cobrar"
              value={usd(panel?.commissionPendingCents ?? 0)}
              sub={`Cobrado ${usd(panel?.commissionPaidCents ?? 0)}`}
            />
          ) : null}
        </div>

        {/* Editor + vista previa */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <section aria-labelledby="mi-alianza-editor" className="flex min-w-0 flex-col rounded-card border border-line bg-surface shadow-card">
            <div className="border-b border-line px-4 pb-4 pt-4 sm:px-6 sm:pt-5">
              <h2 id="mi-alianza-editor" className="text-base font-semibold leading-6 tracking-[-0.01em] text-ink">
                Diseña tu landing
              </h2>
              <p className="mt-0.5 text-xs text-ink-2">Los cambios se ven al lado. Guarda para publicarlos.</p>
            </div>

            <div className="flex flex-col gap-5 px-4 py-4 sm:px-6 sm:py-5">
              <Group title="Marca">
                <ImageField label="Logo de tu empresa" hint="PNG con fondo transparente se ve mejor. Máx. 2 MB." {...imageField("logo")} />
                <Field label="Tamaño del logo" counter={`${form.logoSize} px`}>
                  <input
                    type="range"
                    min={PARTNER_LOGO_SIZE.min}
                    max={PARTNER_LOGO_SIZE.max}
                    step={2}
                    value={form.logoSize}
                    onChange={(e) => set("logoSize", Number(e.target.value))}
                    className="w-full cursor-pointer accent-[var(--ui-accent-btn)]"
                  />
                </Field>
                <ImageField
                  label="Favicon"
                  hint="El iconito de la pestaña del navegador. Cuadrado (64 × 64), PNG o ICO, máx. 512 KB."
                  small
                  {...imageField("favicon")}
                />
                <Field label="Nombre de tu empresa">
                  <Input
                    value={form.companyName}
                    maxLength={80}
                    placeholder="Ej. Autoecompro"
                    onChange={(e) => set("companyName", e.target.value)}
                  />
                </Field>
                <Field label="Tu nombre">
                  <Input value={form.name} maxLength={80} onChange={(e) => set("name", e.target.value)} />
                </Field>
                <ImageField
                  label="Tu foto (opcional)"
                  hint="Aparece como «Recomendado por». Cuadrada, máx. 2 MB."
                  round
                  {...imageField("photo")}
                />
              </Group>

              <Group title="Colores">
                <div className="grid gap-3 sm:grid-cols-2">
                  <ColorField
                    label="Color principal"
                    hint="Botones de «Crear mi cuenta»."
                    value={form.accentColor}
                    onChange={(v) => set("accentColor", v)}
                  />
                  <ColorField
                    label="Color secundario"
                    hint="Detalles, pasos y franja final."
                    value={form.secondaryColor}
                    onChange={(v) => set("secondaryColor", v)}
                  />
                  <ColorField
                    label="Color de fondo"
                    hint="Fondo de toda la página."
                    value={form.backgroundColor}
                    onChange={(v) => set("backgroundColor", v)}
                  />
                  <ColorField
                    label="Color del texto"
                    hint="Títulos y textos."
                    value={form.textColor}
                    onChange={(v) => set("textColor", v)}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-xs text-ink-3">Empezar desde:</span>
                  {(["light", "dark"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setNotice(null);
                        setForm((f) => ({
                          ...f,
                          theme: t,
                          backgroundColor: PARTNER_THEME_COLORS[t].background,
                          textColor: PARTNER_THEME_COLORS[t].text,
                        }));
                      }}
                      className="inline-flex h-8 items-center gap-2 rounded-ctl border border-line bg-field px-3 text-[13px] font-medium text-ink shadow-ctl hover:bg-hover"
                    >
                      {/* Muestra del fondo que tendrá la landing. */}
                      <span
                        aria-hidden
                        className="size-3.5 shrink-0 rounded-full border border-line-strong"
                        style={{ background: PARTNER_THEME_COLORS[t].background }}
                      />
                      {t === "light" ? "Fondo claro" : "Fondo oscuro"}
                    </button>
                  ))}
                </div>
              </Group>

              <Group title="Banners">
                <p className="-mt-1 text-xs text-ink-3">
                  Van debajo del inicio de tu landing. En celular se ve el de celular; si subes uno solo, se usa en los dos.
                </p>
                <BannerField label="Banner para computadora" size="1224 × 270" {...imageField("banner")} />
                <BannerField label="Banner para celular" size="800 × 270" {...imageField("banner_mobile")} />
                <Field label="Link del banner (opcional)">
                  <Input
                    value={form.bannerLink}
                    maxLength={300}
                    inputMode="url"
                    placeholder="https://…"
                    onChange={(e) => set("bannerLink", e.target.value)}
                  />
                </Field>
              </Group>

              <Group title="Textos">
                <Field label="Título" counter={`${form.headline.length}/120`}>
                  <Input
                    value={form.headline}
                    maxLength={120}
                    placeholder={DEFAULT_HEADLINE}
                    onChange={(e) => set("headline", e.target.value)}
                  />
                </Field>
                <Field label="Subtítulo" counter={`${form.subheadline.length}/240`}>
                  <Textarea
                    value={form.subheadline}
                    maxLength={240}
                    rows={3}
                    placeholder={DEFAULT_SUB}
                    onChange={(e) => set("subheadline", e.target.value)}
                    className="min-h-0 resize-none"
                  />
                </Field>
                <Field label="Tu WhatsApp (con código de país)">
                  <Input
                    value={form.whatsapp}
                    inputMode="tel"
                    placeholder="51987654321"
                    onChange={(e) => set("whatsapp", e.target.value)}
                  />
                </Field>
              </Group>

              {error ? <Note tone="danger">{error}</Note> : null}
              {notice ? (
                <Note tone="ok" icon="check-circle">
                  {notice}
                </Note>
              ) : null}
            </div>

            <div className="sticky bottom-0 mt-auto flex flex-wrap items-center justify-end gap-2 rounded-b-card border-t border-line bg-surface px-4 py-3 sm:px-6">
              {dirty ? <span className="mr-auto text-xs font-medium text-accent-text">Tienes cambios sin guardar</span> : null}
              <Button
                variant="ghost"
                disabled={!dirty || pending}
                onClick={() => {
                  setForm(saved);
                  setError(null);
                }}
              >
                Deshacer
              </Button>
              <Button disabled={!dirty || pending} onClick={save}>
                {pending ? "Guardando…" : "Guardar y publicar"}
              </Button>
            </div>
          </section>

          <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
            <h2 className="mb-2 text-sm font-semibold text-ink">Vista previa</h2>
            <LandingPreview form={form} images={images} link={link} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-3 border-t border-line pt-4 first-of-type:border-0 first-of-type:pt-0">
      <legend className="float-left w-full text-sm font-semibold text-ink">{title}</legend>
      {children}
    </fieldset>
  );
}

function Field({ label, counter, children }: { label: string; counter?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="flex justify-between gap-2 text-sm font-medium text-ink">
        {label}
        {counter ? <span className="num text-xs font-normal text-ink-3">{counter}</span> : null}
      </span>
      {children}
    </label>
  );
}

const smallBtn =
  "inline-flex h-8 items-center rounded-ctl px-2.5 text-[13px] font-medium transition-colors disabled:opacity-50";

function ImageField(props: {
  label: string;
  hint: string;
  url: string | null;
  round?: boolean;
  small?: boolean;
  busy: boolean;
  onPick: (file: File) => void;
  onRemove: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex shrink-0 items-center justify-center overflow-hidden border border-line bg-field ${
          props.small ? "size-10" : "size-14"
        } ${props.round ? "rounded-full" : "rounded-box"}`}
      >
        {props.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={props.url} alt="" className={`h-full w-full ${props.round ? "object-cover" : "object-contain p-1.5"}`} />
        ) : (
          <span className="px-1 text-center text-[11px] leading-tight text-ink-3">Sin imagen</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{props.label}</p>
        <p className="text-xs text-ink-3">{props.hint}</p>
        <div className="mt-1.5 flex gap-1">
          <button
            type="button"
            disabled={props.busy}
            onClick={() => input.current?.click()}
            className={`${smallBtn} border border-line bg-field text-ink shadow-ctl hover:bg-hover`}
          >
            {props.busy ? "Subiendo…" : props.url ? "Cambiar" : "Subir"}
          </button>
          {props.url && !props.busy ? (
            <button type="button" onClick={props.onRemove} className={`${smallBtn} text-danger-fg hover:bg-danger-bg`}>
              Quitar
            </button>
          ) : null}
        </div>
        <input
          ref={input}
          type="file"
          accept={props.small ? "image/png,image/x-icon,image/vnd.microsoft.icon,.ico" : "image/png,image/jpeg,image/webp"}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) props.onPick(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

/** Muestra del color + su código, como en el panel de Ecomdy. */
function ColorField(props: { label: string; hint: string; value: string; onChange: (hex: string) => void }) {
  const valid = PARTNER_ACCENT_RE.test(props.value);
  return (
    <div className="grid gap-1.5">
      <span className="text-sm font-medium text-ink">{props.label}</span>
      <div className="flex items-center gap-2">
        <label
          className={`relative h-9 w-12 shrink-0 cursor-pointer overflow-hidden rounded-ctl border border-line shadow-ctl ${valid ? "" : "bg-field"}`}
          style={valid ? { background: props.value } : undefined}
          title="Elegir color"
        >
          <input
            type="color"
            aria-label={`${props.label} (elegir)`}
            value={valid ? props.value.toLowerCase() : "#ffffff"}
            onChange={(e) => props.onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <Input
          value={props.value.toUpperCase()}
          maxLength={7}
          spellCheck={false}
          aria-label={`${props.label} (código)`}
          aria-invalid={!valid}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^#0-9a-fA-F]/g, "").replace(/(?!^)#/g, "");
            props.onChange(raw.startsWith("#") ? raw : `#${raw}`);
          }}
          className="font-mono uppercase"
        />
      </div>
      <span className={`text-xs ${valid ? "text-ink-3" : "text-danger-fg"}`}>
        {valid ? props.hint : "Usa un código de 6 dígitos, ej. #FF5A2A."}
      </span>
    </div>
  );
}

/** Banner ancho con su medida recomendada (como «Tablet / Laptop Banner» de Ecomdy). */
function BannerField(props: {
  label: string;
  size: string;
  url: string | null;
  busy: boolean;
  onPick: (file: File) => void;
  onRemove: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="grid gap-1.5">
      <span className="flex justify-between gap-2 text-sm font-medium text-ink">
        {props.label}
        <span className="num text-xs font-normal text-ink-3">{props.size} px</span>
      </span>
      <button
        type="button"
        disabled={props.busy}
        onClick={() => input.current?.click()}
        className="flex aspect-[1224/270] w-full items-center justify-center overflow-hidden rounded-box border border-dashed border-line-strong bg-field px-3 text-center text-xs font-medium text-ink-3 transition-colors hover:border-accent-line hover:bg-accent-soft disabled:opacity-60"
      >
        {props.busy ? (
          "Subiendo…"
        ) : props.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={props.url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <PanelIcon name="upload" className="size-3.5" />
            Subir banner · PNG, JPG o WEBP, máx. 4 MB
          </span>
        )}
      </button>
      {props.url && !props.busy ? (
        <div className="flex gap-1">
          <button type="button" onClick={() => input.current?.click()} className={`${smallBtn} text-ink hover:bg-hover`}>
            Cambiar
          </button>
          <button type="button" onClick={props.onRemove} className={`${smallBtn} text-danger-fg hover:bg-danger-bg`}>
            Quitar
          </button>
        </div>
      ) : null}
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) props.onPick(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/** Mini versión de /a/<link> con los cambios en vivo. Los colores de adentro son los del aliado. */
function LandingPreview({
  form,
  images,
  link,
}: {
  form: MyPartnerInput;
  images: Record<MyPartnerImageKind, string | null>;
  link: string;
}) {
  const pal = partnerPalette(form);
  const person = form.name.trim() || "Tu nombre";
  const name = form.companyName.trim() || person;
  // La vista previa va a ~60 % del tamaño real.
  const logoH = Math.round(partnerLogoSize(form.logoSize) * 0.6);
  const banner = images.banner ?? images.banner_mobile;
  const sameTone = pal.secondary.toLowerCase() === pal.accent.toLowerCase();
  return (
    <div className="overflow-hidden rounded-card border border-line shadow-card">
      <div className="flex items-center gap-1.5 border-b border-line bg-subtle px-3 py-2">
        <span className="size-2.5 rounded-full bg-active" />
        <span className="size-2.5 rounded-full bg-active" />
        <span className="size-2.5 rounded-full bg-active" />
        <span className="ml-2 inline-flex min-w-0 items-center gap-1.5 rounded-[6px] bg-surface px-2 py-0.5 font-mono text-[11px] text-ink-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {images.favicon ? <img src={images.favicon} alt="" className="size-3.5 shrink-0 object-contain" /> : null}
          <span className="truncate">{link.replace("https://", "")}</span>
        </span>
      </div>
      <div style={{ background: pal.background, color: pal.text }}>
        <div className="flex items-center justify-center gap-2.5 px-5 py-4">
          <Image
            src="/brand/holistic-marketing-logo.png"
            alt="Holistic Marketing"
            width={506}
            height={187}
            className={`w-auto shrink-0 ${pal.dark ? "brightness-0 invert" : ""}`}
            style={{ height: Math.round(logoH * 0.9) }}
          />
          <span style={{ color: pal.faint }}>×</span>
          {images.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={images.logo} alt={name} className="w-auto min-w-0 max-w-[160px] object-contain" style={{ height: logoH }} />
          ) : (
            <span className="min-w-0 truncate text-[13px] font-bold">{name}</span>
          )}
        </div>
        <div className="px-5 pb-6 pt-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-semibold"
            style={{ borderColor: pal.border, background: pal.card, color: pal.muted }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: pal.secondary }} />
            Alianza oficial · {name}
          </span>
          <p className="mt-3 text-[24px] font-bold leading-[1.1] tracking-[-0.035em] [overflow-wrap:anywhere]">{form.headline.trim() || DEFAULT_HEADLINE}</p>
          <p className="mt-2 text-[13px] leading-relaxed" style={{ color: pal.muted }}>
            {form.subheadline.trim() || DEFAULT_SUB}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="inline-flex h-9 items-center rounded-lg px-4 text-[12.5px] font-bold" style={{ background: pal.accent, color: pal.accentInk }}>
              Crear mi cuenta gratis →
            </span>
            <span className="inline-flex h-9 items-center rounded-lg border px-4 text-[12.5px] font-semibold" style={{ borderColor: pal.border }}>
              Hablar por WhatsApp
            </span>
          </div>
          {images.photo || form.name.trim() ? (
            <div className="mt-5 flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {images.photo ? <img src={images.photo} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" /> : null}
              <p className="text-[12px]" style={{ color: pal.muted }}>
                Recomendado por <strong style={{ color: pal.text }}>{person}</strong>
                {form.companyName.trim() ? ` · ${form.companyName.trim()}` : ""}
              </p>
            </div>
          ) : null}
        </div>
        {banner ? (
          <div className="px-5 pb-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={banner} alt="" className="block h-auto w-full rounded-box border" style={{ borderColor: pal.border }} />
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2 border-t px-5 py-4" style={{ borderColor: pal.border, background: pal.band }}>
          {["Cuentas de agencia", "Recarga como prefieras"].map((t) => (
            <div key={t} className="rounded-box border p-3" style={{ borderColor: pal.border, background: pal.card }}>
              <span className="block h-1 w-6 rounded-full" style={{ background: pal.secondary }} />
              <p className="mt-2 text-[11.5px] font-bold">{t}</p>
            </div>
          ))}
        </div>
        <div className="px-5 pb-5 pt-1">
          <div className="flex items-center justify-between gap-3 rounded-box px-4 py-3" style={{ background: pal.secondary, color: pal.secondaryInk }}>
            <p className="text-[12.5px] font-bold">¿Listo para anunciar?</p>
            <span
              className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-bold"
              style={sameTone ? { background: pal.secondaryInk, color: pal.secondary } : { background: pal.accent, color: pal.accentInk }}
            >
              Crear mi cuenta →
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
