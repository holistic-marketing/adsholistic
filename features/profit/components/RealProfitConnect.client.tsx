"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { PanelCard } from "@/components/ui/PageHeader";
import { buttonClass } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { SquareIcon, ToneBadge, type Tone } from "@/components/ui/PanelKit";

const COURIER_TEMPLATE =
  "pedido;estado;monto_cobrado;costo_envio;courier\n#1001;entregado;89.90;12;Olva\n#1002;rechazado;;15;Shalom\n#1003;en ruta;;;Urbaner\n";

export type RpConnections = {
  shopify: { connected: boolean; storeId: string | null; storeName: string | null; shopDomain: string | null };
  tiktok: { connected: boolean; accounts: number };
  meta: {
    connected: boolean;
    accountName: string | null;
    lastSyncAt: string | null;
    lastSyncError: string | null;
  };
  courier: { ordersFromCourier: number; lastImportAt: string | null };
};

type MetaCsvPreview = {
  days?: number;
  campaigns?: number;
  totalSpend?: number;
  currency?: string;
  from?: string | null;
  to?: string | null;
  message?: string;
  error?: string;
};

type CourierPreview = {
  matched?: number;
  totalRows?: number;
  notFound?: number;
  invalid?: number;
  byStatus?: Record<string, number>;
  message?: string;
  error?: string;
};

function normalizeShopDomain(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

function withShop(installUrl: string | null, shop: string): string | null {
  if (!installUrl) return null;
  const domain = normalizeShopDomain(shop);
  if (!domain) return installUrl;
  const url = new URL(installUrl);
  url.searchParams.set("shop", domain.includes(".") ? domain : `${domain}.myshopify.com`);
  return url.toString();
}

/* Enlace en texto naranja (v3 «linkish»). */
const linkish =
  "self-start text-[13px] font-medium text-accent-text underline-offset-[3px] hover:underline disabled:opacity-50";
const linkishMuted =
  "self-start text-[13px] font-medium text-ink-2 underline-offset-[3px] hover:text-ink hover:underline";
/* Botón de marca de Meta: conserva el azul de Facebook. */
const metaBrandBtn =
  "inline-flex h-8 items-center justify-center gap-1.5 self-start whitespace-nowrap rounded-ctl border border-[#1877f2] bg-[#1877f2] px-2.5 text-[13px] font-medium text-white shadow-ctl hover:brightness-95";

/** Mensaje corto tras una acción (vinculado, error…). */
function ResultLine({ ok, children }: { ok: boolean; children: ReactNode }) {
  return <p className={`text-xs font-medium ${ok ? "text-ok-fg" : "text-danger-fg"}`}>{children}</p>;
}

/** Fuente de datos (v3 «tile»): ícono, paso, nombre, estado y su contenido. */
function SourceTile({
  stepLabel,
  logo,
  title,
  status,
  children,
}: {
  stepLabel: string;
  logo: ReactNode;
  title: string;
  status: ReactNode;
  children: ReactNode;
}) {
  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-box border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <SquareIcon>{logo}</SquareIcon>
          <div className="min-w-0">
            <p className="text-xs text-ink-3">{stepLabel}</p>
            <h3 className="truncate text-sm font-semibold text-ink">{title}</h3>
          </div>
        </div>
        {status}
      </div>
      <div className="flex flex-1 flex-col gap-2.5 text-[13px] leading-5 text-ink-2">{children}</div>
    </li>
  );
}

function StatusBadge({ tone, children }: { tone: Extract<Tone, "ok" | "warn" | "neutral">; children: ReactNode }) {
  return (
    <ToneBadge tone={tone} dot className="shrink-0">
      {children}
    </ToneBadge>
  );
}

/* Logos de marca: conservan sus colores. */
const logos = {
  shopify: (
    <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden>
      <path fill="#95BF47" d="M15.3 3.4c-.1 0-.2 0-.3.1l-.6.2C14 2.6 13.4 2 12.4 2h-.1c-.3-.4-.7-.5-1-.5-2.4 0-3.6 3-4 4.6l-1.7.5c-.5.2-.5.2-.6.7L3.7 19.4 14.5 21.4l5.8-1.3S15.4 3.5 15.3 3.4zM12.6 4.1l-.9.3V4.2c0-.6-.1-1-.2-1.4.5.1.9.6 1.1 1.3zm-1.8-1.2c.2.4.3.9.3 1.6v.1l-1.9.6c.4-1.4 1-2.1 1.6-2.3zm-.7-.7c.1 0 .2 0 .3.1-.8.4-1.7 1.4-2.1 3.3l-1.5.5c.4-1.4 1.4-3.9 3.3-3.9z" />
      <path fill="#5E8E3E" d="M15 3.5l-.6.2-.6 17.7 6.5-1.3S15.4 3.5 15.3 3.4c-.1 0-.2 0-.3.1z" />
      <path fill="#fff" d="M11.3 7.7l-.7 2.1s-.6-.3-1.4-.3c-1.1 0-1.2.7-1.2.9 0 1 2.6 1.4 2.6 3.7 0 1.8-1.2 3-2.7 3-1.8 0-2.8-1.1-2.8-1.1l.5-1.6s1 .8 1.8.8c.5 0 .8-.4.8-.7 0-1.3-2.1-1.4-2.1-3.5 0-1.8 1.3-3.5 3.9-3.5 1 0 1.3.2 1.3.2z" />
    </svg>
  ),
  tiktok: (
    <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden>
      <path fill="#25F4EE" d="M9.4 9.4v-.9a6.9 6.9 0 0 0-.9-.1 6.6 6.6 0 0 0-3.8 12 6.6 6.6 0 0 1 4.7-11z" />
      <path fill="#FE2C55" d="M9.6 19.5a3 3 0 0 0 3-2.9V2.5h2.6a5 5 0 0 1-.1-.9h-3.5v14.1a3 3 0 0 1-3 2.9 3 3 0 0 1-1.4-.3 3 3 0 0 0 2.4 1.2zM19.9 7.3v-.9a4.9 4.9 0 0 1-2.7-.8 5 5 0 0 0 2.7 1.7z" />
      <path fill="#000" d="M17.2 5.6a5 5 0 0 1-1.2-3.1h-.9a5 5 0 0 0 2.1 3.1zM8.5 12.5a3 3 0 0 0-1.4 5.7 3 3 0 0 1 2.3-4.8 3 3 0 0 1 .9.1V9.9a6.5 6.5 0 0 0-.9-.1h-.2v2.8a3 3 0 0 0-.7-.1zM19.9 7.3v2.7a8.5 8.5 0 0 1-5-1.6v7.2a6.6 6.6 0 0 1-10.2 5.5A6.6 6.6 0 0 0 16 16.4V9.2a8.5 8.5 0 0 0 5 1.6V7.4a5 5 0 0 1-1.1-.1z" />
    </svg>
  ),
  meta: (
    <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden>
      <path fill="#0866FF" d="M6.9 5C4.2 5 2 8.9 2 13c0 2.5 1.1 4.2 3.1 4.2 1.6 0 2.7-.8 4.6-4l1.1-1.9.4.7 1.3 2.2c1.8 2.9 2.9 3.6 4.5 3.6 2 0 3-1.7 3-4.1C20 9 17.9 5 15.2 5c-1.5 0-2.7 1-4 2.8C9.9 6 8.6 5 6.9 5zm8.2 2.3c1.6 0 2.9 2.4 2.9 5.6 0 1.2-.4 1.9-1.1 1.9-.7 0-1.1-.4-2.4-2.5l-1.4-2.4-.6-1c.9-1.1 1.6-1.6 2.6-1.6zm-8.3.2c1 0 1.7.5 2.9 2.4l-.9 1.5c-1.5 2.3-2 2.9-2.8 2.9-.8 0-1.2-.7-1.2-1.9 0-2.5 1-4.9 2-4.9z" />
    </svg>
  ),
  courier: (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" />
      <circle cx="7" cy="17.5" r="1.8" />
      <circle cx="17" cy="17.5" r="1.8" />
    </svg>
  ),
};

export function RealProfitConnect({
  connections,
  installUrl,
  metaOAuth = false,
  metaBusinessId,
  onChanged,
  tiktokLinked,
  onTikTokLinkedChange,
}: {
  connections: RpConnections | null;
  installUrl: string | null;
  /** Muestra «Conectar con Facebook» (OAuth). Público cuando Meta apruebe ads_read. */
  metaOAuth?: boolean;
  /** Business de Real Profit con el que el cliente comparte su cuenta de Meta (modo socio). */
  metaBusinessId: string;
  onChanged: () => Promise<void> | void;
  /** El cliente tocó «Conectar TikTok Ads»: se muestran sus métricas. */
  tiktokLinked: boolean;
  onTikTokLinkedChange: (on: boolean) => void;
}) {
  const t = useTranslations("profit.rp");
  const c = connections;
  const shopifyOn = Boolean(c?.shopify.connected);
  const connectedCount = [
    c?.tiktok.connected && tiktokLinked,
    c?.meta.connected,
    shopifyOn,
    (c?.courier.ordersFromCourier ?? 0) > 0,
  ].filter(Boolean).length;

  // Shopify
  const [shop, setShop] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkMsg, setLinkMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const installHref = withShop(installUrl, shop);

  async function retryLink() {
    setLinkBusy(true);
    setLinkMsg(null);
    try {
      const res = await fetch("/api/profit/link-retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopDomain: shop.trim() || undefined }),
      });
      const json = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      setLinkMsg(res.ok ? { ok: true, text: json.message ?? t("linked") } : { ok: false, text: json.error ?? t("genericError") });
      if (res.ok) await onChanged();
    } catch {
      setLinkMsg({ ok: false, text: t("genericError") });
    } finally {
      setLinkBusy(false);
    }
  }

  // Meta
  const [adAccount, setAdAccount] = useState("");
  const [metaBusy, setMetaBusy] = useState(false);
  // Vuelta de «Conectar con Facebook»: /profit?meta=ok|error&meta_msg=...
  const searchParams = useSearchParams();
  const metaReturn = searchParams.get("meta");
  const metaReturnMsg = searchParams.get("meta_msg");
  const [metaMsg, setMetaMsg] = useState<{ ok: boolean; text: string } | null>(() =>
    metaReturn
      ? {
          ok: metaReturn === "ok",
          text: metaReturnMsg || (metaReturn === "ok" ? t("metaConnected") : t("genericError")),
        }
      : null,
  );
  const [copied, setCopied] = useState(false);
  const [metaEditing, setMetaEditing] = useState(() => Boolean(metaReturn && metaReturn !== "ok"));
  /** Le pedimos acceso a su cuenta: tiene que aprobarlo en Meta Business Suite. */
  const [metaRequestsUrl, setMetaRequestsUrl] = useState<string | null>(null);

  // Limpia ?meta= de la URL y, si conectó, recarga las conexiones.
  useEffect(() => {
    if (!metaReturn) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("meta");
    url.searchParams.delete("meta_msg");
    window.history.replaceState(null, "", url.toString());
    if (metaReturn === "ok") void onChanged();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connectMeta() {
    setMetaBusy(true);
    setMetaMsg(null);
    try {
      const res = await fetch("/api/profit/meta-connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adAccountId: adAccount }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
        pending?: boolean;
        requestsUrl?: string;
      };
      if (res.status === 202 && json.pending) {
        setMetaRequestsUrl(json.requestsUrl ?? "https://business.facebook.com/settings/requests");
        setMetaMsg({ ok: true, text: json.message ?? t("metaPending") });
        return;
      }
      setMetaRequestsUrl(null);
      setMetaMsg(res.ok ? { ok: true, text: json.message ?? t("metaConnected") } : { ok: false, text: json.error ?? t("genericError") });
      if (res.ok) {
        setMetaEditing(false);
        await onChanged();
      }
    } catch {
      setMetaMsg({ ok: false, text: t("genericError") });
    } finally {
      setMetaBusy(false);
    }
  }

  // Meta CSV (plan B universal)
  const metaFileRef = useRef<HTMLInputElement>(null);
  const [metaCsv, setMetaCsv] = useState<string | null>(null);
  const [metaCsvBusy, setMetaCsvBusy] = useState(false);
  const [metaCsvPreview, setMetaCsvPreview] = useState<MetaCsvPreview | null>(null);
  const [metaCsvDone, setMetaCsvDone] = useState<MetaCsvPreview | null>(null);

  async function sendMetaCsv(text: string, apply: boolean) {
    setMetaCsvBusy(true);
    try {
      const res = await fetch("/api/profit/meta-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: text, apply }),
      });
      const json = (await res.json().catch(() => ({}))) as MetaCsvPreview;
      if (!res.ok) json.error = json.error ?? t("genericError");
      if (apply) {
        setMetaCsvDone(json);
        if (res.ok) {
          setMetaCsvPreview(null);
          setMetaCsv(null);
          await onChanged();
        }
      } else {
        setMetaCsvPreview(json);
      }
    } catch {
      (apply ? setMetaCsvDone : setMetaCsvPreview)({ error: t("genericError") });
    } finally {
      setMetaCsvBusy(false);
    }
  }

  async function onMetaFile(file: File | undefined) {
    if (!file) return;
    setMetaCsvDone(null);
    const text = await file.text();
    setMetaCsv(text);
    await sendMetaCsv(text, false);
  }

  // Courier CSV
  const fileRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [csvBusy, setCsvBusy] = useState(false);
  const [preview, setPreview] = useState<CourierPreview | null>(null);
  const [applied, setApplied] = useState<CourierPreview | null>(null);

  async function sendCsv(text: string, apply: boolean) {
    setCsvBusy(true);
    try {
      const res = await fetch("/api/profit/courier-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: text, apply, storeId: c?.shopify.storeId }),
      });
      const json = (await res.json().catch(() => ({}))) as CourierPreview;
      if (!res.ok) json.error = json.error ?? t("genericError");
      if (apply) {
        setApplied(json);
        if (res.ok) {
          setPreview(null);
          setCsv(null);
          setFileName("");
          await onChanged();
        }
      } else {
        setPreview(json);
      }
    } catch {
      (apply ? setApplied : setPreview)({ error: t("genericError") });
    } finally {
      setCsvBusy(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setApplied(null);
    const text = await file.text();
    setCsv(text);
    setFileName(file.name);
    await sendCsv(text, false);
  }

  function downloadTemplate() {
    const blob = new Blob([COURIER_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla-courier.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const lockedNote = <p className="mt-auto text-xs text-ink-3">{t("needsShopify")}</p>;
  const courierCount = c?.courier.ordersFromCourier ?? 0;

  return (
    <PanelCard
      id="profit-shopify-connect"
      className="scroll-mt-6"
      title={t("sourcesTitle")}
      action={
        <ToneBadge tone={connectedCount === 4 ? "ok" : "neutral"} className="num">
          {t("progress", { done: connectedCount, total: 4 })}
        </ToneBadge>
      }
    >
      <ul className="grid gap-4 sm:grid-cols-2">
        {/* 1 · TikTok Ads */}
        <SourceTile
          stepLabel={t("step", { n: 1 })}
          logo={logos.tiktok}
          title={t("tiktokTitle")}
          status={
            !c?.tiktok.connected ? (
              <StatusBadge tone="neutral">{t("noAccounts")}</StatusBadge>
            ) : tiktokLinked ? (
              <StatusBadge tone="ok">{t("connected")}</StatusBadge>
            ) : (
              <StatusBadge tone="warn">{t("pending")}</StatusBadge>
            )
          }
        >
          {!c?.tiktok.connected ? (
            <p>{t("tiktokOffBody")}</p>
          ) : tiktokLinked ? (
            <>
              <p>{t("tiktokOnBody", { count: c.tiktok.accounts })}</p>
              <button
                type="button"
                onClick={() => onTikTokLinkedChange(false)}
                className={linkishMuted}
              >
                {t("tiktokHide")}
              </button>
            </>
          ) : (
            <>
              <p>{t("tiktokConnectBody", { count: c.tiktok.accounts })}</p>
              <button
                type="button"
                onClick={() => onTikTokLinkedChange(true)}
                className={buttonClass("primary", "sm", "self-start")}
              >
                {t("tiktokConnect")}
              </button>
            </>
          )}
        </SourceTile>

        {/* 2 · Meta Ads (no exige Shopify) */}
        <SourceTile
          stepLabel={t("step", { n: 2 })}
          logo={logos.meta}
          title={t("metaTitle")}
          status={
            c?.meta.connected ? (
              <StatusBadge tone="ok">{t("connected")}</StatusBadge>
            ) : (
              <StatusBadge tone="warn">{t("pending")}</StatusBadge>
            )
          }
        >
          {c?.meta.connected && !metaEditing ? (
            <>
              <p>
                <span className="font-semibold text-ink">{c.meta.accountName}</span>
                <br />
                {c.meta.lastSyncError ? (
                  <span className="text-danger-fg">{c.meta.lastSyncError}</span>
                ) : (
                  t("metaOnBody")
                )}
              </p>
              <button type="button" onClick={() => setMetaEditing(true)} className={linkish}>
                {t("metaChange")}
              </button>
            </>
          ) : (
            <>
              {metaOAuth ? (
                <>
                  <a href="/api/profit/meta-oauth" className={metaBrandBtn}>
                    {t("metaOAuthButton")}
                  </a>
                  <p className="text-xs text-ink-3">{t("metaOAuthOr")}</p>
                </>
              ) : null}
              <ol className="list-decimal space-y-2 pl-4 marker:text-ink-3">
                <li>
                  {t("metaStep1")}
                  <span className="mt-1.5 flex max-w-full items-center gap-2 rounded-ctl border border-line bg-field py-1 pl-3 pr-1">
                    <code className="num min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">
                      {metaBusinessId}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(metaBusinessId);
                        setCopied(true);
                        window.setTimeout(() => setCopied(false), 1800);
                      }}
                      className={buttonClass("ghost", "sm")}
                    >
                      <PanelIcon name={copied ? "check" : "copy"} />
                      {copied ? t("copied") : t("copy")}
                    </button>
                  </span>
                </li>
                <li>{t("metaStep2")}</li>
              </ol>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  className="min-w-0 sm:flex-1"
                  placeholder={t("metaPlaceholder")}
                  value={adAccount}
                  onChange={(e) => setAdAccount(e.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                  aria-label={t("metaPlaceholder")}
                />
                <button
                  type="button"
                  onClick={() => void connectMeta()}
                  disabled={metaBusy || adAccount.replace(/\D/g, "").length < 5}
                  className={buttonClass("primary", "md", "shrink-0")}
                >
                  {metaBusy ? t("checking") : t("metaConnect")}
                </button>
              </div>
              {metaMsg ? <ResultLine ok={metaMsg.ok}>{metaMsg.text}</ResultLine> : null}
              {metaRequestsUrl ? (
                <a href={metaRequestsUrl} target="_blank" rel="noreferrer" className={linkish}>
                  {t("metaOpenRequests")}
                </a>
              ) : null}
              <details className="group mt-1 rounded-box border border-line bg-field">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-[13px] font-medium text-ink [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 flex-1">{t("metaCsvTitle")}</span>
                  <PanelIcon name="chevron-down" className="size-3.5 text-ink-3 transition-transform group-open:rotate-180" />
                </summary>
                <div className="flex flex-col gap-2.5 px-3 pb-3">
                  <ol className="list-decimal space-y-1 pl-4 text-xs text-ink-2 marker:text-ink-3">
                    <li>{t("metaCsvStep1")}</li>
                    <li>{t("metaCsvStep2")}</li>
                    <li>{t("metaCsvStep3")}</li>
                  </ol>
                  <input
                    ref={metaFileRef}
                    type="file"
                    accept=".csv,.txt,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      void onMetaFile(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => metaFileRef.current?.click()}
                    disabled={metaCsvBusy}
                    className={buttonClass("outline", "sm", "self-start")}
                  >
                    <PanelIcon name="upload" />
                    {metaCsvBusy && !metaCsvPreview ? t("reading") : t("metaCsvUpload")}
                  </button>
                  {metaCsvPreview ? (
                    metaCsvPreview.error ? (
                      <ResultLine ok={false}>{metaCsvPreview.error}</ResultLine>
                    ) : (
                      <div className="rounded-box border border-line bg-surface p-3">
                        <p className="num text-[13px] font-semibold text-ink">
                          {t("metaCsvSummary", {
                            days: metaCsvPreview.days ?? 0,
                            campaigns: metaCsvPreview.campaigns ?? 0,
                            spend: `${metaCsvPreview.currency ?? ""} ${(metaCsvPreview.totalSpend ?? 0).toLocaleString()}`,
                          })}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => metaCsv && void sendMetaCsv(metaCsv, true)}
                            disabled={metaCsvBusy || !metaCsvPreview.days}
                            className={buttonClass("primary", "sm")}
                          >
                            {metaCsvBusy ? t("applying") : t("metaCsvApply")}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMetaCsvPreview(null);
                              setMetaCsv(null);
                            }}
                            className={buttonClass("outline", "sm")}
                          >
                            {t("cancel")}
                          </button>
                        </div>
                      </div>
                    )
                  ) : null}
                  {metaCsvDone ? (
                    <ResultLine ok={!metaCsvDone.error}>{metaCsvDone.error ?? metaCsvDone.message}</ResultLine>
                  ) : null}
                </div>
              </details>
            </>
          )}
        </SourceTile>

        {/* 3 · Shopify */}
        <SourceTile
          stepLabel={t("step", { n: 3 })}
          logo={logos.shopify}
          title={t("shopifyTitle")}
          status={
            shopifyOn ? (
              <StatusBadge tone="ok">{t("connected")}</StatusBadge>
            ) : (
              <StatusBadge tone="warn">{t("pending")}</StatusBadge>
            )
          }
        >
          {shopifyOn ? (
            <p>
              <span className="font-semibold text-ink">{c?.shopify.storeName}</span>
              {c?.shopify.shopDomain ? <span className="text-ink-3"> · {c.shopify.shopDomain}</span> : null}
              <br />
              {t("shopifyOnBody")}
            </p>
          ) : (
            <>
              <p>{t("shopifyBody")}</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  className="min-w-0 sm:flex-1"
                  placeholder={t("shopifyPlaceholder")}
                  value={shop}
                  onChange={(e) => setShop(e.target.value)}
                  inputMode="url"
                  autoComplete="off"
                  aria-label={t("shopifyPlaceholder")}
                />
                {installHref ? (
                  <a href={installHref} target="_blank" rel="noreferrer" className={buttonClass("primary", "md", "shrink-0")}>
                    {t("shopifyInstall")}
                  </a>
                ) : null}
              </div>
              <button type="button" onClick={() => void retryLink()} disabled={linkBusy} className={linkish}>
                {linkBusy ? t("checking") : t("shopifyAlready")}
              </button>
              {linkMsg ? <ResultLine ok={linkMsg.ok}>{linkMsg.text}</ResultLine> : null}
            </>
          )}
        </SourceTile>

        {/* 4 · Courier CSV */}
        <SourceTile
          stepLabel={t("step", { n: 4 })}
          logo={logos.courier}
          title={t("courierTitle")}
          status={
            courierCount > 0 ? (
              <StatusBadge tone="ok">{t("courierCount", { count: courierCount })}</StatusBadge>
            ) : shopifyOn ? (
              <StatusBadge tone="warn">{t("pending")}</StatusBadge>
            ) : (
              <StatusBadge tone="neutral">{t("locked")}</StatusBadge>
            )
          }
        >
          <p>{t("courierBody")}</p>
          {!shopifyOn ? (
            lockedNote
          ) : (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt,text/csv"
                className="hidden"
                onChange={(e) => {
                  void onFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={csvBusy}
                  className={buttonClass("primary", "sm")}
                >
                  <PanelIcon name="upload" />
                  {csvBusy && !preview ? t("reading") : t("courierUpload")}
                </button>
                <button type="button" onClick={downloadTemplate} className={buttonClass("outline", "sm")}>
                  <PanelIcon name="download" />
                  {t("courierTemplate")}
                </button>
              </div>

              {preview ? (
                <div className="rounded-box border border-line bg-field p-3">
                  {preview.error && !preview.matched ? (
                    <ResultLine ok={false}>{preview.error}</ResultLine>
                  ) : (
                    <>
                      <p className="font-semibold text-ink">
                        {fileName ? `${fileName} · ` : ""}
                        {t("courierMatched", { matched: preview.matched ?? 0, total: preview.totalRows ?? 0 })}
                      </p>
                      {preview.byStatus ? (
                        <p className="mt-1 text-xs text-ink-2">
                          {Object.entries(preview.byStatus)
                            .map(([k, v]) => `${t(`status.${k}` as never)}: ${v}`)
                            .join(" · ")}
                        </p>
                      ) : null}
                      {preview.notFound ? (
                        <p className="mt-1 text-xs text-ink-3">{t("courierNotFound", { count: preview.notFound })}</p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => csv && void sendCsv(csv, true)}
                          disabled={csvBusy || !preview.matched}
                          className={buttonClass("primary", "sm")}
                        >
                          {csvBusy ? t("applying") : t("courierApply")}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPreview(null);
                            setCsv(null);
                            setFileName("");
                          }}
                          className={buttonClass("outline", "sm")}
                        >
                          {t("cancel")}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : null}
              {applied ? <ResultLine ok={!applied.error}>{applied.error ?? applied.message}</ResultLine> : null}
            </>
          )}
        </SourceTile>
      </ul>
    </PanelCard>
  );
}
