"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import type { ChatMessage } from "../types/support.types";
import { formatSupportChatTimestamp } from "@/lib/support/chat-time";
import { buildChatTimeline } from "@/features/support/lib/chat-message-timeline";
import { buttonClass } from "@/components/ui/Button";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { EmptyState } from "@/components/ui/PanelKit";
import { cn } from "@/lib/cn";
import { HecomClienteAvatar } from "@/features/clientes/components/HecomClienteAvatar.client";

interface PendingFile {
  id: string;
  file: File;
  previewUrl: string | null;
}

/** `panel`: sistema visual v3 (páginas de soporte del panel).
    `widget`: el chat flotante, con su cabecera oscura (sus botones de cabecera son claros). */
type ChatAppearance = "panel" | "widget";

interface ChatConversationProps {
  messages: ChatMessage[];
  inputValue: string;
  sending?: boolean;
  loading?: boolean;
  error?: string | null;
  showBack?: boolean;
  className?: string;
  title?: string;
  subtitle?: string;
  /** URL de foto (Hecom) para el header. */
  avatarUrl?: string | null;
  headerActions?: ReactNode;
  /** Borra todo el hilo (pide confirmación en el botón). */
  onClearChat?: () => void;
  clearingChat?: boolean;
  onInputChange: (value: string) => void;
  onSend: (files: File[]) => void;
  onBack: () => void;
  composerDisabled?: boolean;
  composerDisabledReason?: string;
  /** Texto cuando no hay mensajes (además del estado de carga). */
  emptyHint?: string;
  appearance?: ChatAppearance;
}

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,application/pdf";

/* Clases por apariencia. La del widget es la de siempre: el componente flotante
   (components/floating) le pasa botones pensados para una cabecera oscura. */
const LOOK = {
  panel: {
    root: "bg-field text-ink",
    head: "flex min-h-[60px] items-center gap-3 border-b border-line bg-surface px-4 py-2.5 sm:px-5",
    back: "inline-grid size-8 shrink-0 place-items-center rounded-ctl text-ink hover:bg-hover lg:hidden",
    avatar: "",
    title: "truncate font-semibold text-ink",
    subtitle: "mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-ink-3",
    clear: buttonClass("outline", "sm"),
    log: "relative min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-4 sm:p-5",
    drop: "pointer-events-none absolute inset-3 z-10 flex items-center justify-center rounded-card border-2 border-dashed border-accent bg-surface/90 text-sm font-semibold text-accent-text",
    loading: "rounded-box border border-line bg-surface px-4 py-3 text-sm text-ink-2",
    day: "rounded-full border border-line bg-surface px-3 py-0.5 text-[11px] font-medium text-ink-3",
    error: "rounded-box border border-danger-line bg-danger-bg px-3 py-2 text-[13px] text-danger-fg",
    form: "border-t border-line bg-surface px-4 py-3 sm:px-5",
    disabled: "mb-3 rounded-box border border-warn-line bg-warn-bg px-3 py-2 text-[13px] text-warn-fg",
    pending: "relative overflow-hidden rounded-box border border-line bg-subtle",
    pendingName: "text-ink-2",
    remove: "absolute right-1 top-1 grid size-5 place-items-center rounded-[5px] bg-ink/70 text-[10px] text-surface",
    box: "rounded-box border border-line bg-field shadow-ctl transition focus-within:border-accent focus-within:bg-surface focus-within:ring-[3px] focus-within:ring-[var(--ui-ring)]",
    textarea: "max-h-40 min-h-[44px] w-full resize-none bg-transparent px-3 py-2 text-sm leading-5 text-ink placeholder:text-ink-3 focus:outline-none disabled:opacity-60",
    attach: "inline-grid size-8 shrink-0 place-items-center rounded-ctl text-ink-2 transition-colors hover:bg-hover hover:text-ink disabled:opacity-50",
    hint: "hidden text-[11px] text-ink-3 sm:inline",
    send: buttonClass("primary", "sm"),
  },
  widget: {
    root: "bg-surface text-[var(--auth-text)]",
    head: "flex min-h-[68px] items-center gap-3 border-b border-white/10 bg-[linear-gradient(135deg,#21150f_0%,#382117_70%,#612b18_140%)] px-3.5 py-3 shadow-sm sm:px-5",
    back: "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/80 hover:bg-surface/10 hover:text-white lg:hidden",
    avatar: "h-11 w-11 text-[12px] shadow-md ring-2 ring-white/20",
    title: "truncate text-[15px] font-bold tracking-[-0.01em] text-white",
    subtitle: "mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-white/70",
    clear: "rounded-md border border-white/20 bg-surface/10 px-2.5 py-1 text-[11px] font-semibold text-white/90 hover:bg-surface/15 disabled:opacity-50",
    log: "relative min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-subtle p-3 sm:p-5",
    drop: "pointer-events-none absolute inset-3 z-10 flex items-center justify-center rounded-card border-2 border-dashed border-[var(--brand-primary)] bg-surface/90 text-sm font-semibold text-[var(--brand-primary-deep)]",
    loading: "rounded-card bg-surface px-4 py-3 text-sm text-ink-2 shadow-sm ring-1 ring-[var(--border-subtle)]",
    day: "rounded-full bg-surface/90 px-3 py-1 text-[11px] font-semibold text-ink-2 shadow-sm ring-1 ring-black/5",
    error: "rounded-card border border-danger-line bg-danger-bg px-3 py-2 text-xs text-danger-fg",
    form: "border-t border-[var(--auth-divider)] bg-surface p-3 shadow-[0_-8px_24px_rgb(15_23_42_/_0.04)] sm:px-5 sm:py-4",
    disabled: "mb-3 rounded-box border border-warn-line bg-warn-bg px-3 py-2 text-[12px] font-medium text-warn-fg",
    pending: "relative overflow-hidden rounded-box border border-[var(--auth-input-border)] bg-[var(--surface-soft)]",
    pendingName: "text-[var(--auth-text-muted)]",
    remove: "absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[10px] text-white",
    box: "rounded-card border border-[var(--auth-input-border)] bg-field p-2 shadow-sm transition focus-within:border-[var(--auth-accent)]/70 focus-within:bg-surface focus-within:ring-4 focus-within:ring-[var(--auth-accent)]/10",
    textarea: "max-h-40 min-h-[48px] w-full resize-none bg-transparent px-3 py-2 text-[14px] leading-5 text-[var(--auth-text)] placeholder:text-[var(--auth-text-soft)] focus:outline-none disabled:opacity-60",
    attach: "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--auth-text-muted)] transition-colors hover:bg-surface hover:text-[var(--auth-text)] disabled:opacity-50",
    hint: "hidden text-[11px] text-[var(--auth-text-soft)] sm:inline",
    send: "inline-flex h-10 min-w-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-[var(--brand-primary)] px-4 text-[13px] font-bold text-white shadow-md shadow-orange-500/20 hover:bg-[var(--brand-primary-deep)] disabled:opacity-50",
  },
} satisfies Record<ChatAppearance, Record<string, string>>;

function isAllowedFile(file: File) {
  return (
    !file.type ||
    ACCEPT.split(",").includes(file.type) ||
    file.type.startsWith("image/") ||
    file.type === "application/pdf"
  );
}

export function ChatConversation({
  messages,
  inputValue,
  sending = false,
  loading = false,
  error = null,
  showBack = true,
  className,
  title,
  subtitle,
  avatarUrl = null,
  headerActions,
  onClearChat,
  clearingChat = false,
  onInputChange,
  onSend,
  onBack,
  composerDisabled = false,
  composerDisabledReason,
  emptyHint,
  appearance = "widget",
}: ChatConversationProps) {
  const t = useTranslations("support");
  const look = LOOK[appearance];
  const panel = appearance === "panel";
  const resolvedTitle = title ?? t("writeUs");
  const resolvedSubtitle = subtitle ?? t("ticketSaved");
  const resolvedEmptyHint = emptyHint ?? t("emptyHint");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const pendingFiles = useMemo(() => pending.map((item) => item.file), [pending]);
  const lastMessageId = messages[messages.length - 1]?.id;
  const timeline = useMemo(() => buildChatTimeline(messages), [messages]);

  useEffect(() => {
    return () => {
      pending.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup on unmount only
  }, []);

  // Live chat: bajar al último mensaje cuando llega uno nuevo (sin F5).
  useEffect(() => {
    if (loading) return;
    const end = messagesEndRef.current;
    const scroller = messagesScrollRef.current;
    if (!end || !scroller) return;
    end.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lastMessageId, messages.length, loading]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [inputValue]);

  function addFiles(list: FileList | File[]) {
    const next = Array.from(list).filter(isAllowedFile).slice(0, 5);
    if (next.length === 0) return;
    setPending((prev) => {
      const room = Math.max(0, 5 - prev.length);
      const toAdd = next.slice(0, room).map((file) => ({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        file,
        previewUrl: file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : null,
      }));
      return [...prev, ...toAdd];
    });
  }

  function removePending(id: string) {
    setPending((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  }

  function clearPending() {
    setPending((prev) => {
      prev.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      return [];
    });
  }

  function handleSend() {
    if (sending || composerDisabled) return;
    if (!inputValue.trim() && pendingFiles.length === 0) return;
    onSend(pendingFiles);
    clearPending();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const item of Array.from(items)) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      addFiles(files);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) addFiles(e.target.files);
    e.target.value = "";
  }

  return (
    <div
      className={cn("flex flex-col", look.root, className)}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <div className={look.head}>
        {showBack ? (
          <button type="button" onClick={onBack} className={look.back} aria-label={t("back")}>
            {panel ? (
              <PanelIcon name="chevron-left" />
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            )}
          </button>
        ) : null}
        <HecomClienteAvatar
          name={resolvedTitle}
          avatarUrl={avatarUrl}
          size="sm"
          className={look.avatar || undefined}
        />
        <div className="min-w-0 flex-1">
          <p className={look.title}>{resolvedTitle}</p>
          <p className={look.subtitle}><span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-ok-solid" /><span className="truncate">{resolvedSubtitle}</span></p>
        </div>
        {onClearChat || headerActions ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            {onClearChat ? (
              <button
                type="button"
                disabled={clearingChat || sending || loading}
                onClick={() => {
                  if (!window.confirm(t("clearConfirm"))) {
                    return;
                  }
                  onClearChat();
                }}
                className={look.clear}
              >
                {clearingChat ? t("clearingChat") : t("clearChat")}
              </button>
            ) : null}
            {headerActions}
          </div>
        ) : null}
      </div>

      <div
        ref={messagesScrollRef}
        className={look.log}
        role={panel ? "log" : undefined}
        aria-label={panel ? resolvedTitle : undefined}
      >
        {dragOver ? <div className={look.drop}>{t("dropFiles")}</div> : null}

        {loading ? (
          <p className={look.loading}>{t("loading")}</p>
        ) : messages.length === 0 ? (
          panel ? (
            <EmptyState icon="chat" title={t("noMessages")} description={resolvedEmptyHint} />
          ) : (
            <div className="flex flex-col items-center rounded-card bg-surface px-6 py-10 text-center shadow-sm ring-1 ring-[var(--border-subtle)]">
              <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-card bg-subtle text-xl">
                💬
              </span>
              <p className="mt-3 text-sm font-semibold text-ink">{t("noMessages")}</p>
              <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-ink-2">{resolvedEmptyHint}</p>
            </div>
          )
        ) : (
          timeline.map((item) => {
            if (item.kind === "day") {
              return (
                <div key={item.key} className="flex justify-center py-1">
                  <span className={look.day}>{item.label}</span>
                </div>
              );
            }
            return panel ? (
              <PanelBubble key={item.message.id} message={item.message} />
            ) : (
              <WidgetBubble key={item.message.id} message={item.message} />
            );
          })
        )}
        <div ref={messagesEndRef} className="h-px w-full shrink-0" aria-hidden />
        {error ? <p className={look.error}>{error}</p> : null}
      </div>

      <div className={look.form}>
        {composerDisabled ? (
          <p className={look.disabled}>{composerDisabledReason ?? t("composerDisabled")}</p>
        ) : null}
        {pending.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {pending.map((item) => (
              <div key={item.id} className={look.pending}>
                {item.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.previewUrl} alt={item.file.name} className="h-16 w-16 object-cover" />
                ) : (
                  <div className={cn("flex h-16 w-28 items-center overflow-hidden break-all px-2 pr-6 text-[11px] font-medium leading-tight", look.pendingName)}>
                    <span className="line-clamp-3">{item.file.name}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removePending(item.id)}
                  className={look.remove}
                  aria-label={t("removeFile")}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className={look.box}>
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            rows={2}
            disabled={composerDisabled}
            placeholder={t("placeholder")}
            aria-label={t("writeUs")}
            className={look.textarea}
          />
          <div className={cn("flex items-center justify-between gap-2", panel ? "px-1.5 pb-1.5" : "px-1 pb-1")}>
            <div className="flex items-center gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT}
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                type="button"
                disabled={sending || composerDisabled}
                onClick={() => fileInputRef.current?.click()}
                className={look.attach}
                aria-label={t("attachFile")}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                </svg>
                <span className="sr-only">{t("attach")}</span>
              </button>
              <span className={look.hint}>{t("enterHint")}</span>
            </div>
            <button
              type="button"
              onClick={handleSend}
              disabled={
                composerDisabled ||
                sending ||
                (!inputValue.trim() && pendingFiles.length === 0)
              }
              className={look.send}
            >
              {panel && !sending ? <PanelIcon name="send" /> : null}
              {sending ? t("sending") : t("send")}
              {!panel && !sending ? (
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              ) : null}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageAttachments({ message, linkClass }: { message: ChatMessage; linkClass: string }) {
  if (!message.attachments || message.attachments.length === 0) return null;
  return (
    <div className="mt-2 space-y-2">
      {message.attachments.map((attachment) => {
        const isImage = attachment.mimeType.startsWith("image/");
        if (isImage && attachment.url) {
          return (
            <a
              key={`${message.id}-${attachment.path}`}
              href={attachment.url}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-box"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={attachment.url} alt={attachment.name} className="max-h-56 w-full object-cover" />
            </a>
          );
        }
        return (
          <a
            key={`${message.id}-${attachment.path}`}
            href={attachment.url ?? undefined}
            target="_blank"
            rel="noreferrer"
            className={cn("inline-flex max-w-full items-center gap-2 break-all rounded-lg px-2.5 py-1.5 text-xs font-semibold", linkClass)}
          >
            📎 {attachment.name}
          </a>
        );
      })}
    </div>
  );
}

/** Mensaje v3 (`.msg`): los tuyos a la derecha, en naranja suave. */
function PanelBubble({ message }: { message: ChatMessage }) {
  const mine = message.role === "user";
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "min-w-0 max-w-[min(72%,32.5rem)] rounded-box border px-3 py-2 text-sm text-ink",
          mine ? "border-accent-line bg-accent-soft" : "border-line bg-surface",
        )}
      >
        {message.text ? <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{message.text}</p> : null}
        <MessageAttachments message={message} linkClass="bg-subtle text-ink" />
        {message.senderName ? (
          <p className={cn("mt-1 text-[11px] font-semibold", mine ? "text-ink-2" : "text-accent-text")}>{message.senderName}</p>
        ) : null}
        <p className="mt-0.5 font-mono text-[11px] text-ink-3">
          {message.createdAt ? formatSupportChatTimestamp(message.createdAt) : message.timestamp}
        </p>
      </div>
    </div>
  );
}

function WidgetBubble({ message }: { message: ChatMessage }) {
  return (
    <div
      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`min-w-0 max-w-[min(88%,32rem)] px-3.5 py-2.5 text-sm shadow-sm ${
          message.role === "user"
            ? "rounded-[18px_18px_5px_18px] bg-[linear-gradient(135deg,var(--brand-primary),#e85a1a)] text-white"
            : "rounded-[18px_18px_18px_5px] bg-surface text-ink ring-1 ring-black/5"
        }`}
      >
        {message.text ? <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{message.text}</p> : null}
        <MessageAttachments
          message={message}
          linkClass={message.role === "user" ? "bg-surface/15 text-white" : "bg-[var(--surface-soft)] text-[var(--auth-text)]"}
        />
        {message.senderName ? (
          <p
            className={`mt-1.5 text-[10px] font-semibold ${
              message.role === "user"
                ? "text-white/85"
                : "text-accent-text"
            }`}
          >
            {message.senderName}
          </p>
        ) : null}
        <p
          className={`mt-1 text-[10px] ${
            message.role === "user" ? "text-white/70" : "text-ink-3"
          }`}
        >
          {message.createdAt
            ? formatSupportChatTimestamp(message.createdAt)
            : message.timestamp}
        </p>
      </div>
    </div>
  );
}
