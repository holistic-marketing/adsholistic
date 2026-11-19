"use client";

import { useTranslations } from "next-intl";
import { buttonClass } from "@/components/ui/Button";
import { PanelIcon } from "@/components/ui/PanelIcon";
import type { SupportArticle } from "../types/support.types";

interface ChatFaqCategoryDetailProps {
  categoryTitle: string;
  articles: SupportArticle[];
  onSelectArticle: (articleId: string) => void;
  onBack: () => void;
}

export function ChatFaqCategoryDetail({
  categoryTitle,
  articles,
  onSelectArticle,
  onBack,
}: ChatFaqCategoryDetailProps) {
  const t = useTranslations("support");

  return (
    <div className="flex flex-col">
      <div className="border-b border-line px-4 pb-3 pt-3 sm:px-5">
        <button type="button" onClick={onBack} className={buttonClass("ghost", "sm", "-ml-2.5")}>
          <PanelIcon name="chevron-left" />
          {t("back")}
        </button>
        <h3 className="mt-1 text-base font-semibold tracking-[-0.01em] text-ink">{categoryTitle}</h3>
      </div>

      <ul className="ui-scroll max-h-[420px] overflow-y-auto">
        {articles.map((article) => (
          <li key={article.id} className="border-b border-line last:border-b-0">
            <button
              type="button"
              onClick={() => onSelectArticle(article.id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-ink transition-colors hover:bg-hover sm:px-5"
            >
              <span>{article.title}</span>
              <PanelIcon name="chevron-right" className="text-ink-3" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
