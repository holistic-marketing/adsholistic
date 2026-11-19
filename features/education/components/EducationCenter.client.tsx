"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  educationCategoriesFor,
  educationCategoryById,
  type EducationAudience,
  type EducationCategoryId,
} from "../lib/catalog";
import { lessonEmbedUrl } from "../lib/loom";
import type { EducationLessonSave } from "../actions";
import type { EducationLessonView } from "../lib/types";
import { EducationLoomEditor } from "./EducationLoomEditor.client";
import { EducationPlayerDialog } from "./EducationPlayerDialog.client";
import { routes } from "@/config/routes";
import { buttonClass } from "@/components/ui/Button";
import { PageHeader, PanelCard } from "@/components/ui/PageHeader";
import { PanelIcon, type PanelIconName } from "@/components/ui/PanelIcon";
import { EmptyState, SquareIcon } from "@/components/ui/PanelKit";
import { cn } from "@/lib/cn";

type CategoryFilter = "all" | EducationCategoryId;

export function EducationCenter({
  lessons,
  canManage,
  audience,
}: {
  lessons: EducationLessonView[];
  canManage: boolean;
  audience: EducationAudience;
}) {
  const t = useTranslations("education");
  const team = audience === "gerente";
  const categories = educationCategoriesFor(audience);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [editing, setEditing] = useState(false);
  const [active, setActive] = useState<EducationLessonView | null>(null);
  const [saved, setSaved] = useState<Record<string, EducationLessonSave>>({});
  const [created, setCreated] = useState<EducationLessonView[]>([]);
  const [deleted, setDeleted] = useState<string[]>([]);
  // Cuando llegan los datos del servidor (tras guardar se hace refresh), mandan ellos:
  // así quien sube el video ve lo mismo que los demás y no una copia local.
  const [base, setBase] = useState(lessons);
  if (base !== lessons) {
    setBase(lessons);
    setSaved({});
    setCreated([]);
    setDeleted([]);
    setCategory("all");
    setQuery("");
  }

  const published = useMemo(() => {
    const known = new Set(lessons.map((lesson) => lesson.slug));
    const current = lessons.map((lesson) => applyLessonSave(lesson, saved[lesson.slug]));
    const extras = created
      .filter((lesson) => !known.has(lesson.slug))
      .map((lesson) => applyLessonSave(lesson, saved[lesson.slug]));
    return [...current, ...extras].filter((lesson) => !deleted.includes(lesson.slug));
  }, [lessons, saved, created, deleted]);

  // Los desactivados solo aparecen en el editor; la galería es lo que ve el cliente.
  const visible = useMemo(() => published.filter((lesson) => lesson.active), [published]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return visible.filter((lesson) => {
      if (category !== "all" && lesson.categoryId !== category) return false;
      if (!needle) return true;
      const label = educationCategoryById(lesson.categoryId).label.toLowerCase();
      return (
        lesson.title.toLowerCase().includes(needle) ||
        lesson.description.toLowerCase().includes(needle) ||
        label.includes(needle)
      );
    });
  }, [visible, query, category]);

  const browsing = category === "all" && query.trim().length === 0;
  const byNumber = [...visible].sort(
    (left, right) => left.number - right.number || left.title.localeCompare(right.title),
  );
  const recommended = byNumber.filter((lesson) => lesson.recommended);

  function resetFilters() {
    setQuery("");
    setCategory("all");
  }

  return (
    <div>
      <PageHeader
        title={team ? t("team.title") : t("title")}
        lede={team ? t("team.subtitle") : t("subtitle")}
        actions={
          canManage ? (
            <button
              type="button"
              onClick={() => setEditing((open) => !open)}
              aria-expanded={editing}
              className={buttonClass("outline")}
            >
              <PanelIcon name={editing ? "x" : "pencil"} />
              {editing ? t("manageClose") : t("manageToggle")}
            </button>
          ) : null
        }
      />

      {canManage ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <AudienceSwitch audience={audience} />
          <p className="text-[13px] text-ink-3">{team ? t("team.manageHint") : t("manageHint")}</p>
        </div>
      ) : null}

      {canManage && editing ? (
        <div className="mt-4">
          <EducationLoomEditor
            lessons={published}
            audience={audience}
            onSaved={(lesson) =>
              setSaved((current) => ({ ...current, [lesson.slug]: lesson }))
            }
            onCreated={(lesson) =>
              setCreated((current) => [
                ...current.filter((item) => item.slug !== lesson.slug),
                lessonFromSave(lesson),
              ])
            }
            onDeleted={(slug) => setDeleted((current) => [...current, slug])}
          />
        </div>
      ) : null}

      <label className="panel-search my-4 h-[46px]">
        <span className="sr-only">{t("searchLabel")}</span>
        <PanelIcon name="search" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("searchPlaceholder")}
          autoComplete="off"
        />
      </label>

      <div role="group" aria-label={t("categoryLabel")} className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2">
        <CategoryCard
          active={category === "all"}
          label={t("all")}
          countLabel={t("videoCount", { count: visible.length })}
          onClick={resetFilters}
          id="all"
        />
        {categories.map((item) => (
          <CategoryCard
            key={item.id}
            active={category === item.id}
            label={item.label}
            countLabel={t("videoCount", { count: visible.filter((lesson) => lesson.categoryId === item.id).length })}
            onClick={() => setCategory(item.id)}
            id={item.id}
          />
        ))}
      </div>

      {browsing && visible.length === 0 ? (
        <PanelCard className="mt-6">
          <EmptyState icon="cap" title={team ? t("team.empty") : t("empty")} />
        </PanelCard>
      ) : browsing ? (
        <>
          {recommended.length > 0 ? (
            <Section
              title={t("recommendedTitle")}
              subtitle={team ? t("team.recommendedSubtitle") : t("recommendedSubtitle")}
            >
              <LessonGrid lessons={recommended} onOpen={setActive} />
            </Section>
          ) : canManage ? (
            <Section
              title={t("recommendedTitle")}
              subtitle={team ? t("team.recommendedSubtitle") : t("recommendedSubtitle")}
            >
              <p className="rounded-box border border-dashed border-line-strong px-4 py-6 text-center text-[13px] text-ink-2">
                {t("recommendedEmpty")}
              </p>
            </Section>
          ) : null}

          <Section title={t("allVideosTitle")} subtitle={t("allVideosSubtitle")}>
            <LessonGrid lessons={byNumber} onOpen={setActive} />
          </Section>
        </>
      ) : (
        <Section
          title={category === "all" ? t("resultsTitle") : educationCategoryById(category).label}
          subtitle={t("videoCount", { count: filtered.length })}
          action={t("clearFilters")}
          onAction={resetFilters}
        >
          {filtered.length === 0 ? (
            <PanelCard>
              <EmptyState icon="cap" title={t("empty")} />
            </PanelCard>
          ) : (
            <LessonGrid lessons={filtered} onOpen={setActive} withDescription />
          )}
        </Section>
      )}

      <EducationPlayerDialog
        lesson={active}
        canManage={canManage}
        onClose={() => setActive(null)}
      />
    </div>
  );
}

function lessonFromSave(lesson: EducationLessonSave): EducationLessonView {
  return {
    slug: lesson.slug,
    number: lesson.number,
    categoryId: lesson.categoryId,
    title: lesson.title,
    description: "",
    recommended: lesson.recommended,
    custom: lesson.custom,
    loomUrl: lesson.loomUrl,
    embedUrl: lessonEmbedUrl(lesson.loomUrl),
    posterUrl: lesson.posterUrl,
    videoUrl: lesson.videoUrl,
    videoPosterUrl: lesson.videoPosterUrl,
    active: lesson.active,
    updatedAt: new Date().toISOString(),
  };
}

function applyLessonSave(
  lesson: EducationLessonView,
  patch: EducationLessonSave | undefined,
): EducationLessonView {
  if (!patch) return lesson;
  return {
    ...lesson,
    title: patch.title,
    recommended: patch.recommended,
    loomUrl: patch.loomUrl,
    embedUrl: lessonEmbedUrl(patch.loomUrl),
    posterUrl: patch.posterUrl,
    videoUrl: patch.videoUrl,
    videoPosterUrl: patch.videoPosterUrl,
    active: patch.active,
  };
}

/** Equipo / Clientes: enlaces con forma de control segmentado (v3 «seg»). */
function AudienceSwitch({ audience }: { audience: EducationAudience }) {
  const t = useTranslations("education");
  const tabs: Array<{ id: EducationAudience; label: string; href: string }> = [
    { id: "gerente", label: t("tabs.team"), href: routes.education },
    { id: "cliente", label: t("tabs.clients"), href: `${routes.education}?ver=clientes` },
  ];
  return (
    <nav aria-label={t("tabs.aria")} className="inline-flex rounded-box bg-subtle p-[3px]">
      {tabs.map((tab) => {
        const selected = tab.id === audience;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "flex h-[30px] items-center justify-center whitespace-nowrap rounded-ctl px-3 text-[13px] font-medium",
              selected ? "bg-surface text-ink shadow-card" : "text-ink-2 hover:text-ink",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Section({
  title,
  subtitle,
  action,
  onAction,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="mt-6">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-[-0.01em] text-ink">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-[13px] text-ink-3">{subtitle}</p> : null}
        </div>
        {action && onAction ? (
          <button type="button" onClick={onAction} className={buttonClass("ghost", "sm")}>
            {action}
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** Tarjeta de categoría (v3 «cat»): ícono en cuadro, nombre y cantidad de videos. */
function CategoryCard({
  active,
  label,
  countLabel,
  onClick,
  id,
}: {
  active: boolean;
  label: string;
  countLabel: string;
  onClick: () => void;
  id: CategoryFilter;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "grid h-full content-start justify-items-start gap-1.5 rounded-box border bg-surface p-3.5 text-left shadow-ctl transition-colors",
        active ? "border-accent shadow-[0_0_0_1px_var(--ui-accent)]" : "border-line hover:border-line-strong",
      )}
    >
      <CategoryGlyph id={id} />
      <b className="text-[13px] font-medium leading-snug text-ink">{label}</b>
      <small className="text-xs text-ink-3">{countLabel}</small>
    </button>
  );
}

function LessonGrid({
  lessons,
  onOpen,
  withDescription = false,
}: {
  lessons: EducationLessonView[];
  onOpen: (lesson: EducationLessonView) => void;
  withDescription?: boolean;
}) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
      {lessons.map((lesson) => (
        <li key={lesson.slug} className="min-w-0">
          <LessonCard lesson={lesson} onOpen={onOpen} withDescription={withDescription} />
        </li>
      ))}
    </ul>
  );
}

/** Video (v3 «vid»): portada 16:9 con el botón de reproducir y el título debajo. */
function LessonCard({
  lesson,
  onOpen,
  withDescription,
}: {
  lesson: EducationLessonView;
  onOpen: (lesson: EducationLessonView) => void;
  withDescription: boolean;
}) {
  const t = useTranslations("education");
  const category = educationCategoryById(lesson.categoryId);

  return (
    <button
      type="button"
      onClick={() => onOpen(lesson)}
      className="group grid w-full gap-2 text-left"
      aria-label={t("openLesson", { title: lesson.title })}
    >
      <span className="relative block aspect-video overflow-hidden rounded-box border border-line bg-subtle transition-colors group-hover:border-line-strong">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={lesson.posterUrl || "/education/poster.svg"}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
        <span aria-hidden className="absolute bottom-3 right-3 grid size-8 place-items-center rounded-ctl bg-accent-btn text-on-accent shadow-ctl group-hover:bg-accent-btn-hover">
          <PlayIcon />
        </span>
      </span>
      <span className="grid gap-0.5">
        <small className="text-xs font-medium text-ink-3">{category.label}</small>
        <span className="font-semibold leading-snug text-ink">
          {lesson.number}. {lesson.title}
        </span>
        {withDescription && lesson.description ? (
          <span className="line-clamp-2 text-[13px] text-ink-2">{lesson.description}</span>
        ) : null}
      </span>
    </button>
  );
}

/* Íconos de categoría (como en v3): cuadro con tono naranja. TikTok y Shopify
   conservan su logo. */
const CATEGORY_ICON: Partial<Record<CategoryFilter, PanelIconName>> = {
  all: "grid",
  empieza: "sparkle",
  plataforma: "layers",
  ayuda: "chat",
  "equipo-inicio": "sparkle",
  "equipo-clientes": "users",
  "equipo-cobranza": "wallet",
  "equipo-cuentas": "layers",
  "equipo-soporte": "chat",
};

function CategoryGlyph({ id }: { id: CategoryFilter }) {
  if (id === "tiktok") {
    return (
      <SquareIcon tone="neutral">
        <TikTokIcon />
      </SquareIcon>
    );
  }
  if (id === "shopify") {
    return (
      <SquareIcon tone="neutral">
        <ShopifyBagIcon />
      </SquareIcon>
    );
  }
  return <SquareIcon tone="accent" icon={CATEGORY_ICON[id] ?? "cap"} />;
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="ml-0.5 size-4" fill="currentColor" aria-hidden>
      <path d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86a1 1 0 00-1.5.86z" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="currentColor" aria-hidden>
      <path d="M12.53.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07Z" />
    </svg>
  );
}

function ShopifyBagIcon() {
  return (
    <svg viewBox="0 0 32 32" className="size-5" aria-hidden>
      <path
        fill="none"
        stroke="#96bf48"
        strokeWidth="2.15"
        strokeLinecap="round"
        d="M12.2 14.4V10.6a3.8 3.8 0 0 1 7.6 0v3.8"
      />
      <path
        fill="#96bf48"
        d="M8.3 13.2h15.4c.5 0 .8.4.8.8l-1.45 12.2a2.3 2.3 0 0 1-2.3 2H11.25a2.3 2.3 0 0 1-2.3-2L7.5 14c0-.4.4-.8.8-.8Z"
      />
      <ellipse cx="16" cy="13.55" rx="6.55" ry="1.45" fill="#7eae3a" />
      <path
        fill="#fff"
        d="M17.55 17.15c-.35-.85-1.15-1.25-2.15-1.15-1.25.1-2 .75-2 1.55 0 .7.55 1.1 1.85 1.5 1.55.45 2.55 1.05 2.55 2.4 0 1.45-1.2 2.45-3.05 2.45-1.55 0-2.7-.7-3.15-1.9l1.85-.7c.25.6.85 1 1.55 1 .85 0 1.35-.4 1.35-.95 0-.6-.5-.95-1.75-1.35-1.55-.5-2.7-1.15-2.7-2.55 0-1.4 1.2-2.4 3-2.4 1.4 0 2.45.55 2.9 1.7l-1.65.45Z"
      />
    </svg>
  );
}
