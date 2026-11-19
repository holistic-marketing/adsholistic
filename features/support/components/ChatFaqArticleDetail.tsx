"use client";

import { useTranslations } from "next-intl";
import { buttonClass } from "@/components/ui/Button";
import { PanelIcon } from "@/components/ui/PanelIcon";
import type { SupportArticle } from "../types/support.types";

interface ChatFaqArticleDetailProps {
  article: SupportArticle;
  onBack: () => void;
}

export function ChatFaqArticleDetail({ article, onBack }: ChatFaqArticleDetailProps) {
  const t = useTranslations("support");

  return (
    <div className="flex flex-col">
      <div className="border-b border-line px-4 pb-3 pt-3 sm:px-5">
        <button type="button" onClick={onBack} className={buttonClass("ghost", "sm", "-ml-2.5")}>
          <PanelIcon name="chevron-left" />
          {t("back")}
        </button>
        <h3 className="mt-1 text-base font-semibold tracking-[-0.01em] text-ink">{article.title}</h3>
      </div>

      <div className="ui-scroll max-h-[380px] overflow-y-auto px-4 py-4 sm:px-5">
        <p className="leading-relaxed text-ink-2">{article.content}</p>
        {article.bullets.length > 0 && (
          <ul className="mt-4 space-y-2">
            {article.bullets.map((bullet) => (
              <li key={bullet} className="flex gap-2 text-ink-2">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
