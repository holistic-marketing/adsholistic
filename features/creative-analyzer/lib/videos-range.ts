import { shiftYmd, todayYmdInTz } from "@/lib/hecom/gasto-date";

/** Rangos rápidos de la sección Creativos (días hasta ayer, hora de Lima). */
export const VIDEO_RANGE_PRESETS = [7, 14, 30] as const;
export type VideoRangePreset = (typeof VIDEO_RANGE_PRESETS)[number];
export type VideoSort = "recent" | "spend";

export type CreativeVideosRange = {
  from: string;
  to: string;
  /** null cuando es un rango elegido a mano. */
  preset: VideoRangePreset | null;
  sort: VideoSort;
};

/** Rango máximo para no leer meses de datos de golpe. */
const MAX_RANGE_DAYS = 92;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000) + 1;
}

/** Lee ?rango=7|14|30 o ?desde=&hasta= y ?orden=recientes|gasto. Por defecto: 14 días, más recientes. */
export function resolveCreativeVideosRange(input: {
  preset?: string;
  from?: string;
  to?: string;
  sort?: string;
}): CreativeVideosRange {
  const sort: VideoSort = input.sort === "gasto" ? "spend" : "recent";
  const yesterday = shiftYmd(todayYmdInTz(), -1);

  const from = input.from?.trim() ?? "";
  const to = input.to?.trim() ?? "";
  if (YMD.test(from) && YMD.test(to) && from <= to) {
    const end = to > yesterday ? yesterday : to;
    const start = from > end ? end : from;
    const span = daysBetween(start, end);
    return {
      from: span > MAX_RANGE_DAYS ? shiftYmd(end, -(MAX_RANGE_DAYS - 1)) : start,
      to: end,
      preset: null,
      sort,
    };
  }

  const n = Number(input.preset);
  const preset = (VIDEO_RANGE_PRESETS as readonly number[]).includes(n) ? (n as VideoRangePreset) : 14;
  return { from: shiftYmd(yesterday, -(preset - 1)), to: yesterday, preset, sort };
}
