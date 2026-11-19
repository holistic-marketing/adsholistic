"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { buttonClass } from "@/components/ui/Button";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { ProfitAdvisorHeader } from "@/features/profit/components/ProfitAdvisorHeader";

type Turn = { role: "user" | "assistant"; content: string };

const SUGGESTION_KEYS = [
  "advisorSuggestOverview",
  "advisorSuggestCollections",
  "advisorSuggestSpend",
  "advisorSuggestCredit",
] as const;

/** Burbuja del chat (v3 «msg»); la propia va en naranja suave. */
const bubble = "rounded-box border px-3 py-2 leading-6 text-ink [overflow-wrap:anywhere]";

/** Quita markdown ruidoso (** __ #) para leer más limpio. */
function plainReply(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-•]\s+/gm, "· ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function TypingDots({ label }: { label: string }) {
  return (
    <div
      className={`${bubble} mr-auto inline-flex items-center gap-2 border-line bg-surface text-xs text-ink-2`}
      aria-live="polite"
    >
      <span className="flex items-center gap-1" aria-hidden>
        <span className="size-1.5 animate-pulse rounded-full bg-accent motion-reduce:animate-none" />
        <span className="size-1.5 animate-pulse rounded-full bg-accent [animation-delay:160ms] motion-reduce:animate-none" />
        <span className="size-1.5 animate-pulse rounded-full bg-accent [animation-delay:320ms] motion-reduce:animate-none" />
      </span>
      <span>{label}</span>
    </div>
  );
}

export function ProfitAdvisorBot({
  clienteName,
  from,
  to,
}: {
  clienteName: string;
  from: string;
  to: string;
}) {
  const t = useTranslations("profit");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, busy]);

  const ask = useCallback(
    async (raw: string) => {
      const message = raw.trim();
      if (!message || busy) return;
      setError(null);
      setBusy(true);
      setInput("");
      const prior = turns;
      setTurns([...prior, { role: "user", content: message }]);
      try {
        const res = await fetch("/api/profit/advisor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            message,
            history: prior,
            from: from || undefined,
            to: to || undefined,
          }),
        });
        const json = (await res.json()) as {
          ok?: boolean;
          reply?: string;
          error?: string;
        };
        if (!res.ok || !json.ok || !json.reply) {
          throw new Error(json.error || t("advisorError"));
        }
        setTurns([
          ...prior,
          { role: "user", content: message },
          { role: "assistant", content: plainReply(json.reply) },
        ]);
      } catch (e) {
        setTurns(prior);
        setError(e instanceof Error ? e.message : t("advisorError"));
      } finally {
        setBusy(false);
      }
    },
    [busy, from, to, t, turns],
  );

  return (
    <section
      id="profit-advisor"
      className="overflow-hidden rounded-card border border-line bg-surface shadow-card"
      aria-label={t("advisorTitle")}
    >
      <ProfitAdvisorHeader
        eyebrow={t("advisorEyebrow")}
        title={t("advisorTitle")}
        subtitle={t("advisorSubtitle", { name: clienteName })}
      />

      <div
        ref={scrollerRef}
        className="flex max-h-[min(48vh,400px)] min-h-[220px] flex-col gap-2 overflow-y-auto bg-field px-4 py-5 sm:px-6"
      >
        {turns.length === 0 ? (
          <div className={`${bubble} max-w-xl border-line bg-surface text-sm`}>
            <p>{t("advisorWelcome", { name: clienteName })}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {SUGGESTION_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  disabled={busy}
                  onClick={() => void ask(t(key))}
                  className={buttonClass("outline", "sm")}
                >
                  {t(key)}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {turns.map((turn, i) =>
          turn.role === "user" ? (
            <p
              key={`${turn.role}-${i}`}
              className={`${bubble} ml-auto max-w-[min(82%,520px)] border-accent-line bg-accent-soft text-sm`}
            >
              {turn.content}
            </p>
          ) : (
            <p
              key={`${turn.role}-${i}`}
              className={`${bubble} mr-auto max-w-[min(90%,36rem)] whitespace-pre-wrap border-line bg-surface text-sm`}
            >
              {turn.content}
            </p>
          ),
        )}

        {busy ? <TypingDots label={t("advisorTyping")} /> : null}
        {error ? (
          <p className="text-xs text-danger-fg" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <form
        className="border-t border-line px-4 py-3 sm:px-6"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={1}
            maxLength={800}
            disabled={busy}
            placeholder={t("advisorPlaceholder")}
            aria-label={t("advisorPlaceholder")}
            className="max-h-28 min-h-9 flex-1 resize-none rounded-ctl border border-line bg-field px-3 py-1.5 text-sm leading-6 text-ink shadow-ctl outline-none placeholder:text-ink-3 hover:border-line-strong focus-visible:border-accent focus-visible:ring-[3px] focus-visible:ring-[var(--ui-ring)] disabled:opacity-60"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask(input);
              }
            }}
          />
          <button type="submit" disabled={busy || !input.trim()} className={buttonClass("primary", "md", "shrink-0")}>
            <PanelIcon name="send" />
            {t("advisorSend")}
          </button>
        </div>
        <p className="mt-2 text-xs text-ink-3">{t("advisorFootnote")}</p>
      </form>
    </section>
  );
}
