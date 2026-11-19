"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import {
  APPEAL_MAX_FILES,
  APPEAL_MAX_FILE_BYTES,
  APPEAL_MIME_TYPES,
} from "@/lib/appeals/account-appeals.shared";
import type { PaymentAccountAllocation } from "@/types/payment";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { Note, ToneBadge } from "@/components/ui/PanelKit";
import {
  PaymentDialogBody,
  PaymentDialogFooter,
  PaymentDialogFrame,
  PaymentDialogHeader,
} from "./PaymentDialog";

/** Se monta al abrir (con `key` por cuenta): el estado arranca limpio cada vez. */
interface AppealAccountModalProps {
  account: PaymentAccountAllocation;
  onClose: () => void;
  onSubmitted: (advertiserId: string) => void;
}

type Prefill = {
  account: { advertiserId: string; name: string; bmLabel: string | null };
  suspension: { reason: string | null; until: string | null };
  companyName: string;
  taxId: string;
  contactEmail: string;
  contactPhone: string;
};

type Fields = {
  companyName: string;
  taxId: string;
  storeUrl: string;
  products: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
};

const EMPTY: Fields = {
  companyName: "",
  taxId: "",
  storeUrl: "",
  products: "",
  contactEmail: "",
  contactPhone: "",
  notes: "",
};

const FIELD_LABEL = "block text-sm font-medium text-ink";
const SECTION_TITLE = "text-sm font-semibold text-ink";

export function AppealAccountModal({ account, onClose, onSubmitted }: AppealAccountModalProps) {
  const t = useTranslations("appeals");
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [longBan, setLongBan] = useState(false);
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function draft(current: Fields, names: string[]) {
    setDrafting(true);
    try {
      const res = await fetch("/api/appeals/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adAccountId: account.id, ...current, attachmentNames: names }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || !json.ok || !json.message) throw new Error(json.error || t("errDraft"));
      setMessage(json.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errDraft"));
    } finally {
      setDrafting(false);
    }
  }

  useEffect(() => {
    let alive = true;
    void fetch(`/api/appeals?adAccountId=${encodeURIComponent(account.id)}`, { cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json()) as { ok?: boolean; error?: string; prefill?: Prefill };
        if (!alive) return;
        if (!res.ok || !json.ok || !json.prefill) throw new Error(json.error || t("errLoad"));
        const p = json.prefill;
        const next: Fields = {
          ...EMPTY,
          companyName: p.companyName,
          taxId: p.taxId,
          contactEmail: p.contactEmail,
          contactPhone: p.contactPhone,
        };
        setPrefill(p);
        setLongBan(
          p.suspension.until
            ? new Date(p.suspension.until).getTime() - Date.now() > 365 * 24 * 3600 * 1000
            : false,
        );
        setFields(next);
        setLoading(false);
        await draft(next, []);
      })
      .catch((e) => {
        if (!alive) return;
        setLoading(false);
        setError(e instanceof Error ? e.message : t("errLoad"));
      });
    return () => {
      alive = false;
    };
    // Una sola carga al abrir; draft y t no cambian mientras está abierto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function set<K extends keyof Fields>(key: K, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    setError(null);
    const next = [...files];
    for (const f of Array.from(list)) {
      if (!APPEAL_MIME_TYPES.includes(f.type)) {
        setError(t("errFileType", { name: f.name }));
        continue;
      }
      if (f.size > APPEAL_MAX_FILE_BYTES) {
        setError(t("errFileSize", { name: f.name }));
        continue;
      }
      if (next.length >= APPEAL_MAX_FILES) {
        setError(t("errFileCount", { max: APPEAL_MAX_FILES }));
        break;
      }
      next.push(f);
    }
    setFiles(next);
    if (fileInput.current) fileInput.current.value = "";
  }

  const canSend =
    !loading &&
    !drafting &&
    !sending &&
    fields.companyName.trim().length > 1 &&
    fields.storeUrl.trim().length > 3 &&
    fields.products.trim().length > 2 &&
    message.trim().length > 40;

  async function submit() {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("adAccountId", account.id);
      for (const [k, v] of Object.entries(fields)) form.set(k, v);
      form.set("appealMessage", message);
      for (const f of files) form.append("files", f);
      const res = await fetch("/api/appeals", { method: "POST", body: form });
      const json = (await res.json()) as { ok?: boolean; error?: string; appeal?: { advertiserId: string } };
      if (!res.ok || !json.ok || !json.appeal) throw new Error(json.error || t("errSend"));
      setDone(true);
      onSubmitted(json.appeal.advertiserId);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errSend"));
    } finally {
      setSending(false);
    }
  }

  return createPortal(
    <PaymentDialogFrame
      onDismiss={onClose}
      dismissLabel={t("close")}
      labelledBy="appeal-title"
      size="wide"
    >
      {done ? (
        <div className="grid justify-items-center gap-1 overflow-y-auto px-6 py-10 text-center">
          <span
            aria-hidden
            className="tone-ok mb-2.5 grid size-10 place-items-center rounded-box bg-[var(--t-bg)] text-[var(--t-fg)]"
          >
            <PanelIcon name="check-circle" className="size-[18px]" />
          </span>
          <h2 id="appeal-title" className="text-lg font-semibold tracking-[-0.015em] text-ink">
            {t("doneTitle")}
          </h2>
          <p className="max-w-[44ch] text-sm text-ink-2">{t("doneBody")}</p>
          <Button className="mt-4" onClick={onClose}>
            {t("doneCta")}
          </Button>
        </div>
      ) : (
        <>
          <PaymentDialogHeader
            titleId="appeal-title"
            title={t("title")}
            description={
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <ToneBadge tone="danger" dot>
                  {t("eyebrow")}
                </ToneBadge>
                <span className="min-w-0 truncate">
                  {account.name}
                  {account.bmLabel ? ` · ${account.bmLabel}` : ""} · adv{" "}
                  <span className="font-mono text-xs">{account.externalAccountId}</span>
                </span>
              </span>
            }
            onClose={onClose}
            closeLabel={t("close")}
          />

          <PaymentDialogBody className="space-y-5">
            <Note tone="warn" title={t("detectedTitle")}>
              <p>
                {t("detectedBody")}
                {longBan ? ` ${t("longBan")}` : ""}
              </p>
              {prefill?.suspension.reason ? (
                <p className="mt-2 rounded-ctl border border-warn-line bg-surface px-3 py-2 text-xs italic">
                  “{prefill.suspension.reason}”
                </p>
              ) : null}
              <p className="mt-3 text-xs font-semibold">{t("causesTitle")}</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs leading-relaxed">
                <li>{t("cause1")}</li>
                <li>{t("cause2")}</li>
                <li>{t("cause3")}</li>
                <li>{t("cause4")}</li>
              </ul>
              <p className="mt-3 font-semibold">{t("weHandle")}</p>
            </Note>

            {loading ? (
              <p className="py-6 text-center text-[13px] text-ink-3">{t("loading")}</p>
            ) : (
              <>
                <section>
                  <h3 className={SECTION_TITLE}>{t("step1")}</h3>
                  <div className="mt-3 grid gap-x-3 gap-y-4 sm:grid-cols-2">
                    <label className={`${FIELD_LABEL} sm:col-span-2`}>
                      {t("companyName")} *
                      <Input className="mt-1.5" value={fields.companyName} onChange={(e) => set("companyName", e.target.value)} />
                    </label>
                    <label className={FIELD_LABEL}>
                      {t("taxId")}
                      <Input className="mt-1.5" value={fields.taxId} onChange={(e) => set("taxId", e.target.value)} placeholder="20601234567" />
                    </label>
                    <label className={FIELD_LABEL}>
                      {t("storeUrl")} *
                      <Input className="mt-1.5" value={fields.storeUrl} onChange={(e) => set("storeUrl", e.target.value)} placeholder="https://mitienda.com" inputMode="url" />
                    </label>
                    <label className={`${FIELD_LABEL} sm:col-span-2`}>
                      {t("products")} *
                      <Input className="mt-1.5" value={fields.products} onChange={(e) => set("products", e.target.value)} placeholder={t("productsPh")} />
                    </label>
                    <label className={FIELD_LABEL}>
                      {t("email")}
                      <Input className="mt-1.5" value={fields.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} inputMode="email" />
                    </label>
                    <label className={FIELD_LABEL}>
                      {t("phone")}
                      <Input className="mt-1.5" value={fields.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} inputMode="tel" />
                    </label>
                    <label className={`${FIELD_LABEL} sm:col-span-2`}>
                      {t("notes")}
                      <Textarea className="mt-1.5 min-h-[4.5rem] resize-y" value={fields.notes} onChange={(e) => set("notes", e.target.value)} placeholder={t("notesPh")} />
                    </label>
                  </div>
                </section>

                <section>
                  <h3 className={SECTION_TITLE}>{t("step2")}</h3>
                  <p className="mt-1 text-[13px] text-ink-2">{t("docsHint")}</p>
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    className="mt-3 grid w-full justify-items-center gap-1 rounded-box border border-dashed border-line-strong bg-field p-5 text-center transition-colors hover:border-accent"
                  >
                    <PanelIcon name="upload" className="text-ink-2" />
                    <span className="text-[13px] font-semibold text-ink">{t("addDocs")}</span>
                    <span className="text-xs text-ink-3">{t("docsLimits", { max: APPEAL_MAX_FILES })}</span>
                  </button>
                  <input
                    ref={fileInput}
                    type="file"
                    multiple
                    accept={APPEAL_MIME_TYPES.join(",")}
                    className="hidden"
                    onChange={(e) => addFiles(e.target.files)}
                  />
                  {files.length ? (
                    <ul className="mt-2 space-y-1.5">
                      {files.map((f, i) => (
                        <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-ctl bg-subtle px-3 py-2 text-xs">
                          <span className="flex min-w-0 items-center gap-2 font-medium text-ink">
                            <PanelIcon name="file" className="text-ink-3" />
                            <span className="truncate">{f.name}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setFiles(files.filter((_, j) => j !== i))}
                            className="shrink-0 rounded-ctl px-1.5 py-0.5 font-medium text-ink-3 hover:text-danger-fg"
                          >
                            {t("remove")}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>

                <section>
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <h3 className={SECTION_TITLE}>{t("step3")}</h3>
                      <p className="mt-1 text-[13px] text-ink-2">{t("messageHint")}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void draft(fields, files.map((f) => f.name))}
                      disabled={drafting}
                    >
                      <PanelIcon name="sparkle" />
                      {drafting ? t("drafting") : t("redraft")}
                    </Button>
                  </div>
                  <Textarea
                    className="mt-3 min-h-[12rem] resize-y"
                    value={drafting && !message ? t("draftingLong") : message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={drafting}
                    aria-label={t("step3")}
                    lang="en"
                  />
                </section>
              </>
            )}

            {error ? <Note tone="danger">{error}</Note> : null}
          </PaymentDialogBody>

          <PaymentDialogFooter className="border-t border-line pt-4">
            <Button variant="outline" onClick={onClose}>
              {t("close")}
            </Button>
            <Button onClick={() => void submit()} disabled={!canSend}>
              {sending ? t("sending") : t("send")}
            </Button>
          </PaymentDialogFooter>
        </>
      )}
    </PaymentDialogFrame>,
    document.body,
  );
}
