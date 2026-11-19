"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { routes } from "@/config/routes";
import { apiClient } from "@/lib/api/api-client.client";
import { useAppFormatter } from "@/lib/i18n/use-app-formatter";
import { useNow } from "@/hooks/useNow";
import { NOTIFICATIONS_REFRESH_EVENT } from "@/features/push/InAppPushToasts.client";
import { PushDeviceToggle } from "@/features/push/PushDeviceToggle.client";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { PanelPopover, usePopover } from "@/components/ui/PanelPopover.client";

interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  type: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

function notificationUrl(item: NotificationItem): string | null {
  const url = item.data.url;
  return typeof url === "string" && url.startsWith("/") ? url : null;
}

/** Campana con el número de avisos sin leer y la lista al abrirla. */
export function PanelNotifications() {
  const t = useTranslations("nav.notifications");
  const { bcp47 } = useAppFormatter();
  const router = useRouter();
  const { anchorRef, open: popOpen, toggle: togglePop, close: closePop } = usePopover();
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Reloj compartido: los «hace 5 min» se actualizan solos.
  const now = useNow();

  const fetchItems = useCallback(
    (isCancelled: () => boolean = () => false) =>
      apiClient<{ ok: boolean; notifications: NotificationItem[] }>(routes.api.notifications)
        .then((data) => {
          if (isCancelled()) return;
          setItems(data.notifications ?? []);
          setError(null);
        })
        .catch((requestError: unknown) => {
          if (!isCancelled()) setError(requestError instanceof Error ? requestError.message : t("loadError"));
        })
        .finally(() => {
          if (!isCancelled()) setLoading(false);
        }),
    [t],
  );

  function reload() {
    setLoading(true);
    void fetchItems();
  }

  // Se cargan al entrar para que el número de la campana avise sin abrirla,
  // y otra vez cuando llega un push con el panel abierto.
  useEffect(() => {
    let cancelled = false;
    const refresh = () => void fetchItems(() => cancelled);
    refresh();
    window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, refresh);
    };
  }, [fetchItems]);

  const unread = (items ?? []).filter((item) => !item.readAt);

  function relative(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t("now");
    const minutes = Math.max(0, Math.floor((now - date.getTime()) / 60_000));
    if (minutes < 1) return t("now");
    if (minutes < 60) return t("minutesAgo", { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t("hoursAgo", { count: hours });
    return date.toLocaleDateString(bcp47, { day: "2-digit", month: "short" });
  }

  async function markRead(item: NotificationItem) {
    if (item.readAt) return;
    const readAt = new Date().toISOString();
    setItems((current) => current?.map((n) => (n.id === item.id ? { ...n, readAt } : n)) ?? null);
    try {
      await apiClient(`/api/notifications/${item.id}/read`, { method: "PATCH" });
    } catch {
      setItems((current) => current?.map((n) => (n.id === item.id ? { ...n, readAt: item.readAt } : n)) ?? null);
    }
  }

  async function open(item: NotificationItem) {
    await markRead(item);
    const url = notificationUrl(item);
    if (url) {
      closePop();
      router.push(url);
    }
  }

  function markAll() {
    for (const item of unread) void markRead(item);
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="panel-icon-btn panel-icon-btn--bordered relative"
        aria-haspopup="dialog"
        aria-expanded={popOpen}
        aria-label={unread.length ? t("ariaUnread", { count: unread.length }) : t("aria")}
        onClick={() => {
          togglePop();
          if (!popOpen) reload();
        }}
      >
        <PanelIcon name="bell" />
        {unread.length ? (
          <span className="panel-dot-badge" aria-hidden>
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        ) : null}
      </button>
      <PanelPopover anchorRef={anchorRef} open={popOpen} onClose={closePop} label={t("title")} align="end" minWidth={320}>
        <div className="w-[360px] max-w-[calc(100vw-16px)]">
          <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2.5">
            <b className="font-semibold">{t("title")}</b>
            {unread.length ? (
              <button type="button" className="font-medium text-accent-text hover:underline" onClick={markAll}>
                {t("markAll")}
              </button>
            ) : (
              <span className="text-xs text-ink-3">{t("allRead")}</span>
            )}
          </div>
          <PushDeviceToggle />
          <div className="max-h-[min(60vh,440px)] overflow-y-auto">
            {loading && !items ? <p className="p-3 text-ink-3">{t("loading")}</p> : null}
            {error ? (
              <p className="p-3 text-danger-fg">
                {error}{" "}
                <button type="button" className="font-medium underline" onClick={reload}>
                  {t("refresh")}
                </button>
              </p>
            ) : null}
            {items && items.length === 0 && !error ? <p className="p-3 text-ink-3">{t("empty")}</p> : null}
            <ul>
              {(items ?? []).map((item) => (
                <li
                  key={item.id}
                  className="grid grid-cols-[8px_minmax(0,1fr)] gap-2.5 border-t border-line p-3 first:border-t-0"
                >
                  <span
                    aria-hidden
                    className={cn("mt-1.5 size-2 rounded-full", item.readAt ? "bg-transparent" : "bg-accent")}
                  />
                  <div className="min-w-0">
                    <button
                      type="button"
                      className="text-left font-semibold underline decoration-transparent underline-offset-[3px] hover:decoration-current"
                      onClick={() => void open(item)}
                    >
                      {item.title}
                    </button>
                    {item.body ? <p className="mt-0.5 leading-snug text-ink-2">{item.body}</p> : null}
                    <small className="text-xs text-ink-3">
                      {relative(item.createdAt)}
                      {item.readAt ? "" : ` · ${t("unreadSuffix")}`}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </PanelPopover>
    </>
  );
}
