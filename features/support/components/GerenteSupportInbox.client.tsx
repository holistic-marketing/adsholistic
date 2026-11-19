"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { EmptyState, Note, Segmented, ToneBadge } from "@/components/ui/PanelKit";
import { PanelMenu, PanelPopover, usePopover } from "@/components/ui/PanelPopover.client";
import { cn } from "@/lib/cn";
import type { ChatMessage } from "@/features/support/types/support.types";
import { ChatConversation } from "@/features/support/components/ChatConversation";
import { StaffMeetingsBoard } from "@/features/support/components/StaffMeetingsBoard.client";
import { HecomClienteAvatar } from "@/features/clientes/components/HecomClienteAvatar.client";
import {
  useSupportListPolling,
  useSupportThreadPolling,
} from "@/features/support/hooks/useSupportPolling";
import {
  formatInboxListTime,
  supportChatTimestampsNow,
} from "@/lib/support/chat-time";
import { playSupportNotifySound } from "@/lib/support/notify-sound.client";

interface InboxTicket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  category: string | null;
  createdAt: string;
  updatedAt: string | null;
  organizationId?: string | null;
  organizationName: string | null;
  requesterEmail: string | null;
  requesterName: string | null;
  requesterDisplayName: string;
  assignedUserId: string | null;
  assignedUserName: string | null;
  assignedUserEmail: string | null;
  assignedUserDisplayName: string | null;
  hasTicket?: boolean;
  hecomClienteId?: string | null;
  hasHolisticAccount?: boolean;
  avatarUrl?: string | null;
  lastMessagePreview?: string | null;
  lastMessageAt?: string | null;
  lastMessageFromClient?: boolean;
  lastMessageSenderUserId?: string | null;
  requesterUserId?: string | null;
  staffReadAt?: string | null;
  unreadForStaff?: boolean;
}

function clientLabel(ticket: InboxTicket) {
  return (
    ticket.requesterDisplayName ||
    ticket.requesterName ||
    ticket.organizationName ||
    "Cliente"
  );
}

function emptyThread(): ChatMessage[] {
  return [
    {
      id: "inbox-empty",
      role: "bot",
      text: "Elige un cliente a la izquierda para atender.",
      ...supportChatTimestampsNow(),
      senderName: "Sistema",
      senderKind: "system",
    },
  ];
}

const FILTERS = [
  { id: "chats", label: "Chats" },
  { id: "all", label: "Contactos" },
] as const;

export function GerenteSupportInbox() {
  const [tickets, setTickets] = useState<InboxTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // "all" = lista completa Hecom Club (default). "unassigned" oculta clientes sin ticket abierto.
  const [statusFilter, setStatusFilter] = useState("chats");
  const [q, setQ] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(emptyThread());
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [clearingChat, setClearingChat] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [workspace, setWorkspace] = useState<"chats" | "meetings">("chats");
  const [pendingMeetings, setPendingMeetings] = useState(0);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(() => new Set());
  const knownUpdatedAtRef = useRef<Map<string, string>>(new Map());
  const selectedMetaRef = useRef<{
    id: string;
    hecomClienteId?: string | null;
  } | null>(null);

  const selected = tickets.find((t) => t.id === selectedId) ?? null;
  const hasRealTicket = Boolean(
    selected?.hasTicket !== false &&
      selected &&
      !selected.id.startsWith("org:") &&
      !selected.id.startsWith("hecom:"),
  );
  const selectedClientName = selected ? clientLabel(selected) : null;

  useEffect(() => {
    selectedMetaRef.current = selected
      ? { id: selected.id, hecomClienteId: selected.hecomClienteId }
      : null;
  }, [selected]);

  useEffect(() => {
  const n = unreadIds.size;
    const base = "Chats";
    document.title = n > 0 ? `(${n}) ${base}` : base;
    return () => {
      document.title = base;
    };
  }, [unreadIds]);

  useEffect(() => {
    let cancelled = false;
    let known: number | null = null;
    async function tick() {
      try {
        const res = await fetch("/api/support/meetings?scope=counts", {
          credentials: "include",
          cache: "no-store",
        });
        const data = (await res.json()) as { counts?: { pending?: number } };
        const pending = data.counts?.pending ?? 0;
        if (cancelled) return;
        if (known !== null && pending > known) playSupportNotifySound();
        known = pending;
        setPendingMeetings(pending);
      } catch {
        if (!cancelled && known === null) setPendingMeetings(0);
      }
    }
    void tick();
    const timer = window.setInterval(() => void tick(), 20000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [workspace]);

  const filteredTickets = tickets.filter((ticket) => {
    const query = q.trim().toLowerCase();
    if (!query) return true;
    return [
      ticket.requesterDisplayName,
      ticket.requesterName,
      ticket.organizationName,
      ticket.subject,
      ticket.lastMessagePreview,
      ticket.requesterEmail,
      ticket.assignedUserDisplayName,
      ticket.assignedUserName,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const loadTickets = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const params = new URLSearchParams({ status: statusFilter });
      const res = await fetch(`/api/support/inbox?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        tickets?: InboxTicket[];
        me?: { id: string; email: string };
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "No se pudo cargar el inbox.");
      }
      const nextTickets = data.tickets ?? [];
      setTickets(nextTickets);

      const meta = selectedMetaRef.current;
      const selectedNow = meta?.id ?? null;

      // Leído es del equipo: solo queda pendiente si el cliente escribió
      // después de que algún gerente abrió el chat.
      setUnreadIds((prev) => {
        const next = new Set<string>();
        for (const ticket of nextTickets) {
          if (ticket.unreadForStaff && ticket.id !== selectedNow) {
            next.add(ticket.id);
          }
          const stamp =
            ticket.lastMessageAt ?? ticket.updatedAt ?? ticket.createdAt;
          knownUpdatedAtRef.current.set(ticket.id, stamp);
        }
        if (opts?.silent) {
          let added = false;
          for (const id of next) {
            if (!prev.has(id)) added = true;
          }
          if (added) playSupportNotifySound();
        }
        return next;
      });

      // Si estaba en contacto Hecom sin ticket y el cliente escribió → abrir hilo real.
      if (
        meta &&
        (meta.id.startsWith("hecom:") || meta.id.startsWith("org:")) &&
        meta.hecomClienteId
      ) {
        const real = nextTickets.find(
          (t) =>
            t.hecomClienteId === meta.hecomClienteId &&
            t.hasTicket !== false &&
            !t.id.startsWith("hecom:") &&
            !t.id.startsWith("org:"),
        );
        if (real) {
          setSelectedId(real.id);
          setUnreadIds((prev) => {
            const next = new Set(prev);
            next.delete(real.id);
            return next;
          });
          knownUpdatedAtRef.current.set(
            real.id,
            real.updatedAt ?? real.createdAt,
          );
          try {
            const msgRes = await fetch(
              `/api/support/inbox/${real.id}/messages`,
              { credentials: "include", cache: "no-store" },
            );
            const msgData = (await msgRes.json()) as {
              ok?: boolean;
              messages?: ChatMessage[];
            };
            if (msgRes.ok && msgData.ok && msgData.messages?.length) {
              setMessages(msgData.messages);
            }
          } catch {
            // el poll del hilo reintenta
          }
        }
      }
    } catch (err) {
      if (!opts?.silent) {
        setError(err instanceof Error ? err.message : "Error al cargar inbox.");
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    // Cargador intencional (carga del inbox al montar y al cambiar el filtro): activa loading/limpia error y luego hace fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional lifecycle loader
    void loadTickets();
  }, [loadTickets]);

  const refreshTicketsSilent = useCallback(async () => {
    await loadTickets({ silent: true });
  }, [loadTickets]);

  useSupportListPolling({
    enabled: true,
    intervalMs: 3000,
    refresh: refreshTicketsSilent,
  });

  const fetchLiveMessages = useCallback(async (): Promise<ChatMessage[] | null> => {
    if (
      !selectedId ||
      selectedId.startsWith("org:") ||
      selectedId.startsWith("hecom:")
    ) {
      return null;
    }
    const res = await fetch(`/api/support/inbox/${selectedId}/messages`, {
      credentials: "include",
      cache: "no-store",
    });
    const data = (await res.json()) as {
      ok?: boolean;
      messages?: ChatMessage[];
    };
    if (!res.ok || !data.ok) return null;
    return data.messages ?? [];
  }, [selectedId]);

  useSupportThreadPolling({
    enabled:
      Boolean(selectedId) &&
      !selectedId?.startsWith("org:") &&
      !selectedId?.startsWith("hecom:") &&
      !sending &&
      !clearingChat &&
      !loadingThread,
    intervalMs: 2000,
    fetchMessages: fetchLiveMessages,
    onMessages: setMessages,
  });

  async function handleClearChat() {
    if (
      !selectedId ||
      selectedId.startsWith("org:") ||
      selectedId.startsWith("hecom:") ||
      clearingChat
    ) {
      return;
    }
    setClearingChat(true);
    setThreadError(null);
    try {
      const res = await fetch(`/api/support/inbox/${selectedId}/messages`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "No se pudo borrar el chat.");
      }
      setMessages([
        {
          id: "empty",
          role: "bot",
          text: "Chat borrado. Escribe para empezar de nuevo.",
          ...supportChatTimestampsNow(),
          senderName: "Sistema",
          senderKind: "system",
        },
      ]);
      await loadTickets({ silent: true });
    } catch (err) {
      setThreadError(
        err instanceof Error ? err.message : "No se pudo borrar el chat.",
      );
    } finally {
      setClearingChat(false);
    }
  }

  async function ensureTicketId(contact: InboxTicket): Promise<string> {
    if (
      contact.hasTicket !== false &&
      !contact.id.startsWith("org:") &&
      !contact.id.startsWith("hecom:")
    ) {
      return contact.id;
    }
    if (!contact.hecomClienteId) {
      throw new Error("Cliente Hecom no identificado.");
    }
    if (contact.hasHolisticAccount === false) {
      throw new Error(
        "Este cliente aún no tiene cuenta en Ads Holistic. Cuando entre con su correo verá Soporte Holistic.",
      );
    }
    const res = await fetch("/api/support/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        action: "ensure",
        hecomClienteId: contact.hecomClienteId,
      }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      ticket?: InboxTicket;
      error?: string;
    };
    if (!res.ok || !data.ok || !data.ticket) {
      throw new Error(data.error ?? "No se pudo abrir el chat.");
    }
    setTickets((prev) => {
      const withoutSynthetic = prev.filter(
        (t) => t.id !== contact.id && t.id !== data.ticket!.id,
      );
      return [data.ticket!, ...withoutSynthetic];
    });
    setSelectedId(data.ticket.id);
    return data.ticket.id;
  }

  async function openTicket(id: string) {
    setSelectedId(id);
    setMobileShowChat(true);
    setLoadingThread(true);
    setThreadError(null);
    setUnreadIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

    if (id.startsWith("org:") || id.startsWith("hecom:")) {
      const contact = tickets.find((t) => t.id === id);
      const noAccount = contact?.hasHolisticAccount === false;
      setMessages([
        {
          id: "no-thread",
          role: "bot",
          text: noAccount
            ? "Este cliente de Hecom aún no tiene cuenta en Ads Holistic. Cuando entre con su correo, verá Soporte Holistic acá."
            : "Todavía no hay mensajes. Escribe para iniciar; le llega a su Soporte Holistic.",
          ...supportChatTimestampsNow(),
          senderName: "Sistema",
          senderKind: "system",
        },
      ]);
      setLoadingThread(false);
      return;
    }

    try {
      const res = await fetch(`/api/support/inbox/${id}/messages`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        messages?: ChatMessage[];
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "No se pudo cargar el hilo.");
      }
      setMessages(
        data.messages && data.messages.length > 0
          ? data.messages
          : [
              {
                id: "empty",
                role: "bot",
                text: "Sin mensajes todavía. Escribe para responder.",
                ...supportChatTimestampsNow(),
                senderName: "Sistema",
              },
            ],
      );
    } catch (err) {
      setThreadError(err instanceof Error ? err.message : "Error al cargar.");
      setMessages(emptyThread());
    } finally {
      setLoadingThread(false);
    }
  }

  async function handleSend(files: File[] = []) {
    if (!selected) return;
    const text = inputValue.trim();
    if ((!text && files.length === 0) || sending) return;

    setSending(true);
    setThreadError(null);
    setInputValue("");

    const optimistic: ChatMessage = {
      id: `agent-${Date.now()}`,
      role: "user",
      text: text || "📎 Adjunto",
      ...supportChatTimestampsNow(),
      senderName: "Tú",
      senderKind: "agent",
    };
    setMessages((prev) => [
      ...prev.filter((m) => m.id !== "inbox-empty" && m.id !== "no-thread"),
      optimistic,
    ]);

    try {
      const ticketId = await ensureTicketId(selected);
      const formData = new FormData();
      if (text) formData.set("message", text);
      for (const file of files) formData.append("files", file);

      const res = await fetch(`/api/support/inbox/${ticketId}/messages`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: ChatMessage;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.message) {
        throw new Error(data.error ?? "No se pudo enviar.");
      }
      setMessages((prev) =>
        prev.map((msg) => (msg.id === optimistic.id ? data.message! : msg)),
      );
      await loadTickets();
    } catch (err) {
      setMessages((prev) => prev.filter((msg) => msg.id !== optimistic.id));
      setInputValue(text);
      setThreadError(err instanceof Error ? err.message : "Error al enviar.");
    } finally {
      setSending(false);
    }
  }

  const headerActions = hasRealTicket ? (
    <ChatMoreMenu
      busy={clearingChat}
      onClear={() => {
        if (window.confirm("¿Borrar todos los mensajes de esta conversación?")) void handleClearChat();
      }}
    />
  ) : null;

  if (workspace === "meetings") {
    return (
      <StaffMeetingsBoard
        onBackToChats={() => setWorkspace("chats")}
        onPending={setPendingMeetings}
      />
    );
  }

  return (
    <section
      aria-label="Chats de soporte"
      className="grid h-[calc(100dvh-144px)] min-h-[460px] grid-rows-[minmax(0,1fr)] overflow-hidden rounded-card border border-line bg-surface shadow-card max-[959px]:h-[calc(100dvh-124px)] lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]"
    >
      {/* Lista de chats */}
      <aside
        className={cn(
          "flex min-h-0 min-w-0 flex-col lg:border-r lg:border-line",
          mobileShowChat && "hidden lg:flex",
        )}
      >
        <div className="shrink-0 px-4 pb-3 pt-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="eyebrow">Soporte</p>
              <h1 tabIndex={-1} className="flex items-baseline gap-2 text-xl font-semibold tracking-[-0.02em] text-ink outline-none">
                Chats
                <span className="num text-xs font-normal text-ink-3">{filteredTickets.length}</span>
              </h1>
            </div>
            <button
              type="button"
              onClick={() => setWorkspace("meetings")}
              className={buttonClass("primary", "sm")}
            >
              Reuniones
              {pendingMeetings > 0 ? (
                <span className="num rounded-full bg-on-accent/20 px-1.5 text-[11px] leading-[18px]">
                  {pendingMeetings}
                  <span className="sr-only"> por confirmar</span>
                </span>
              ) : null}
            </button>
          </div>
          <label className="panel-search mt-3">
            <span className="sr-only">Buscar chat</span>
            <PanelIcon name="search" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar chat"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <Segmented
            label="Qué ver"
            value={statusFilter}
            onChange={setStatusFilter}
            options={FILTERS.map((item) => ({ value: item.id, label: item.label }))}
            block
            className="mt-2.5"
          />
          {unreadIds.size > 0 ? (
            <ToneBadge tone="accent" dot className="mt-2.5">
              {unreadIds.size} sin leer
            </ToneBadge>
          ) : null}
        </div>

        {error ? (
          <Note tone="danger" className="mx-4 mb-3">
            {error}
          </Note>
        ) : null}

        <div className="ui-scroll min-h-0 flex-1 overflow-y-auto border-t border-line">
          {loading ? (
            <p role="status" className="px-4 py-10 text-center text-[13px] text-ink-2">
              Cargando clientes…
            </p>
          ) : filteredTickets.length === 0 ? (
            <EmptyState
              icon={q.trim() ? "search" : "chat"}
              title={
                q.trim()
                  ? "Sin resultados"
                  : statusFilter === "chats"
                    ? "Todavía no hay chats"
                    : "No hay contactos"
              }
              description={
                q.trim()
                  ? "Prueba con otro nombre o con un pedazo del último mensaje."
                  : statusFilter === "chats"
                    ? "Cuando un cliente escriba, el chat aparece aquí para cualquier gerente."
                    : "En Contactos puedes abrir un chat nuevo."
              }
            />
          ) : (
            <ul>
              {filteredTickets.map((ticket) => {
                const active = ticket.id === selectedId;
                const name = clientLabel(ticket);
                const unread = unreadIds.has(ticket.id);
                return (
                  <li key={ticket.id}>
                    <button
                      type="button"
                      onClick={() => void openTicket(ticket.id)}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "relative flex w-full items-center gap-2.5 border-b border-line px-4 py-2.5 text-left transition-colors",
                        active
                          ? "bg-active before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-r-[3px] before:bg-accent"
                          : "hover:bg-field",
                      )}
                    >
                      <HecomClienteAvatar name={name} avatarUrl={ticket.avatarUrl} size="sm" />
                      <span className="grid min-w-0 flex-1 leading-snug">
                        <b className={cn("truncate text-ink", unread ? "font-bold" : "font-semibold")}>{name}</b>
                        <small className={cn("truncate text-xs", unread ? "font-medium text-ink" : "text-ink-3")}>
                          {ticket.lastMessagePreview?.trim() ||
                            (ticket.hasHolisticAccount === false
                              ? "Sin cuenta Holistic"
                              : "Sin mensajes")}
                        </small>
                      </span>
                      <span className="grid shrink-0 justify-items-end gap-1">
                        <small className={cn("num text-[11px]", unread ? "font-semibold text-accent-text" : "text-ink-3")}>
                          {formatInboxListTime(
                            ticket.lastMessageAt ??
                              ticket.updatedAt ??
                              ticket.createdAt,
                          )}
                        </small>
                        {unread ? (
                          <span className="size-2 rounded-full bg-accent">
                            <span className="sr-only">Nuevo mensaje</span>
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Panel de conversación */}
      <div
        className={cn(
          "min-h-0 min-w-0 flex-col bg-field",
          mobileShowChat ? "flex" : "hidden lg:flex",
        )}
      >
        {!selectedId ? (
          <EmptyState
            icon="inbox"
            title="Chats de soporte"
            description="Elige un chat. Cualquier gerente puede leer y responder; si alguien ya lo abrió, queda leído para todos."
            action={
              unreadIds.size > 0 ? (
                <ToneBadge tone="accent">{unreadIds.size} sin leer</ToneBadge>
              ) : null
            }
            className="m-auto"
          />
        ) : (
          <ChatConversation
            appearance="panel"
            messages={messages}
            inputValue={inputValue}
            sending={sending}
            loading={loadingThread}
            error={threadError}
            showBack={mobileShowChat}
            className="min-h-0 flex-1"
            title={selectedClientName ?? "Chat"}
            subtitle={
              selected?.hasHolisticAccount === false
                ? "Aún no tiene cuenta para recibir el chat"
                : "Cualquier gerente puede responder"
            }
            avatarUrl={selected?.avatarUrl}
            headerActions={headerActions}
            onInputChange={setInputValue}
            onSend={(files) => void handleSend(files)}
            onBack={() => setMobileShowChat(false)}
            composerDisabled={selected?.hasHolisticAccount === false}
            composerDisabledReason="Este cliente aún no tiene cuenta Holistic para recibir el chat."
            emptyHint="Escribe para responder al cliente. Puedes pegar capturas o adjuntar archivos."
          />
        )}
      </div>
    </section>
  );
}

/** Más acciones del chat abierto (por ahora, borrar la conversación). */
function ChatMoreMenu({ busy, onClear }: { busy: boolean; onClear: () => void }) {
  const { anchorRef, open, toggle, close } = usePopover();
  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Más acciones"
        className="inline-grid size-8 place-items-center rounded-ctl text-ink hover:bg-hover"
      >
        <PanelIcon name="more" />
      </button>
      <PanelPopover anchorRef={anchorRef} open={open} onClose={close} label="Más acciones" align="end">
        <PanelMenu
          label="Más acciones"
          items={[
            {
              label: "Borrar conversación",
              icon: "x-circle",
              tone: "danger",
              disabled: busy,
              onSelect: () => {
                close();
                onClear();
              },
            },
          ]}
        />
      </PanelPopover>
    </>
  );
}
