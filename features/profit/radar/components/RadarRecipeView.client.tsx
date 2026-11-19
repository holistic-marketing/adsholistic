"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { routes } from "@/config/routes";
import type { StoredRecipe } from "@/lib/radar/recipe.server";
import type { RadarScript } from "@/lib/radar/recipe-parse";
import { buttonClass } from "@/components/ui/Button";
import { PanelIcon } from "@/components/ui/PanelIcon";

/** Texto en pantalla, como etiqueta (v3 «tag»). */
const tagClass = "inline-flex items-center rounded-[6px] bg-subtle px-2 py-0.5 text-xs font-medium text-ink";

function usd(value: number) {
  return `$${value.toFixed(2)}`;
}

function Label({ children }: { children: React.ReactNode }) {
  return <dt className="eyebrow">{children}</dt>;
}

type CopyLabels = { show: string; say: string; onScreen: string; hooks: string; caption: string; tips: string };

function scriptAsText(script: RadarScript, labels: CopyLabels): string {
  const lines = [
    script.title,
    "",
    `"${script.hook}"`,
    script.whoAppears ? `(${script.whoAppears})` : "",
    "",
    ...script.beats.flatMap((b) => [
      b.seconds,
      `  ${labels.show}: ${b.shot}`,
      `  ${labels.say}: ${b.line}`,
      b.onScreen ? `  ${labels.onScreen}: ${b.onScreen}` : "",
    ]),
    "",
    ...script.onScreenText.map((t) => `• ${t}`),
    script.cta,
    "",
    script.hookAlternatives.length > 0 ? `${labels.hooks}:` : "",
    ...script.hookAlternatives.map((h) => `• ${h}`),
    "",
    script.caption ? `${labels.caption}: ${script.caption} ${script.hashtags.join(" ")}`.trim() : "",
    "",
    script.tips.length > 0 ? `${labels.tips}:` : "",
    ...script.tips.map((tip) => `• ${tip}`),
  ];
  return lines.filter((l, i, all) => l !== "" || all[i - 1] !== "").join("\n").trim();
}

function ScriptCard({ script, index }: { script: RadarScript; index: number }) {
  const t = useTranslations("profit.radar.recipe");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const headingId = `radar-script-${index}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(
        scriptAsText(script, {
          show: t("show"),
          say: t("say"),
          onScreen: t("onScreenBeat"),
          hooks: t("hookAlternatives"),
          caption: t("caption"),
          tips: t("tips"),
        }),
      );
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2200);
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <article aria-labelledby={headingId} className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={headingId} className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
            {script.title}
          </h3>
          {script.whoAppears || script.durationSeconds ? (
            <p className="mt-0.5 text-xs text-ink-3">
              {[
                script.whoAppears ? t("who", { who: script.whoAppears }) : null,
                script.durationSeconds ? t("durationValue", { seconds: script.durationSeconds }) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void copy()}
          className={buttonClass("outline", "sm", "shrink-0")}
        >
          <PanelIcon name={copyState === "copied" ? "check" : "copy"} />
          {copyState === "copied" ? t("copied") : t("copy")}
        </button>
      </div>
      {copyState === "failed" ? (
        <p role="status" className="mt-2 text-xs text-accent-text">
          {t("copyFailed")}
        </p>
      ) : null}

      <p className="mt-3 text-base font-semibold leading-[1.45] text-ink [text-wrap:balance]">
        “{script.hook}”
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="h-10 w-[68px] pr-3 font-medium text-ink" />
              <th scope="col" className="h-10 w-[34%] pr-3 font-medium text-ink">{t("show")}</th>
              <th scope="col" className="h-10 font-medium text-ink">{t("say")}</th>
            </tr>
          </thead>
          <tbody>
            {script.beats.map((beat, i) => (
              <tr key={i} className="border-b border-line align-top last:border-0">
                <td className="num py-2.5 pr-3 text-ink-3">{beat.seconds}</td>
                <td className="py-2.5 pr-3 text-ink-2">
                  {beat.shot}
                  {beat.onScreen ? (
                    <span className="mt-1.5 block w-fit rounded-[6px] bg-subtle px-2 py-0.5 text-xs font-medium text-ink">
                      {beat.onScreen}
                    </span>
                  ) : null}
                </td>
                <td className="py-2.5 leading-[1.55] text-ink">{beat.line}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {script.onScreenText.length > 0 || script.cta ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {script.onScreenText.map((text) => (
            <span key={text} className={tagClass}>
              {text}
            </span>
          ))}
          {script.cta ? <span className="text-[13px] text-ink-2">→ {script.cta}</span> : null}
        </div>
      ) : null}

      {script.hookAlternatives.length > 0 || script.caption || script.tips.length > 0 ? (
        <dl className="mt-4 grid gap-x-6 gap-y-4 border-t border-line pt-4 sm:grid-cols-2">
          {script.hookAlternatives.length > 0 ? (
            <div>
              <Label>{t("hookAlternatives")}</Label>
              <dd className="mt-1.5">
                <ul className="flex list-disc flex-col gap-1 pl-4 text-[13px] leading-[1.55] text-ink marker:text-ink-3">
                  {script.hookAlternatives.map((h) => (
                    <li key={h}>“{h}”</li>
                  ))}
                </ul>
              </dd>
            </div>
          ) : null}
          {script.tips.length > 0 ? (
            <div>
              <Label>{t("tips")}</Label>
              <dd className="mt-1.5">
                <ul className="flex list-disc flex-col gap-1 pl-4 text-[13px] leading-[1.55] text-ink-2 marker:text-ink-3">
                  {script.tips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </dd>
            </div>
          ) : null}
          {script.caption ? (
            <div className="sm:col-span-2">
              <Label>{t("caption")}</Label>
              <dd className="mt-1 text-[13px] leading-[1.55] text-ink">
                {script.caption}
                {script.hashtags.length > 0 ? (
                  <span className="ml-1 text-ink-3">{script.hashtags.join(" ")}</span>
                ) : null}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </article>
  );
}

/** La receta única del cliente: ingredientes, referencia del rubro y tres guiones. */
export function RadarRecipeView({ stored }: { stored: StoredRecipe }) {
  const t = useTranslations("profit.radar.recipe");
  const { recipe, benchmark } = stored;
  const cpr = benchmark?.costPerResult ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-card border border-line bg-surface px-4 py-5 shadow-card sm:px-6">
        <h2 className="text-lg font-semibold leading-tight tracking-[-0.015em] text-ink [text-wrap:balance]">
          {stored.product ? t("title", { product: stored.product }) : t("titleNoProduct")}
        </h2>
        <p className="mt-2 max-w-[62ch] text-sm leading-[1.6] text-ink">{recipe.summary}</p>
        {cpr ? (
          <p className="mt-2 max-w-[62ch] text-[13px] leading-[1.55] text-ink-2">
            {t("benchmark", { low: usd(cpr.p25), high: usd(cpr.p75), accounts: benchmark!.accounts })}
          </p>
        ) : null}

        <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>{t("hook")}</Label>
            <dd className="mt-1">
              <span className="text-base font-semibold text-ink">“{recipe.hook.example}”</span>
              {recipe.hook.type ? <span className="ml-2 text-xs text-ink-3">{recipe.hook.type}</span> : null}
              {recipe.hook.why ? <p className="mt-1 text-[13px] leading-[1.55] text-ink-2">{recipe.hook.why}</p> : null}
            </dd>
          </div>
          {recipe.format ? (
            <div>
              <Label>{t("format")}</Label>
              <dd className="mt-1 text-sm text-ink">{recipe.format}</dd>
            </div>
          ) : null}
          {recipe.durationSeconds ? (
            <div>
              <Label>{t("duration")}</Label>
              <dd className="num mt-1 text-sm text-ink">
                {t("durationValue", { seconds: recipe.durationSeconds })}
              </dd>
            </div>
          ) : null}
          {recipe.cta ? (
            <div>
              <Label>{t("cta")}</Label>
              <dd className="mt-1 text-sm text-ink">{recipe.cta}</dd>
            </div>
          ) : null}
          {recipe.onScreenText.length > 0 ? (
            <div>
              <Label>{t("onScreen")}</Label>
              <dd className="mt-1.5 flex flex-wrap gap-1.5">
                {recipe.onScreenText.map((text) => (
                  <span key={text} className={tagClass}>
                    {text}
                  </span>
                ))}
              </dd>
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <Label>{t("structure")}</Label>
            <dd className="mt-2">
              <ol className="flex flex-col">
                {recipe.structure.map((beat, i) => (
                  <li key={i} className="grid grid-cols-[72px_1fr] gap-3 border-t border-line py-2 text-sm first:border-0">
                    <span className="num text-ink-3">{beat.seconds}</span>
                    <span className="text-ink">{beat.beat}</span>
                  </li>
                ))}
              </ol>
            </dd>
          </div>
          {recipe.why.length > 0 ? (
            <div>
              <Label>{t("why")}</Label>
              <dd className="mt-1.5">
                <ul className="flex list-disc flex-col gap-1 pl-4 text-[13px] leading-[1.55] text-ink-2 marker:text-ink-3">
                  {recipe.why.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </dd>
            </div>
          ) : null}
          {recipe.avoid.length > 0 ? (
            <div>
              <Label>{t("avoid")}</Label>
              <dd className="mt-1.5">
                <ul className="flex list-disc flex-col gap-1 pl-4 text-[13px] leading-[1.55] text-ink-2 marker:text-ink-3">
                  {recipe.avoid.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </dd>
            </div>
          ) : null}
        </dl>
      </div>

      {stored.scripts.length > 0 ? (
        <section aria-label={t("scripts")} className="flex flex-col gap-3">
          <h2 className="pl-1 text-base font-semibold text-ink">{t("scripts")}</h2>
          {stored.scripts.map((script, i) => (
            <ScriptCard key={`${stored.id}-${i}`} script={script} index={i} />
          ))}
          <div className="flex flex-wrap items-center justify-between gap-3 pl-1">
            <p className="text-xs text-ink-3">{t("original")}</p>
            <Link href={routes.creativeAnalyzer} className={buttonClass("outline", "md")}>
              {t("toCreatives")}
              <PanelIcon name="arrow-right" />
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
