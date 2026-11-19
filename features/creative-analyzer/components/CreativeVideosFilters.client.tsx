"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { DateRangePicker } from "@/components/dashboard/DateRangePicker.client";
import {
  VIDEO_RANGE_PRESETS,
  type CreativeVideosRange,
  type VideoSort,
} from "@/features/creative-analyzer/lib/videos-range";

/** Primer día con datos de videos en radar_ad_daily. */
const FIRST_DATA_DAY = "2026-10-09";

function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | null;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-ctl border border-line bg-field p-0.5">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-8 rounded-[calc(var(--radius-ctl,8px)-2px)] px-3 text-[13px] font-medium transition-colors",
              active ? "bg-surface text-ink shadow-xs" : "text-ink-2 hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Filtros de Creativos: rango rápido, rango propio y orden. Todo va en la URL. */
export function CreativeVideosFilters({ range }: { range: CreativeVideosRange }) {
  const t = useTranslations("creatives.videos.filters");
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function go(next: { preset?: number; from?: string; to?: string; sort?: VideoSort }) {
    const params = new URLSearchParams();
    const from = next.from ?? (next.preset === undefined && range.preset === null ? range.from : undefined);
    const to = next.to ?? (next.preset === undefined && range.preset === null ? range.to : undefined);
    if (from && to) {
      params.set("desde", from);
      params.set("hasta", to);
    } else {
      const preset = next.preset ?? range.preset ?? 14;
      if (preset !== 14) params.set("rango", String(preset));
    }
    if ((next.sort ?? range.sort) === "spend") params.set("orden", "gasto");
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  return (
    <div
      className={cn(
        "mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-box border border-line bg-surface p-3",
        pending && "opacity-70",
      )}
      aria-busy={pending}
    >
      <PanelIcon name="filter" className="text-ink-3" />
      <Segmented
        label={t("range")}
        value={range.preset}
        options={VIDEO_RANGE_PRESETS.map((d) => ({ value: d, label: t("lastDays", { days: d }) }))}
        onChange={(preset) => go({ preset })}
      />
      <DateRangePicker
        startDate={range.from}
        endDate={range.to}
        minDate={FIRST_DATA_DAY}
        onChange={(from, to) => go({ from, to })}
      />
      <div className="ml-auto flex items-center gap-2">
        <span className="text-xs font-medium text-ink-3">{t("sortBy")}</span>
        <Segmented
          label={t("sortBy")}
          value={range.sort}
          options={[
            { value: "recent" as const, label: t("recent") },
            { value: "spend" as const, label: t("spend") },
          ]}
          onChange={(sort) => go({ sort })}
        />
      </div>
    </div>
  );
}
