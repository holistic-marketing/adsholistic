"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import { buttonClass } from "@/components/ui/Button";
import { PageHeader, PanelCard } from "@/components/ui/PageHeader";
import { PanelIcon, type PanelIconName } from "@/components/ui/PanelIcon";
import { Note, SquareIcon } from "@/components/ui/PanelKit";
import { cn } from "@/lib/cn";
import { supportMock } from "@/features/support/mocks/support.mock";
import { supportFaqForPersona } from "@/features/support/lib/support-faq-for-persona";
import type { ChatMessage, SupportView } from "@/features/support/types/support.types";
import type { DashboardPersona } from "@/types/dashboard-persona";
import { ChatConversation } from "@/features/support/components/ChatConversation";
import { ClientMeetingsPanel } from "@/features/support/components/ClientMeetingsPanel.client";
import { ChatFaqCategoryDetail } from "@/features/support/components/ChatFaqCategoryDetail";
import { ChatFaqArticleDetail } from "@/features/support/components/ChatFaqArticleDetail";
import { useSupportThreadPolling } from "@/features/support/hooks/useSupportPolling";
import { supportChatTimestampsNow } from "@/lib/support/chat-time";

interface SupportTicketSummary {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
  updatedAt?: string | null;
}

interface TicketsResponse {
  ok: boolean;
  tickets: SupportTicketSummary[];
}

interface MessagesResponse {
  ok: boolean;
  messages: ChatMessage[];
}

interface CreateTicketResponse {
  ok: boolean;
  ticketId: string;
  message: ChatMessage;
  error?: string;
}

interface PostMessageResponse {
  ok: boolean;
  message: ChatMessage;
  error?: string;
}

type PanelMode =
  | "chat"
  | "meetings"
  | Extract<
      SupportView,
      "faqCategories" | "faqCategoryDetail" | "faqArticleDetail"
    >;

function greetingMessage(supportName: string, text: string): ChatMessage {
  return {
    id: "support-greeting",
    role: "bot",
    text,
    ...supportChatTimestampsNow(),
    senderName: supportName,
    senderKind: "system",
  };
}

function pickActiveTicket(tickets: SupportTicketSummary[]): SupportTicketSummary | null {
  if (tickets.length === 0) return null;
  const openish = tickets.find((t) =>
    ["open", "pending"].includes(String(t.status).toLowerCase()),
  );
  return openish ?? tickets[0] ?? null;
}

function applyHolisticRename(value: string) {
  return value
    .replace(/Default Media/gi, "Ads Holistic")
    .replace(/Default/gi, "Holistic");
}

export function SupportPageClient({
  persona = "cliente",
}: {
  persona?: DashboardPersona;
}) {
  const t = useTranslations("support");
  const tFaq = useTranslations("support.faq");
  const tNav = useTranslations("nav");
  const supportName = t("brandName");
  const greetingText = t("greeting", { name: supportName });

  const faqConfig = useMemo(
    () => supportFaqForPersona(supportMock, persona),
    [persona],
  );

  const holisticFaqCategories = useMemo(
    () =>
      faqConfig.categories.map((category) => {
        const fallback = applyHolisticRename(category.title);
        const known = (
          ["empezar", "dinero", "cuentas", "soporte"] as const
        ).includes(category.id as "empezar");
        return {
          ...category,
          title: known
            ? tFaq(`categories.${category.id as "empezar"}`)
            : fallback,
        };
      }),
    [faqConfig.categories, tFaq],
  );

  const localizedArticles = useMemo(
    () =>
      faqConfig.articles.map((article) => {
        const knownIds = [
          "que-es",
          "menu-cliente",
          "saldo-estimado",
          "como-recargar",
          "como-asignar",
          "fee",
          "ver-cuentas",
          "como-escribir",
          "tiempos",
        ] as const;
        type KnownArticleId = (typeof knownIds)[number];
        const known = (knownIds as readonly string[]).includes(article.id);
        const id = article.id as KnownArticleId;
        return {
          ...article,
          title: known
            ? tFaq(`articles.${id}.title`)
            : applyHolisticRename(article.title),
          content: known
            ? tFaq(`articles.${id}.content`)
            : applyHolisticRename(article.content),
          // Messages cover title/content only — avoid Spanish mock bullets in other locales.
          bullets: known ? [] : article.bullets.map(applyHolisticRename),
        };
      }),
    [faqConfig.articles, tFaq],
  );

  const [panel, setPanel] = useState<PanelMode>("chat");
  const [mobileShowChat, setMobileShowChat] = useState(true);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [faqQuery, setFaqQuery] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    greetingMessage(supportName, greetingText),
  ]);
  const [inputValue, setInputValue] = useState("");
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [ticketStatus, setTicketStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [clearingChat, setClearingChat] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

  const buildGreeting = useCallback(
    () => greetingMessage(supportName, greetingText),
    [greetingText, supportName],
  );

  // El saludo se resuelve al mostrar, con idioma y nombre actuales (sin efecto que reescriba el estado).
  const displayMessages = useMemo(
    () =>
      messages.map((msg) =>
        msg.id === "support-greeting" &&
        (msg.text !== greetingText || msg.senderName !== supportName)
          ? { ...msg, text: greetingText, senderName: supportName }
          : msg,
      ),
    [messages, greetingText, supportName],
  );

  const selectedCategory = holisticFaqCategories.find(
    (c) => c.id === selectedCategoryId,
  );
  const categoryArticles = localizedArticles.filter(
    (a) => a.categoryId === selectedCategoryId,
  );
  const selectedArticle = categoryArticles.find((a) => a.id === selectedArticleId);

  const filteredFaqCategories = useMemo(() => {
    const q = faqQuery.trim().toLowerCase();
    if (!q) return holisticFaqCategories;
    return holisticFaqCategories.filter((category) => {
      const articles = localizedArticles.filter(
        (a) => a.categoryId === category.id,
      );
      return (
        category.title.toLowerCase().includes(q) ||
        articles.some(
          (a) =>
            a.title.toLowerCase().includes(q) ||
            a.content.toLowerCase().includes(q),
        )
      );
    });
  }, [faqQuery, holisticFaqCategories, localizedArticles]);

  const openTicket = useCallback(
    async (ticket: SupportTicketSummary) => {
      setTicketId(ticket.id);
      setTicketStatus(ticket.status);
      setPanel("chat");
      setMobileShowChat(true);
      setLoadingConversation(true);
      setError(null);
      try {
        const messagesData = await apiClient<MessagesResponse>(
          `/api/support/tickets/${ticket.id}/messages`,
        );
        setMessages(
          messagesData.messages.length > 0
            ? messagesData.messages
            : [buildGreeting()],
        );
      } catch (err) {
        setError(
          err instanceof ApiClientError ? err.message : t("loadError"),
        );
        setMessages([buildGreeting()]);
      } finally {
        setLoadingConversation(false);
      }
    },
    [buildGreeting, t],
  );

  const bootChat = useCallback(async () => {
    setLoadingConversation(true);
    setBootError(null);
    try {
      const data = await apiClient<TicketsResponse>("/api/support/tickets");
      const active = pickActiveTicket(data.tickets ?? []);
      if (active) {
        await openTicket(active);
        return;
      }
      setTicketId(null);
      setTicketStatus(null);
      setMessages([buildGreeting()]);
    } catch (err) {
      setBootError(
        err instanceof ApiClientError ? err.message : t("openError"),
      );
      setMessages([buildGreeting()]);
    } finally {
      setLoadingConversation(false);
    }
  }, [buildGreeting, openTicket, t]);

  useEffect(() => {
    // Cargador intencional (carga inicial del chat de soporte): activa loading/limpia error y luego hace fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional lifecycle loader
    void bootChat();
  }, [bootChat]);

  const fetchLiveMessages = useCallback(async (): Promise<ChatMessage[] | null> => {
    if (!ticketId) return null;
    const messagesData = await apiClient<MessagesResponse>(
      `/api/support/tickets/${ticketId}/messages`,
    );
    return messagesData.messages ?? [];
  }, [ticketId]);

  useSupportThreadPolling({
    enabled:
      Boolean(ticketId) && !sending && !loadingConversation && !clearingChat,
    intervalMs: 2000,
    fetchMessages: fetchLiveMessages,
    onMessages: setMessages,
  });

  async function handleClearChat() {
    if (!ticketId || clearingChat) return;
    setClearingChat(true);
    setError(null);
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}/messages`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? t("clearError"));
      }
      setMessages([buildGreeting()]);
      setTicketStatus("open");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("clearError"));
    } finally {
      setClearingChat(false);
    }
  }

  async function handleSend(files: File[] = []) {
    const text = inputValue.trim();
    if ((!text && files.length === 0) || sending) return;

    setSending(true);
    setError(null);
    setInputValue("");

    const optimistic: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: text || (files.length ? `📎 ${t("attachment")}` : ""),
      ...supportChatTimestampsNow(),
      attachments: files
        .filter((f) => f.type.startsWith("image/"))
        .map((file, index) => ({
          name: file.name,
          mimeType: file.type,
          path: `local-${index}`,
          bucket: "local",
          size: file.size,
          url: URL.createObjectURL(file),
        })),
    };
    setMessages((prev) => [
      ...prev.filter((msg) => msg.id !== "support-greeting"),
      optimistic,
    ]);

    try {
      const formData = new FormData();
      if (text) formData.set("message", text);
      for (const file of files) formData.append("files", file);

      if (!ticketId) {
        const res = await fetch("/api/support/tickets", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        const data = (await res.json()) as CreateTicketResponse;
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? t("sendError"));
        }
        setTicketId(data.ticketId);
        setTicketStatus("open");
        setMessages((prev) =>
          prev.map((msg) => (msg.id === optimistic.id ? data.message : msg)),
        );
      } else {
        const res = await fetch(`/api/support/tickets/${ticketId}/messages`, {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        const data = (await res.json()) as PostMessageResponse;
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? t("sendError"));
        }
        setTicketStatus("open");
        setMessages((prev) =>
          prev.map((msg) => (msg.id === optimistic.id ? data.message : msg)),
        );
      }
    } catch (err) {
      setMessages((prev) => prev.filter((msg) => msg.id !== optimistic.id));
      setInputValue(text);
      setError(err instanceof Error ? err.message : t("sendError"));
    } finally {
      setSending(false);
    }
  }

  function renderFaqPanel() {
    switch (panel) {
      case "faqCategories":
        return (
          <PanelCard
            title={t("faqTitle")}
            description={t("faqSubtitle")}
            action={
              <button
                type="button"
                onClick={() => {
                  setPanel("chat");
                  setMobileShowChat(true);
                }}
                className={buttonClass("ghost", "sm")}
              >
                {t("backToChat")}
              </button>
            }
          >
            <label className="panel-search">
              <span className="sr-only">{t("searchFaq")}</span>
              <PanelIcon name="search" />
              <input
                type="search"
                value={faqQuery}
                onChange={(e) => setFaqQuery(e.target.value)}
                placeholder={t("searchFaq")}
                autoComplete="off"
              />
            </label>
            <ul className="mt-2 overflow-hidden rounded-box border border-line">
              {filteredFaqCategories.map((category) => (
                <li key={category.id} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategoryId(category.id);
                      setPanel("faqCategoryDetail");
                    }}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left font-medium text-ink hover:bg-hover"
                  >
                    <span>{category.title}</span>
                    <PanelIcon name="chevron-right" className="text-ink-3" />
                  </button>
                </li>
              ))}
              {filteredFaqCategories.length === 0 ? (
                <li className="px-3 py-6 text-center text-[13px] text-ink-2">
                  {t("noFaqResults", { q: faqQuery })}
                </li>
              ) : null}
            </ul>
          </PanelCard>
        );
      case "faqCategoryDetail":
        return selectedCategory ? (
          <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
            <ChatFaqCategoryDetail
              categoryTitle={selectedCategory.title}
              articles={categoryArticles}
              onSelectArticle={(id) => {
                setSelectedArticleId(id);
                setPanel("faqArticleDetail");
              }}
              onBack={() => setPanel("faqCategories")}
            />
          </div>
        ) : null;
      case "faqArticleDetail":
        return selectedArticle ? (
          <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
            <ChatFaqArticleDetail
              article={selectedArticle}
              onBack={() => setPanel("faqCategoryDetail")}
            />
          </div>
        ) : null;
      default:
        return null;
    }
  }

  const faqMode =
    panel === "faqCategories" ||
    panel === "faqCategoryDetail" ||
    panel === "faqArticleDetail";
  const meetingsMode = panel === "meetings";

  const leftColumn = (
    <div className="grid gap-4">
      <PanelCard>
        <p className="eyebrow">{t("chats")}</p>
        <h2 className="mt-0.5 text-base font-semibold tracking-[-0.01em] text-ink">{t("conversation")}</h2>

        {bootError ? (
          <Note tone="danger" className="mt-3">
            {bootError}
          </Note>
        ) : null}

        <nav className="mt-3 grid gap-2" aria-label={t("conversation")}>
          <SupportOption
            active={panel === "chat"}
            icon="chat"
            title={supportName}
            hint={t("teamHint")}
            onClick={() => {
              setPanel("chat");
              setMobileShowChat(true);
            }}
          />
          <SupportOption
            active={meetingsMode}
            icon="calendar"
            title={t("meetings.nav")}
            hint={t("meetings.navHint")}
            onClick={() => {
              setPanel("meetings");
              setMobileShowChat(false);
            }}
          />
          <SupportOption
            active={faqMode}
            icon="info"
            title={t("faqTitle")}
            hint={t("faqGuides")}
            onClick={() => {
              setFaqQuery("");
              setPanel("faqCategories");
              setMobileShowChat(false);
            }}
          />
        </nav>
      </PanelCard>

      {faqMode ? renderFaqPanel() : null}
    </div>
  );

  const chatColumn = (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <ChatConversation
        appearance="panel"
        messages={displayMessages}
        inputValue={inputValue}
        sending={sending}
        loading={loadingConversation}
        error={error}
        showBack={mobileShowChat && faqMode === false}
        className="h-[min(760px,calc(100dvh-11rem))] min-h-[560px]"
        title={supportName}
        subtitle={t("chatSubtitle")}
        onInputChange={setInputValue}
        onSend={(files) => void handleSend(files)}
        onClearChat={ticketId ? () => void handleClearChat() : undefined}
        clearingChat={clearingChat}
        onBack={() => setMobileShowChat(false)}
      />
    </div>
  );

  return (
    <div>
      <PageHeader eyebrow={tNav("support")} title={supportName} lede={t("pageSubtitle")} />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
        <div className={cn(((mobileShowChat && !faqMode) || meetingsMode) && "hidden lg:block")}>
          {leftColumn}
        </div>
        <div
          className={cn(
            "min-w-0",
            !meetingsMode && (!mobileShowChat || faqMode) && "hidden lg:block",
          )}
        >
          {meetingsMode ? (
            <ClientMeetingsPanel
              onBack={() => {
                setPanel("chat");
                setMobileShowChat(false);
              }}
            />
          ) : (
            chatColumn
          )}
        </div>
      </div>
    </div>
  );
}

/** Opción del menú de soporte (v3 «opt»): marcada con borde y fondo naranja suave. */
function SupportOption({
  active,
  icon,
  title,
  hint,
  onClick,
}: {
  active: boolean;
  icon: PanelIconName;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex w-full items-center gap-3 rounded-box border px-3 py-2.5 text-left transition-colors",
        active
          ? "border-accent bg-accent-soft shadow-[0_0_0_1px_var(--ui-accent)]"
          : "border-line bg-surface hover:border-line-strong",
      )}
    >
      <SquareIcon icon={icon} tone={active ? "accent" : undefined} />
      <span className="grid min-w-0 flex-1 leading-snug">
        <b className="truncate font-semibold text-ink">{title}</b>
        <small className="truncate text-xs text-ink-3">{hint}</small>
      </span>
    </button>
  );
}
