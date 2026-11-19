"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { PageHeader, PanelCard } from "@/components/ui/PageHeader";
import { buttonClass } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { FilterBar, Note, TabBar, ToneBadge } from "@/components/ui/PanelKit";
import { cn } from "@/lib/cn";

type AccountOpt = {
  id: string;
  name: string;
  advertiserId: string;
  status: string;
};

type PixelRow = {
  id: string;
  advertiserId: string;
  pixelId: string;
  pixelCode: string | null;
  name: string;
  status: string;
  eventsJson: unknown;
  createdAt: string;
};

type TokenInfo = {
  pixelCode: string;
  hint: string;
  createdAt: string;
  lastUsedAt: string | null;
  eventsSent: number;
};

/** Mismo camino que el Events API de TikTok; solo cambia el dominio. */
const EVENTS_ENDPOINT =
  "https://www.adsholistic.com/api/tiktok/open_api/v1.3/event/track";

/** Un píxel compartido se guarda una vez por cuenta vinculada: acá se ve uno solo. */
type PixelGroup = {
  key: string;
  rowId: string;
  name: string;
  pixelCode: string;
  advertiserIds: string[];
  events: string[];
};

/** Código base tal cual lo entrega TikTok en Events Manager. */
function snippetFor(pixelCode: string) {
  return `<!-- TikTok Pixel Code Start -->
<script>
!function (w, d, t) {
  w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(
var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script")
;n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};

  ttq.load('${pixelCode}');
  ttq.page();
}(window, document, 'ttq');
</script>
<!-- TikTok Pixel Code End -->`;
}

function eventNamesFromJson(eventsJson: unknown): string[] {
  return Array.isArray(eventsJson)
    ? eventsJson.map((x) => String(x)).filter(Boolean)
    : [];
}

function groupPixels(rows: PixelRow[]): PixelGroup[] {
  const map = new Map<string, PixelGroup>();
  for (const p of rows) {
    const code = p.pixelCode?.trim() || p.pixelId;
    const key = p.pixelId || code;
    const events = eventNamesFromJson(p.eventsJson);
    const hit = map.get(key);
    if (!hit) {
      map.set(key, {
        key,
        rowId: p.id,
        name: p.name,
        pixelCode: code,
        advertiserIds: [p.advertiserId],
        events,
      });
      continue;
    }
    if (!hit.advertiserIds.includes(p.advertiserId)) {
      hit.advertiserIds.push(p.advertiserId);
    }
    // Si alguna fila ya tiene eventos, el píxel los tiene (son del píxel).
    if (events.length > hit.events.length) {
      hit.events = events;
      hit.rowId = p.id;
    }
  }
  return [...map.values()];
}

function CopyButton({
  value,
  label,
  copiedLabel,
  variant = "outline",
}: {
  value: string;
  label: string;
  copiedLabel: string;
  variant?: "primary" | "outline" | "ghost";
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        })
      }
      className={buttonClass(variant, "sm", "shrink-0")}
    >
      <PanelIcon name="copy" />
      {copied ? copiedLabel : label}
    </button>
  );
}

/** Cuenta para marcar (v3 «pick»): casilla con aspecto de botón. */
function AccountPick({
  name,
  checked,
  onChange,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="relative max-w-full">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="peer absolute inset-0 m-0 cursor-pointer opacity-0"
      />
      <span
        className={cn(
          "flex h-8 max-w-full items-center gap-1.5 rounded-ctl border px-3 text-[13px] font-medium shadow-ctl peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--ui-focus)]",
          checked ? "border-accent-line bg-accent-soft text-accent-text" : "border-line bg-field text-ink",
        )}
      >
        {checked ? <PanelIcon name="check" className="size-3.5" /> : null}
        <span className="truncate">{name}</span>
      </span>
    </label>
  );
}

/** Bloque dentro de la tarjeta del píxel: título, explicación, acción y contenido. */
function PixelSection({
  title,
  body,
  action,
  children,
}: {
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="grid gap-3 border-t border-line pt-5 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-[68ch]">
          <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">{title}</h3>
          {body ? <p className="mt-1 text-[13px] leading-5 text-ink-2">{body}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** Valor para copiar dentro de un recuadro (v3 «linkbox»). */
function CopyBox({ label, value, children }: { label?: string; value: string; children: ReactNode }) {
  return (
    <div className="flex max-w-2xl items-center gap-2 rounded-ctl border border-line bg-field py-1 pl-3 pr-1">
      {label ? <span className="shrink-0 text-xs text-ink-3">{label}</span> : null}
      <code className="num min-w-0 flex-1 truncate text-[13px] font-semibold text-ink" title={value}>
        {value}
      </code>
      {children}
    </div>
  );
}

export function PixelsPageClient({ clienteName }: { clienteName: string }) {
  const t = useTranslations("pixels");
  const tCommon = useTranslations("common");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [activating, setActivating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountOpt[]>([]);
  const [rows, setRows] = useState<PixelRow[]>([]);
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [newToken, setNewToken] = useState<{ pixelCode: string; token: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [pixelName, setPixelName] = useState("");
  const [linking, setLinking] = useState(false);
  /** null = todas las cuentas que faltan, marcadas por defecto. */
  const [linkPickedRaw, setLinkPickedRaw] = useState<string[] | null>(null);

  /** advertiserId elegido arriba; null = todas las cuentas. */
  const [accountFilter, setAccountFilter] = useState<string | null>(null);

  const pixels = useMemo(() => groupPixels(rows), [rows]);
  const visiblePixels = accountFilter
    ? pixels.filter((p) => p.advertiserIds.includes(accountFilter))
    : pixels;
  const selected =
    visiblePixels.find((p) => p.key === selectedKey) ?? visiblePixels[0] ?? null;
  const accountName = useCallback(
    (id: string) => accounts.find((a) => a.advertiserId === id)?.name ?? id,
    [accounts],
  );
  const creatorOpen = showCreate || (!loading && pixels.length === 0);

  type LoadResult =
    | { ok: true; pixels: PixelRow[]; accounts: AccountOpt[]; tokens: TokenInfo[] }
    | { ok: false; error: string };

  const fetchPixels = useCallback(async (): Promise<LoadResult> => {
    try {
      const res = await fetch("/api/pixels", { cache: "no-store" });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        pixels?: PixelRow[];
        accounts?: AccountOpt[];
        tokens?: TokenInfo[];
      };
      if (!res.ok || !json.ok) return { ok: false, error: json.error || t("loadError") };
      return {
        ok: true,
        pixels: json.pixels ?? [],
        accounts: json.accounts ?? [],
        tokens: json.tokens ?? [],
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : t("loadError") };
    }
  }, [t]);

  const applyLoad = useCallback((r: LoadResult) => {
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setRows(r.pixels);
    setAccounts(r.accounts);
    setTokens(r.tokens);
    setPickedIds((prev) => {
      const valid = prev.filter((id) => r.accounts.some((a) => a.advertiserId === id));
      return valid.length ? valid : r.accounts.map((a) => a.advertiserId);
    });
  }, []);

  // `loading` arranca en true; al recargar se siguen mostrando los datos actuales.
  const refresh = useCallback(
    async () => applyLoad(await fetchPixels()),
    [applyLoad, fetchPixels],
  );

  useEffect(() => {
    let alive = true;
    void fetchPixels().then((r) => {
      if (alive) applyLoad(r);
    });
    return () => {
      alive = false;
    };
  }, [fetchPixels, applyLoad]);

  function togglePicked(id: string) {
    setPickedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleCreate() {
    if (pickedIds.length === 0) {
      setError(t("pickAccounts"));
      return;
    }
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/pixels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advertiserIds: pickedIds,
          pixelName: pixelName.trim() || undefined,
          setupCodEvents: false,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        pixel?: PixelRow;
        failures?: { advertiserId: string; error: string }[];
      };
      if (!res.ok || !json.ok) throw new Error(json.error || t("createError"));
      if (json.failures?.length) {
        setError(
          t("linkFailed", {
            accounts: json.failures.map((f) => accountName(f.advertiserId)).join(", "),
          }),
        );
      }
      setNotice(t("created"));
      setPixelName("");
      setShowCreate(false);
      await refresh();
      if (json.pixel?.pixelId) setSelectedKey(json.pixel.pixelId);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("createError"));
    } finally {
      setCreating(false);
    }
  }

  async function handleImport() {
    if (pickedIds.length === 0) {
      setError(t("pickAccounts"));
      return;
    }
    setSyncing(true);
    setError(null);
    setNotice(null);
    try {
      // Un píxel compartido vuelve una vez por cuenta: contamos píxeles únicos.
      const found = new Set<string>();
      for (const advertiserId of pickedIds) {
        const res = await fetch(
          `/api/pixels?syncAdvertiser=${encodeURIComponent(advertiserId)}`,
          { cache: "no-store" },
        );
        const json = (await res.json()) as {
          ok?: boolean;
          error?: string;
          pixels?: PixelRow[];
        };
        if (!res.ok || !json.ok) throw new Error(json.error || t("syncError"));
        for (const p of json.pixels ?? []) found.add(p.pixelId || p.pixelCode || p.id);
      }
      await refresh();
      if (found.size === 0) {
        setNotice(t("importNone"));
      } else {
        setNotice(t("importFound", { count: found.size }));
        setShowCreate(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("syncError"));
    } finally {
      setSyncing(false);
    }
  }

  async function handleActivate() {
    if (!selected) return;
    setActivating(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/pixels/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pixelRowId: selected.rowId }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        skipped?: string[];
      };
      if (!res.ok || !json.ok) throw new Error(json.error || t("eventsError"));
      setNotice(
        json.skipped?.length
          ? t("eventsDonePartial", { skipped: json.skipped.join(", ") })
          : t("eventsDone"),
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("eventsError"));
    } finally {
      setActivating(false);
    }
  }

  async function handleGenerateToken() {
    if (!selected) return;
    const current = tokens.find((x) => x.pixelCode === selected.pixelCode);
    if (current && !window.confirm(t("tokenReplaceConfirm"))) return;
    setGenerating(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/pixels/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pixelRowId: selected.rowId }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        token?: string;
        info?: TokenInfo;
      };
      if (!res.ok || !json.ok || !json.token || !json.info) {
        throw new Error(json.error || t("tokenError"));
      }
      const info = json.info;
      setNewToken({ pixelCode: info.pixelCode, token: json.token });
      setTokens((prev) => [...prev.filter((x) => x.pixelCode !== info.pixelCode), info]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("tokenError"));
    } finally {
      setGenerating(false);
    }
  }

  const unlinkedAccounts = selected
    ? accounts.filter((a) => !selected.advertiserIds.includes(a.advertiserId))
    : [];
  // Por defecto todas las cuentas que faltan quedan marcadas.
  const linkPicked = (linkPickedRaw ?? unlinkedAccounts.map((a) => a.advertiserId)).filter(
    (id) => unlinkedAccounts.some((a) => a.advertiserId === id),
  );

  function toggleLinkPicked(id: string) {
    setLinkPickedRaw(
      linkPicked.includes(id) ? linkPicked.filter((x) => x !== id) : [...linkPicked, id],
    );
  }

  async function handleLinkMore() {
    if (!selected || linkPicked.length === 0) return;
    setLinking(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/pixels/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pixelRowId: selected.rowId, advertiserIds: linkPicked }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        linkedAdvertiserIds?: string[];
        linkFailures?: { advertiserId: string; error: string }[];
      };
      if (!res.ok || !json.ok) throw new Error(json.error || t("linkMoreError"));
      if (json.linkFailures?.length) {
        setError(
          t("linkFailed", {
            accounts: json.linkFailures.map((f) => accountName(f.advertiserId)).join(", "),
          }),
        );
      }
      if (json.linkedAdvertiserIds?.length) {
        setNotice(
          t("linkMoreDone", {
            accounts: json.linkedAdvertiserIds.map(accountName).join(", "),
          }),
        );
      }
      setLinkPickedRaw(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("linkMoreError"));
    } finally {
      setLinking(false);
    }
  }

  const activeToken = selected
    ? tokens.find((x) => x.pixelCode === selected.pixelCode) ?? null
    : null;
  const shownToken =
    selected && newToken?.pixelCode === selected.pixelCode ? newToken.token : null;

  const emailHref = selected
    ? `mailto:?subject=${encodeURIComponent(t("emailSubject"))}&body=${encodeURIComponent(
        `${t("emailIntro")}\n\nPixel ID: ${selected.pixelCode}\n\n${snippetFor(selected.pixelCode)}`,
      )}`
    : "";

  const snippet = selected ? snippetFor(selected.pixelCode) : "";

  return (
    <div className="space-y-4 lg:space-y-5">
      <PageHeader
        eyebrow={clienteName || undefined}
        title={t("module")}
        lede={t("subtitle")}
        actions={
          pixels.length > 0 && !showCreate ? (
            <button
              type="button"
              onClick={() => {
                setShowCreate(true);
                setNotice(null);
              }}
              className={buttonClass("outline", "md")}
            >
              {t("newPixel")}
            </button>
          ) : null
        }
      />

      {error ? (
        <div role="alert">
          <Note tone="warn">{error}</Note>
        </div>
      ) : null}
      {notice ? (
        <div role="status">
          <Note tone="ok" icon="check-circle">
            {notice}
          </Note>
        </div>
      ) : null}

      {loading && pixels.length === 0 ? (
        <PanelCard aria-busy>
          <p className="py-6 text-center text-[13px] text-ink-3">{tCommon("loading")}</p>
        </PanelCard>
      ) : null}

      {creatorOpen && !loading ? (
        <PanelCard
          title={pixels.length === 0 ? t("createFirstTitle") : t("createTitle")}
          description={t("createBody")}
          action={
            pixels.length > 0 ? (
              <button type="button" onClick={() => setShowCreate(false)} className={buttonClass("ghost", "sm")}>
                {tCommon("cancel")}
              </button>
            ) : null
          }
        >
          {accounts.length === 0 ? (
            <Note tone="warn">{t("noAccounts")}</Note>
          ) : (
            <div className="space-y-4">
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-ink">{t("accountsLabel")}</legend>
                <div className="flex flex-wrap gap-1.5">
                  {accounts.map((a) => (
                    <AccountPick
                      key={a.advertiserId}
                      name={a.name}
                      checked={pickedIds.includes(a.advertiserId)}
                      onChange={() => togglePicked(a.advertiserId)}
                    />
                  ))}
                </div>
              </fieldset>

              <label className="grid max-w-[460px] gap-1.5">
                <span className="text-sm font-medium text-ink">{t("nameOptional")}</span>
                <Input
                  value={pixelName}
                  onChange={(e) => setPixelName(e.target.value)}
                  placeholder={`${clienteName} · Pixel`}
                />
              </label>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleCreate()}
                  disabled={creating || syncing || pickedIds.length === 0}
                  className={buttonClass("primary", "md")}
                >
                  {creating ? t("creating") : t("createAction")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleImport()}
                  disabled={creating || syncing || pickedIds.length === 0}
                  className="text-[13px] font-medium text-accent-text underline-offset-[3px] hover:underline disabled:opacity-50"
                >
                  {syncing ? t("importing") : t("importExisting")}
                </button>
              </div>
            </div>
          )}
        </PanelCard>
      ) : null}

      {pixels.length > 1 && accounts.length > 1 ? (
        <FilterBar>
          <label className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px] font-medium text-ink-2">
            {t("filterLabel")}
            <span className="w-64 max-w-full">
              <Select
                value={accountFilter ?? ""}
                onChange={(e) => {
                  setAccountFilter(e.target.value || null);
                  setSelectedKey(null);
                  setLinkPickedRaw(null);
                }}
              >
                <option value="">{t("filterAll")}</option>
                {accounts.map((a) => (
                  <option key={a.advertiserId} value={a.advertiserId}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </span>
          </label>
        </FilterBar>
      ) : null}

      {accountFilter && visiblePixels.length === 0 ? <Note>{t("filterEmpty")}</Note> : null}

      {visiblePixels.length > 1 ? (
        <TabBar
          label={t("title")}
          value={selected?.key ?? ""}
          onChange={(key) => {
            setSelectedKey(key);
            setLinkPickedRaw(null);
          }}
          tabs={visiblePixels.map((p) => ({
            value: p.key,
            label: (
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  className={cn("size-2 shrink-0 rounded-full bg-[var(--t-solid)]", p.events.length ? "tone-ok" : "tone-warn")}
                />
                <span className="max-w-[240px] truncate">{p.name}</span>
                <span className="text-xs font-normal text-ink-3">
                  {/^tiktok pixel for shopify/i.test(p.name) ? `${t("shopifyBadge")} · ` : ""}
                  {t("accountsCount", { count: p.advertiserIds.length })}
                </span>
              </span>
            ),
          }))}
        />
      ) : null}

      {selected ? (
        <PanelCard
          ruled
          title={selected.name}
          description={t("installBody")}
          action={
            <a href={emailHref} className={buttonClass("outline", "sm")}>
              <PanelIcon name="send" />
              {t("emailInstructions")}
            </a>
          }
        >
          <div className="space-y-5">
            <PixelSection title={t("gettingStarted")} body={t("gettingStartedBody")}>
              <CopyBox label="Pixel ID" value={selected.pixelCode}>
                <CopyButton value={selected.pixelCode} label={t("copy")} copiedLabel={t("copied")} variant="ghost" />
              </CopyBox>
              <p className="text-xs text-ink-3">
                {t("linkedTo", { accounts: selected.advertiserIds.map(accountName).join(" · ") })}
              </p>
            </PixelSection>

            {unlinkedAccounts.length > 0 ? (
              <PixelSection title={t("linkMoreTitle")} body={t("linkMoreBody")}>
                <fieldset>
                  <legend className="sr-only">{t("linkMoreTitle")}</legend>
                  <div className="flex flex-wrap gap-1.5">
                    {unlinkedAccounts.map((a) => (
                      <AccountPick
                        key={a.advertiserId}
                        name={a.name}
                        checked={linkPicked.includes(a.advertiserId)}
                        onChange={() => toggleLinkPicked(a.advertiserId)}
                      />
                    ))}
                  </div>
                </fieldset>
                <button
                  type="button"
                  onClick={() => void handleLinkMore()}
                  disabled={linking || linkPicked.length === 0}
                  className={buttonClass("primary", "sm", "justify-self-start")}
                >
                  {linking ? t("linkingMore") : t("linkMoreAction")}
                </button>
              </PixelSection>
            ) : null}

            <PixelSection
              title={t("step1Title")}
              body={t("step1Body")}
              action={<CopyButton value={snippet} label={t("copyCode")} copiedLabel={t("copied")} variant="primary" />}
            >
              <pre
                tabIndex={0}
                aria-label={t("step1Title")}
                className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-box border border-line bg-subtle px-3.5 py-3 font-mono text-xs leading-5 text-ink"
              >
                {snippet}
              </pre>
            </PixelSection>

            <PixelSection
              title={
                <>
                  {t("step2Title")}
                  <ToneBadge tone={selected.events.length ? "ok" : "warn"} dot>
                    {selected.events.length ? t("eventsOn") : t("eventsOff")}
                  </ToneBadge>
                </>
              }
              body={t("step2Body")}
              action={
                <button
                  type="button"
                  onClick={() => void handleActivate()}
                  disabled={activating}
                  className={buttonClass(selected.events.length ? "outline" : "primary", "sm")}
                >
                  {activating ? t("activating") : selected.events.length ? t("reactivate") : t("activate")}
                </button>
              }
            >
              {selected.events.length ? (
                <ul className="flex flex-wrap gap-1.5">
                  {selected.events.map((ev) => (
                    <li
                      key={ev}
                      className="num inline-flex h-6 items-center rounded-[6px] bg-subtle px-2 text-[11px] font-medium text-ink-2"
                    >
                      {ev}
                    </li>
                  ))}
                </ul>
              ) : null}
            </PixelSection>

            <PixelSection
              title={
                <>
                  {t("tokenTitle")}
                  <span className="inline-flex h-5 items-center rounded-[6px] bg-subtle px-[7px] text-[11px] font-medium text-ink-2">
                    {t("optional")}
                  </span>
                </>
              }
              body={t("tokenBody")}
              action={
                <button
                  type="button"
                  onClick={() => void handleGenerateToken()}
                  disabled={generating}
                  className={buttonClass("outline", "sm")}
                >
                  {generating ? t("tokenGenerating") : activeToken ? t("tokenRegenerate") : t("tokenGenerate")}
                </button>
              }
            >
              {shownToken ? (
                <Note tone="warn" title={t("tokenSaveNow")}>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <code className="num min-w-0 flex-1 break-all rounded-ctl border border-line bg-surface px-3 py-2 text-xs text-ink">
                      {shownToken}
                    </code>
                    <CopyButton value={shownToken} label={t("copy")} copiedLabel={t("copied")} />
                  </div>
                </Note>
              ) : activeToken ? (
                <p className="text-xs text-ink-2">
                  {t("tokenActive", {
                    hint: activeToken.hint,
                    date: new Date(activeToken.createdAt).toLocaleDateString(),
                    events: activeToken.eventsSent,
                  })}
                </p>
              ) : null}

              {shownToken || activeToken ? (
                <div className="grid gap-1.5">
                  <p className="eyebrow">{t("tokenEndpoint")}</p>
                  <CopyBox value={EVENTS_ENDPOINT}>
                    <CopyButton value={EVENTS_ENDPOINT} label={t("copy")} copiedLabel={t("copied")} variant="ghost" />
                  </CopyBox>
                  <p className="text-xs leading-5 text-ink-3">{t("tokenEndpointHint")}</p>
                </div>
              ) : null}
            </PixelSection>
          </div>
        </PanelCard>
      ) : null}
    </div>
  );
}
