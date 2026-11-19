"use client";

import { useCallback, useId, useRef, useState, type DragEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, buttonClass } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Note, ToneBadge } from "@/components/ui/PanelKit";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { useObjectUrl } from "@/hooks/useObjectUrl";
import { cn } from "@/lib/cn";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import type { CreativeAccountOption } from "@/lib/creatives/types";

interface CreativeUploadResponse {
  ok: boolean;
  asset: { id: string; name: string };
  job: { id: string; status: string };
}

const ACCEPT = "image/*,video/*,application/pdf";
const MAX_MB = 50;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileKind(file: File): "image" | "video" | "pdf" | "other" {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) return "pdf";
  return "other";
}

export function CreativeUploadPanel({
  clienteName,
  accounts = [],
  repeatRejectKind = null,
}: {
  clienteName?: string;
  accounts?: CreativeAccountOption[];
  /** Último rechazo de la cuenta: avisa antes de subir otro igual. */
  repeatRejectKind?: "policy" | "claims" | null;
}) {
  const t = useTranslations("creatives.upload");
  const router = useRouter();
  const searchParams = useSearchParams();
  const fieldId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState("");
  const [adAccountId, setAdAccountId] = useState(
    () => accounts.find((a) => a.status === "active")?.id ?? accounts[0]?.id ?? "",
  );
  const [parentDraftId, setParentDraftId] = useState<string | null>(null);
  const [fixLabel, setFixLabel] = useState<string | null>(null);
  const [fixKind, setFixKind] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const previewUrl = useObjectUrl(file);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modo "corregir" desde la URL (?fixDraft…): ajuste durante el render cuando cambian
  // los parámetros. Se compara por valores (no por la identidad de `accounts`, que con
  // el default `[]` es nueva en cada render) para no pisar la cuenta elegida a mano.
  const fixDraftParam = searchParams.get("fixDraft")?.trim() || "";
  const fixAccountParam = searchParams.get("fixAccount")?.trim() || "";
  const fixLabelParam = searchParams.get("fixLabel")?.trim() || "";
  const fixKindParam = searchParams.get("fixKind")?.trim() || "";
  const fixAccountKnown =
    Boolean(fixAccountParam) && accounts.some((a) => a.id === fixAccountParam);
  const fixParamsKey = [
    fixDraftParam,
    fixAccountParam,
    fixLabelParam,
    fixKindParam,
    fixAccountKnown ? "1" : "0",
  ].join("\u0000");
  const [appliedFixParamsKey, setAppliedFixParamsKey] = useState<string | null>(null);
  if (appliedFixParamsKey !== fixParamsKey) {
    setAppliedFixParamsKey(fixParamsKey);
    if (fixDraftParam) {
      setParentDraftId(fixDraftParam);
      if (fixLabelParam) setFixLabel(fixLabelParam);
      setFixKind(fixKindParam || null);
      if (fixAccountKnown) setAdAccountId(fixAccountParam);
    }
  }

  const pickFile = useCallback(
    (next: File | null) => {
      if (!next) {
        setFile(null);
        return;
      }
      if (next.size > MAX_MB * 1024 * 1024) {
        setError(t("fileTooLarge", { max: MAX_MB }));
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setError(null);
      setSuccess(null);
      setFile(next);
    },
    [t],
  );

  function clearFixMode() {
    setParentDraftId(null);
    setFixLabel(null);
    setFixKind(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("fixDraft");
    params.delete("fixAccount");
    params.delete("fixLabel");
    params.delete("fixKind");
    const qs = params.toString();
    router.replace(qs ? `?${qs}#creative-upload` : "#creative-upload", {
      scroll: false,
    });
  }

  function clearForm() {
    setName("");
    setFile(null);
    setError(null);
    setSuccess(null);
    setDragging(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleUpload() {
    if (!file) {
      setError(t("selectFile"));
      return;
    }
    if (!adAccountId) {
      setError(t("selectAccount"));
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const formData = new FormData();
      formData.append("asset", file);
      const label =
        name.trim() ||
        (clienteName ? `${clienteName} · ${file.name}` : file.name);
      formData.append("name", label);
      if (adAccountId) {
        formData.append("adAccountId", adAccountId);
        const selected = accounts.find((a) => a.id === adAccountId);
        if (selected?.externalAccountId) {
          formData.append("advertiserId", selected.externalAccountId);
        }
      }
      if (parentDraftId) {
        formData.append("parentDraftId", parentDraftId);
      }

      const response = await apiClient<CreativeUploadResponse>(
        "/api/creative-assets",
        {
          method: "POST",
          body: formData,
        },
      );

      setSuccess(
        parentDraftId
          ? t("successFix", {
              name: response.asset.name,
              status: response.job.status,
            })
          : t("success", {
              name: response.asset.name,
              status: response.job.status,
            }),
      );
      setName("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (parentDraftId) clearFixMode();
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof ApiClientError
          ? requestError.message
          : t("uploadError"),
      );
    } finally {
      setLoading(false);
    }
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!dragging) setDragging(true);
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
    setDragging(false);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    const dropped = event.dataTransfer.files?.[0] ?? null;
    pickFile(dropped);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const kind = file ? fileKind(file) : null;
  const approvedAccounts = accounts.filter((a) => a.status === "active");
  const accountChoices =
    approvedAccounts.length > 0 ? approvedAccounts : accounts;

  const kindLabel =
    kind === "image"
      ? t("kindImage")
      : kind === "video"
        ? t("kindVideo")
        : kind === "pdf"
          ? t("kindPdf")
          : t("kindFile");

  const flowSteps = parentDraftId
    ? [t("flowFixStep1"), t("flowFixStep2"), t("flowFixStep3"), t("flowFixStep4")]
    : [t("flowStep1"), t("flowStep2"), t("flowStep3"), t("flowStep4")];

  return (
    <section
      id="creative-upload"
      aria-labelledby={`${fieldId}-title`}
      className="min-w-0 scroll-mt-4 overflow-hidden rounded-card border border-line bg-surface shadow-card"
    >
      <div className="border-b border-line px-4 pb-4 pt-4 sm:px-6 sm:pt-5">
        <p className="eyebrow">{parentDraftId ? t("step1Fix") : t("step1")}</p>
        <h2 id={`${fieldId}-title`} className="mt-1 text-base font-semibold leading-6 tracking-[-0.01em] text-ink">
          {parentDraftId ? t("subtitleFix") : t("subtitle")}
        </h2>
        <p className="mt-0.5 max-w-[78ch] text-[13px] text-ink-2">
          {parentDraftId
            ? t("instructionsFix")
            : t.rich("instructions", {
                approved: (chunks) => <span className="font-semibold text-ink">{chunks}</span>,
                clientSuffix: clienteName ? ` · ${clienteName}` : "",
              })}
        </p>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(240px,0.8fr)]">
        <div className="grid content-start gap-4 px-4 py-4 sm:px-6 sm:py-5">
          {!parentDraftId && repeatRejectKind ? (
            <Note tone="warn">{t(repeatRejectKind === "policy" ? "repeatWarnPolicy" : "repeatWarnClaims")}</Note>
          ) : null}

          {parentDraftId ? (
            <Note tone="warn" title={t("fixBannerTitle")}>
              <p className="[overflow-wrap:anywhere]">
                {fixKind === "claims" || fixKind === "policy"
                  ? t("fixBannerHook")
                  : t("fixBannerBody", { name: fixLabel || t("fixBannerFallback") })}
              </p>
              <button
                type="button"
                onClick={clearFixMode}
                className="mt-1.5 text-xs font-semibold underline-offset-[3px] hover:underline"
              >
                {t("fixBannerCancel")}
              </button>
            </Note>
          ) : null}

          <div className="grid gap-1.5">
            <label htmlFor={`${fieldId}-account`} className="text-sm font-medium text-ink">
              {t("accountLabel")}
            </label>
            {accountChoices.length === 0 ? (
              <Note tone="warn">{t("noAccounts")}</Note>
            ) : (
              <Select id={`${fieldId}-account`} value={adAccountId} onChange={(e) => setAdAccountId(e.target.value)}>
                <option value="">{t("chooseApprovedAccount")}</option>
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

          <div className="grid gap-1.5">
            <label htmlFor={`${fieldId}-name`} className="text-sm font-medium text-ink">
              {t("visibleName")}
            </label>
            <Input
              id={`${fieldId}-name`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={
                clienteName ? t("namePlaceholderWithClient", { name: clienteName }) : t("namePlaceholder")
              }
            />
          </div>

          <div className="grid gap-1.5">
            <p className="text-sm font-medium text-ink">{t("file")}</p>

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              tabIndex={-1}
              onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
            />

            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={onDragOver}
              onDragEnter={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={cn(
                "group relative cursor-pointer rounded-box border border-dashed px-4 py-5 transition-colors",
                dragging
                  ? "border-accent bg-accent-soft"
                  : file
                    ? "border-line bg-surface"
                    : "border-line-strong bg-field hover:border-accent-line hover:bg-accent-soft",
              )}
            >
              {file ? (
                <div className="flex items-start gap-3">
                  {previewUrl && (kind === "video" || kind === "image") ? (
                    <div
                      className="h-28 w-[4.6rem] shrink-0 overflow-hidden rounded-box border border-line bg-subtle"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {kind === "video" ? (
                        <video src={previewUrl} className="h-full w-full object-cover" muted playsInline controls />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={previewUrl} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{file.name}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <ToneBadge>{kindLabel}</ToneBadge>
                      <ToneBadge className="num">{formatBytes(file.size)}</ToneBadge>
                    </div>
                    <p className="mt-2 text-xs text-ink-3">{t("changeFile")}</p>
                  </div>
                  <button
                    type="button"
                    className={buttonClass("ghost", "sm", "shrink-0")}
                    onClick={(event) => {
                      event.stopPropagation();
                      pickFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    {t("remove")}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-center">
                  <span aria-hidden className="mb-1.5 grid size-10 place-items-center rounded-box bg-subtle text-ink">
                    <PanelIcon name="upload" className="size-[18px]" />
                  </span>
                  <p className="font-semibold text-ink">{dragging ? t("dropHere") : t("dragOrChoose")}</p>
                  <p className="text-xs text-ink-3">{t("fileHints", { max: MAX_MB })}</p>
                  <span className={buttonClass("outline", "sm", "mt-2.5 pointer-events-none")}>{t("chooseFile")}</span>
                </div>
              )}
            </div>
          </div>

          {error ? <Note tone="danger">{error}</Note> : null}
          {success ? (
            <Note tone="ok" icon="check-circle">
              {success}
            </Note>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleUpload} disabled={loading}>
              <PanelIcon name="upload" />
              {loading ? t("uploading") : parentDraftId ? t("uploadAnalyzeFix") : t("uploadAnalyze")}
            </Button>
            <Button variant="outline" onClick={clearForm} disabled={loading}>
              {t("clear")}
            </Button>
          </div>
        </div>

        <aside className="border-t border-line bg-field px-4 py-4 sm:px-6 sm:py-5 lg:border-l lg:border-t-0">
          <h3 className="text-sm font-semibold text-ink">{parentDraftId ? t("flowTitleFix") : t("flowTitle")}</h3>
          <ol className="mt-3 grid gap-2.5">
            {flowSteps.map((item, index) => (
              <li key={item} className="grid grid-cols-[22px_1fr] items-start gap-2.5 text-[13px] text-ink-2">
                <span
                  aria-hidden
                  className="num grid size-[22px] place-items-center rounded-[6px] bg-subtle text-[11px] font-semibold text-ink"
                >
                  {index + 1}
                </span>
                <span className="pt-0.5">{item}</span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </section>
  );
}
