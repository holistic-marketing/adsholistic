"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { cn } from "@/lib/cn";

function parseYmd(ymd: string): { y: number; m: number; d: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

function toYmd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function formatDisplay(ymd: string): string {
  const p = parseYmd(ymd);
  if (!p) return "—";
  return `${String(p.d).padStart(2, "0")}/${String(p.m).padStart(2, "0")}/${p.y}`;
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function addMonths(y: number, m: number, delta: number): { y: number; m: number } {
  const idx = y * 12 + (m - 1) + delta;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}

function monthCells(
  viewY: number,
  viewM: number,
  min?: string,
  max?: string,
): Array<{ ymd: string; day: number; inMonth: boolean; disabled: boolean }> {
  const firstDow = new Date(Date.UTC(viewY, viewM - 1, 1)).getUTCDay();
  const dim = daysInMonth(viewY, viewM);
  const prevDim = daysInMonth(viewY, viewM === 1 ? 12 : viewM - 1);
  const out: Array<{
    ymd: string;
    day: number;
    inMonth: boolean;
    disabled: boolean;
  }> = [];

  for (let i = 0; i < 42; i++) {
    let y = viewY;
    let m = viewM;
    let d: number;
    let inMonth = true;
    if (i < firstDow) {
      inMonth = false;
      d = prevDim - firstDow + i + 1;
      if (viewM === 1) {
        y = viewY - 1;
        m = 12;
      } else {
        m = viewM - 1;
      }
    } else if (i >= firstDow + dim) {
      inMonth = false;
      d = i - firstDow - dim + 1;
      if (viewM === 12) {
        y = viewY + 1;
        m = 1;
      } else {
        m = viewM + 1;
      }
    } else {
      d = i - firstDow + 1;
    }
    const ymd = toYmd(y, m, d);
    const disabled = Boolean((min && ymd < min) || (max && ymd > max));
    out.push({ ymd, day: d, inMonth, disabled });
  }
  return out;
}

type ProfitDateRangeFieldProps = {
  from: string;
  to: string;
  max?: string;
  onChange: (next: { from: string; to: string }) => void;
};

const footBtn = "inline-flex h-8 items-center rounded-ctl px-2.5 text-[13px] font-medium hover:bg-hover";
const navBtn =
  "inline-flex size-10 items-center justify-center rounded-ctl text-ink-2 hover:bg-hover hover:text-ink sm:size-8";

export function ProfitDateRangeField({
  from,
  to,
  max,
  onChange,
}: ProfitDateRangeFieldProps) {
  const t = useTranslations("profit.dateRange");
  const weekdays = t.raw("weekdays") as string[];
  const monthsShort = t.raw("monthsShort") as string[];
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState<string | null>(null);
  const [hoverYmd, setHoverYmd] = useState<string | null>(null);

  const initial = parseYmd(from) ?? parseYmd(to) ?? parseYmd(max ?? "") ?? {
    y: new Date().getFullYear(),
    m: new Date().getMonth() + 1,
    d: 1,
  };
  const [leftY, setLeftY] = useState(initial.y);
  const [leftM, setLeftM] = useState(initial.m);

  const right = addMonths(leftY, leftM, 1);

  // Único punto de apertura: posiciona el mes visible y limpia la selección en curso.
  function toggleOpen() {
    if (open) {
      setOpen(false);
      return;
    }
    const p = parseYmd(from) ?? parseYmd(to);
    if (p) {
      setLeftY(p.y);
      setLeftM(p.m);
    }
    setDraftStart(null);
    setHoverYmd(null);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setDraftStart(null);
        setHoverYmd(null);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setDraftStart(null);
        setHoverYmd(null);
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const leftCells = useMemo(
    () => monthCells(leftY, leftM, undefined, max),
    [leftY, leftM, max],
  );
  const rightCells = useMemo(
    () => monthCells(right.y, right.m, undefined, max),
    [right.y, right.m, max],
  );

  const rangeStart = draftStart ?? from;
  const rangeEnd = draftStart
    ? hoverYmd && hoverYmd !== draftStart
      ? hoverYmd
      : draftStart
    : to;

  const displayFrom =
    draftStart && rangeEnd && rangeEnd < draftStart ? rangeEnd : rangeStart;
  const displayTo =
    draftStart && rangeEnd && rangeEnd < draftStart ? rangeStart : rangeEnd;

  function shiftLeft(delta: number) {
    const next = addMonths(leftY, leftM, delta);
    setLeftY(next.y);
    setLeftM(next.m);
  }

  function pick(ymd: string) {
    if (!draftStart) {
      setDraftStart(ymd);
      setHoverYmd(ymd);
      return;
    }
    let nextFrom = draftStart;
    let nextTo = ymd;
    if (nextTo < nextFrom) {
      nextFrom = ymd;
      nextTo = draftStart;
    }
    onChange({ from: nextFrom, to: nextTo });
    setDraftStart(null);
    setHoverYmd(null);
    setOpen(false);
  }

  function clearRange() {
    setDraftStart(null);
    setHoverYmd(null);
    onChange({ from: "", to: "" });
  }

  function goToday() {
    // Si hay max (jale hasta ayer), saltar al último día disponible.
    const todayIso = new Date().toISOString().slice(0, 10);
    const day = max && max.length === 10 ? max : todayIso;
    onChange({ from: day, to: day });
    setDraftStart(null);
    setHoverYmd(null);
    setOpen(false);
  }

  function dayClass(cell: {
    ymd: string;
    inMonth: boolean;
    disabled: boolean;
  }): string {
    const isStart = Boolean(displayFrom && cell.ymd === displayFrom);
    const isEnd = Boolean(displayTo && cell.ymd === displayTo);
    const inRange =
      Boolean(displayFrom && displayTo) &&
      cell.ymd > displayFrom &&
      cell.ymd < displayTo;
    const isEdge = isStart || isEnd;

    if (cell.disabled) {
      return "cursor-not-allowed text-ink-3 opacity-40";
    }
    if (isEdge) {
      return "rounded-ctl bg-accent-btn text-on-accent hover:bg-accent-btn-hover";
    }
    if (inRange) {
      return "bg-accent-soft text-ink";
    }
    if (cell.inMonth) {
      return "rounded-ctl text-ink hover:bg-hover";
    }
    return "rounded-ctl text-ink-3 hover:bg-hover";
  }

  function renderMonthGrid(
    y: number,
    m: number,
    cells: ReturnType<typeof monthCells>,
  ) {
    return (
      <div className="min-w-0 flex-1 sm:min-w-[15.5rem]">
        <p className="px-1 pb-2 text-center text-[13px] font-semibold text-ink">
          {t("yearMonth", { year: y, month: monthsShort[m - 1] })}
        </p>
        <div className="grid grid-cols-7 gap-y-0.5">
          {weekdays.map((d) => (
            <span
              key={`${y}-${m}-${d}`}
              className="py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-ink-3"
            >
              {d}.
            </span>
          ))}
          {cells.map((cell) => (
            <button
              key={`${y}-${m}-${cell.ymd}-${cell.inMonth ? "in" : "out"}`}
              type="button"
              disabled={cell.disabled}
              onClick={() => pick(cell.ymd)}
              onMouseEnter={() => {
                if (draftStart && !cell.disabled) setHoverYmd(cell.ymd);
              }}
              className={cn("num h-10 text-xs font-medium sm:h-8", dayClass(cell))}
            >
              {cell.day}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const selecting = Boolean(draftStart);

  return (
    <div ref={rootRef} className="relative min-w-0 max-w-full">
      {/* Botón de filtro v3 con su rótulo adentro: «Rango 01/10/2026 ~ 31/10/2026». */}
      <button
        type="button"
        id={id}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggleOpen}
        className={cn(
          "inline-flex h-9 max-w-full items-center gap-2 rounded-ctl border bg-field px-3 text-left text-[13px] font-medium text-ink shadow-ctl hover:bg-hover",
          open ? "border-accent ring-[3px] ring-[var(--ui-ring)]" : "border-line hover:border-line-strong",
        )}
      >
        <PanelIcon name="calendar" className="text-ink-3" />
        <span className="text-ink-3">{t("label")}</span>
        <span className="num min-w-0 truncate">
          {from && to
            ? `${formatDisplay(from)} ~ ${formatDisplay(to)}`
            : t("placeholder")}
        </span>
        <PanelIcon name="chevron-down" className="size-3.5 text-ink-3" />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={t("dialogAria")}
          className="absolute left-0 z-40 mt-2 w-[min(calc(100vw-5rem),36rem)] rounded-box border border-line bg-surface p-3 shadow-pop sm:p-4"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-0.5">
              <button type="button" aria-label={t("prevYear")} onClick={() => shiftLeft(-12)} className={navBtn}>
                «
              </button>
              <button type="button" aria-label={t("prevMonth")} onClick={() => shiftLeft(-1)} className={navBtn}>
                <PanelIcon name="chevron-left" />
              </button>
            </div>
            <p className="text-center text-xs text-ink-3">
              {selecting ? t("pickEnd") : t("pickStartEnd")}
            </p>
            <div className="flex items-center gap-0.5">
              <button type="button" aria-label={t("nextMonth")} onClick={() => shiftLeft(1)} className={navBtn}>
                <PanelIcon name="chevron-right" />
              </button>
              <button type="button" aria-label={t("nextYear")} onClick={() => shiftLeft(12)} className={navBtn}>
                »
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:gap-5">
            {renderMonthGrid(leftY, leftM, leftCells)}
            <div className="hidden w-px self-stretch bg-line sm:block" />
            {renderMonthGrid(right.y, right.m, rightCells)}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-line pt-2">
            <button type="button" onClick={clearRange} className={`${footBtn} text-ink-2 hover:text-ink`}>
              {t("clear")}
            </button>
            <button type="button" onClick={goToday} className={`${footBtn} text-accent-text`}>
              {t("today")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
