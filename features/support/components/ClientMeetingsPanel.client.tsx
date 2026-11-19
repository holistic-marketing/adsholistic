"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useNow } from "@/hooks/useNow";
import { buttonClass } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { PanelCard } from "@/components/ui/PageHeader";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { EmptyState, Note, PropList, ToneBadge, type Tone } from "@/components/ui/PanelKit";
import { cn } from "@/lib/cn";
import {
  MEETING_TYPES,
  formatMinute,
  limaWallToUtc,
  mondayOf,
  todayYmd,
  type FreeSlot,
  type HourCell,
  type HourKind,
  type MeetingType,
} from "@/features/support/lib/meeting-slots";
import type { AdvisorOption, MeetingDto } from "@/features/support/lib/meeting-types";

const ACTIVE = new Set(["pending", "confirmed", "rescheduled"]);
const ERROR_CODES = [
  "subject",
  "type",
  "phone",
  "too_many",
  "slot_taken",
  "terminal",
  "started",
  "unavailable",
  "meet_url",
  "generic",
  "forbidden",
  "not_found",
  "advisor",
] as const;

type ErrorCode = (typeof ERROR_CODES)[number];

type GridResponse = {
  ok?: boolean;
  code?: string;
  error?: string;
  today: string;
  days: string[];
  hours: number[];
  cells: HourCell[];
  advisors?: AdvisorOption[];
  advisor?: string | null;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function isErrorCode(value: string): value is ErrorCode {
  return (ERROR_CODES as readonly string[]).includes(value);
}

function limaDate(ymd: string): Date {
  const [year, month, day] = ymd.split("-").map(Number);
  return limaWallToUtc(year, month, day, 12 * 60);
}

function statusTone(status: string): Tone {
  if (status === "confirmed") return "ok";
  if (status === "pending" || status === "rescheduled") return "warn";
  if (status === "no_show") return "danger";
  return "neutral";
}

function cellClass(kind: HourKind, active: boolean) {
  return cn(
    "flex h-10 items-center justify-center rounded-[6px] text-[10px] font-medium transition-colors",
    kind === "free" && "bg-ok-bg text-ok-fg hover:bg-ok-line",
    kind === "break" && "bg-warn-bg text-warn-fg",
    kind === "full" && "bg-active text-ink-3",
    kind === "off" && "bg-subtle text-transparent",
    active && "ring-2 ring-accent ring-offset-1 ring-offset-surface",
  );
}

export function ClientMeetingsPanel({ onBack }: { onBack: () => void }) {
  const t = useTranslations("support");
  const locale = useLocale();
  const currentMonday = mondayOf(todayYmd());

  const [grid, setGrid] = useState<GridResponse | null>(null);
  const [meetings, setMeetings] = useState<MeetingDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<HourCell | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<FreeSlot | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [advisorEmail, setAdvisorEmail] = useState("");
  const [advisors, setAdvisors] = useState<AdvisorOption[]>([]);
  const [meetingType, setMeetingType] = useState<MeetingType>("consulta");
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const labelDay = useCallback(
    (ymd: string, withWeekday = true) =>
      new Intl.DateTimeFormat(locale, {
        timeZone: "America/Lima",
        weekday: withWeekday ? "short" : undefined,
        day: "numeric",
        month: withWeekday ? undefined : "short",
      }).format(limaDate(ymd)),
    [locale],
  );

  const labelWhen = useCallback(
    (iso: string) =>
      new Intl.DateTimeFormat(locale, {
        timeZone: "America/Lima",
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date(iso)),
    [locale],
  );

  const explain = useCallback(
    (code: string | undefined) =>
      code && isErrorCode(code) ? t(`meetings.errors.${code}`) : t("meetings.errors.generic"),
    [t],
  );

  // Carga sin setters síncronos: el efecto la usa al montar (loading ya arranca en true)
  // y los handlers que cambian asesor/reprogramación ponen el spinner ellos mismos.
  const fetchMeetings = useCallback(async () => {
    try {
      const params = new URLSearchParams({ from: currentMonday, days: "14" });
      if (rescheduleId) params.set("ignore", rescheduleId);
      if (advisorEmail) params.set("advisor", advisorEmail);
      const [slotsRes, meetingsRes] = await Promise.all([
        fetch(`/api/support/meetings/slots?${params}`, { credentials: "include", cache: "no-store" }),
        fetch("/api/support/meetings", { credentials: "include", cache: "no-store" }),
      ]);
      const slots = (await slotsRes.json()) as GridResponse;
      const list = (await meetingsRes.json()) as { ok?: boolean; code?: string; meetings?: MeetingDto[] };
      if (!slotsRes.ok || !slots.ok) throw new Error(slots.code ?? "invalid");
      if (!meetingsRes.ok || !list.ok) throw new Error(list.code ?? "invalid");
      setGrid(slots);
      setAdvisors(slots.advisors ?? []);
      setMeetings(list.meetings ?? []);
    } catch (err) {
      setError(explain(err instanceof Error ? err.message : "invalid"));
    } finally {
      setLoading(false);
    }
  }, [advisorEmail, currentMonday, explain, rescheduleId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    await fetchMeetings();
  }, [fetchMeetings]);

  /** Cambio de asesor o de reprogramación: el efecto recarga; aquí va el spinner. */
  function markReloading() {
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    // Carga asíncrona: fetchMeetings() solo actualiza estado después del await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchMeetings();
  }, [fetchMeetings]);

  const now = useNow();
  const openMeetings = meetings.filter(
    (meeting) => ACTIVE.has(meeting.status) && Date.parse(meeting.endsAt) > now,
  );
  const nextMeeting = [...openMeetings].sort(
    (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt),
  )[0];
  const pendingCount = openMeetings.filter((meeting) => meeting.status === "pending").length;
  const confirmedCount = openMeetings.filter((meeting) => meeting.status !== "pending").length;
  const doneCount = meetings.filter((meeting) => meeting.status === "completed").length;
  const atLimit = openMeetings.length >= 3 && !rescheduleId;
  const selected = meetings.find((meeting) => meeting.id === selectedId) ?? null;

  const cellsByKey = useMemo(() => {
    const map = new Map<string, HourCell>();
    for (const cell of grid?.cells ?? []) map.set(`${cell.day}-${cell.minute}`, cell);
    return map;
  }, [grid]);

  const selectedAdvisor = advisors.find((person) => person.email === advisorEmail) ?? null;
  const gridReady = Boolean(advisorEmail) && grid?.advisor === advisorEmail;

  function chooseAdvisor(email: string) {
    if (email === advisorEmail) return;
    markReloading();
    setAdvisorEmail(email);
    setSelectedCell(null);
    setSelectedSlot(null);
    setGrid(null);
  }

  async function submitBooking() {
    if (!selectedSlot || !advisorEmail || saving) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/support/meetings", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          startsAt: selectedSlot.startsAt,
          subject,
          notes,
          phone,
          meetingType,
          advisorEmail,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; code?: string; meeting?: MeetingDto };
      if (!res.ok || !data.ok || !data.meeting) throw new Error(data.code ?? "invalid");
      setSubject("");
      setNotes("");
      setPhone("");
      setSelectedCell(null);
      setSelectedSlot(null);
      setSelectedId(data.meeting.id);
      setNotice(t("meetings.saved"));
      await load();
    } catch (err) {
      setError(explain(err instanceof Error ? err.message : "invalid"));
    } finally {
      setSaving(false);
    }
  }

  async function patchMeeting(id: string, body: Record<string, string>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/support/meetings/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; code?: string; meeting?: MeetingDto };
      if (!res.ok || !data.ok || !data.meeting) throw new Error(data.code ?? "invalid");
      setSelectedId(data.meeting.id);
      setRescheduleId(null);
      setSelectedCell(null);
      setSelectedSlot(null);
      if (body.action === "reschedule") setNotice(t("meetings.moved"));
      if (body.action === "cancel") setNotice(t("meetings.cancelled"));
      await load();
    } catch (err) {
      setError(explain(err instanceof Error ? err.message : "invalid"));
    } finally {
      setSaving(false);
    }
  }

  function chooseCell(cell: HourCell) {
    if (cell.kind !== "free" || cell.slots.length === 0) return;
    if (atLimit && !rescheduleId) {
      setError(t("meetings.errors.too_many"));
      return;
    }
    setSelectedCell(cell);
    setSelectedSlot(cell.slots[0] ?? null);
    setNotice(null);
    if (!rescheduleId) setSelectedId(null);
  }

  const weeks = useMemo(() => {
    const days = grid?.days ?? [];
    const chunks: string[][] = [];
    for (let index = 0; index < days.length; index += 7) {
      chunks.push(days.slice(index, index + 7));
    }
    return chunks;
  }, [grid]);

  const rangeLabel =
    grid && grid.days.length > 0
      ? `${labelDay(grid.days[0], false)} – ${labelDay(grid.days[grid.days.length - 1], false)}`
      : "";

  function weekHasFree(days: string[]) {
    const hours = grid?.hours ?? [];
    return days.some((day) =>
      hours.some((hour) => (cellsByKey.get(`${day}-${hour}`)?.slots.length ?? 0) > 0),
    );
  }

  function startReschedule(meeting: MeetingDto) {
    const nextAdvisor =
      meeting.advisorEmail && advisors.some((person) => person.email === meeting.advisorEmail)
        ? meeting.advisorEmail
        : advisorEmail;
    const advisorChanges = Boolean(nextAdvisor) && nextAdvisor !== advisorEmail;
    if (advisorChanges || meeting.id !== rescheduleId) markReloading();
    if (advisorChanges) {
      setAdvisorEmail(nextAdvisor);
      setGrid(null);
    }
    setSelectedId(meeting.id);
    setRescheduleId(meeting.id);
    setSelectedCell(null);
    setSelectedSlot(null);
    setNotice(null);
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <button type="button" onClick={onBack} className={buttonClass("ghost", "sm", "-ml-2.5 mb-1 lg:hidden")}>
            <PanelIcon name="chevron-left" />
            {t("meetings.back")}
          </button>
          <h2 className="text-lg font-semibold tracking-[-0.015em] text-ink">{t("meetings.title")}</h2>
          <p className="mt-0.5 max-w-xl text-ink-2">{t("meetings.subtitle")}</p>
        </div>
        <p className="shrink-0 text-[13px] font-medium capitalize text-ink-2">{rangeLabel}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Metric label={t("meetings.kpis.next")} value={nextMeeting ? labelWhen(nextMeeting.startsAt) : t("meetings.noneNext")} />
        <Metric label={t("meetings.kpis.pending")} value={String(pendingCount)} />
        <Metric label={t("meetings.kpis.confirmed")} value={String(confirmedCount)} />
        <Metric label={t("meetings.kpis.done")} value={String(doneCount)} />
      </div>

      {error ? <Note tone="danger">{error}</Note> : null}
      {notice ? <Note tone="ok" icon="check-circle">{notice}</Note> : null}
      {rescheduleId ? (
        <Note tone="warn" icon="calendar">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <p>{t("meetings.rescheduleHint")}</p>
            <button
              type="button"
              onClick={() => {
                markReloading();
                setRescheduleId(null);
                setSelectedCell(null);
                setSelectedSlot(null);
              }}
              className="shrink-0 font-semibold underline-offset-4 hover:underline"
            >
              {t("meetings.cancelBook")}
            </button>
          </div>
        </Note>
      ) : null}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20.5rem]">
        <PanelCard>
          <p className="mb-2 text-sm font-medium text-ink">{t("meetings.withWho")}</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("meetings.withWho")}>
            {advisors.map((person) => (
              <button
                key={person.email}
                type="button"
                aria-pressed={advisorEmail === person.email}
                onClick={() => chooseAdvisor(person.email)}
                className={cn(buttonClass("outline", "sm"), pressable)}
              >
                <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-subtle text-[10px] font-semibold text-ink-2">
                  {initials(person.displayName)}
                </span>
                {person.displayName}
              </button>
            ))}
          </div>
          <div className="my-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] font-medium text-ink">
              {advisorEmail ? t("meetings.clickHint") : t("meetings.pickPerson")}
            </p>
            <div className="flex flex-wrap gap-3 text-xs text-ink-2">
              <Legend swatch="bg-ok-bg border-ok-line" label={t("meetings.legendFree")} />
              <Legend swatch="bg-warn-bg border-warn-line" label={t("meetings.legendBreak")} />
              <Legend swatch="bg-active border-line" label={t("meetings.legendFull")} />
            </div>
          </div>
          {!advisorEmail ? (
            <EmptyState icon="users" title={t("meetings.pickPerson")} />
          ) : !gridReady ? (
            <p role="status" className="py-16 text-center text-[13px] text-ink-2">{t("meetings.loading")}</p>
          ) : (
            <div className="grid gap-5">
              {weeks.map((days, index) => (
                <WeekGrid
                  key={days[0] ?? index}
                  title={index === 0 ? t("meetings.thisWeek") : t("meetings.nextWeek")}
                  note={index === 0 && !weekHasFree(days) ? t("meetings.weekFull") : null}
                  days={days}
                  hours={grid?.hours ?? []}
                  cellsByKey={cellsByKey}
                  selectedKey={selectedCell ? `${selectedCell.day}-${selectedCell.minute}` : ""}
                  onChoose={chooseCell}
                  labelDay={labelDay}
                  labelFor={(kind) =>
                    kind === "free"
                      ? t("meetings.legendFree")
                      : kind === "break"
                        ? t("meetings.legendBreak")
                        : kind === "full"
                          ? t("meetings.legendFull")
                          : ""
                  }
                />
              ))}
            </div>
          )}
        </PanelCard>

        <PanelCard>
          {selectedSlot && !rescheduleId ? (
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void submitBooking();
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="eyebrow">{t("meetings.bookTitle")}</p>
                  <p className="mt-0.5 text-base font-semibold capitalize text-ink">{labelWhen(selectedSlot.startsAt)}</p>
                  <p className="text-xs text-ink-3">{t("meetings.duration")}</p>
                  {selectedAdvisor ? (
                    <p className="text-xs font-medium text-ink">
                      {t("meetings.withAdvisor", { name: selectedAdvisor.displayName })}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCell(null);
                    setSelectedSlot(null);
                  }}
                  className={buttonClass("ghost", "sm")}
                >
                  {t("meetings.cancelBook")}
                </button>
              </div>
              {selectedCell && selectedCell.slots.length > 1 ? (
                <div className="flex gap-1.5">
                  {selectedCell.slots.map((slot) => (
                    <button
                      key={slot.startsAt}
                      type="button"
                      aria-pressed={selectedSlot.startsAt === slot.startsAt}
                      onClick={() => setSelectedSlot(slot)}
                      className={cn(buttonClass("outline", "sm", "num"), pressable)}
                    >
                      {formatMinute(slot.minute)}
                    </button>
                  ))}
                </div>
              ) : null}
              <label className={fieldLabel}>
                {t("meetings.type")}
                <Select value={meetingType} onChange={(event) => setMeetingType(event.target.value as MeetingType)}>
                  {MEETING_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {t(`meetings.types.${type}`)}
                    </option>
                  ))}
                </Select>
              </label>
              <label className={fieldLabel}>
                {t("meetings.subject")}
                <Input
                  required
                  minLength={3}
                  maxLength={160}
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder={t("meetings.subjectPh")}
                />
              </label>
              <label className={fieldLabel}>
                {t("meetings.notes")}
                <Textarea
                  value={notes}
                  maxLength={2000}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder={t("meetings.notesPh")}
                  rows={3}
                  className="resize-none"
                />
              </label>
              <label className={fieldLabel}>
                {t("meetings.phone")}
                <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder={t("meetings.phonePh")} />
              </label>
              <button type="submit" disabled={saving || atLimit} className={buttonClass("primary", "md", "w-full")}>
                {saving ? t("meetings.submitting") : t("meetings.submit")}
              </button>
            </form>
          ) : selected ? (
            <MeetingDetail
              meeting={selected}
              now={now}
              saving={saving}
              when={labelWhen(selected.startsAt)}
              onClose={() => setSelectedId(null)}
              onCancel={() => {
                if (window.confirm(t("meetings.cancelAsk"))) {
                  void patchMeeting(selected.id, { action: "cancel" });
                }
              }}
              onReschedule={() => startReschedule(selected)}
              onMove={() => {
                if (!selectedSlot || !advisorEmail) return;
                void patchMeeting(selected.id, {
                  action: "reschedule",
                  startsAt: selectedSlot.startsAt,
                  advisorEmail,
                });
              }}
              moving={rescheduleId === selected.id}
              canMove={Boolean(selectedSlot)}
              nextWhen={selectedSlot ? labelWhen(selectedSlot.startsAt) : null}
            />
          ) : (
            <MeetingList
              meetings={meetings}
              now={now}
              labelWhen={labelWhen}
              onSelect={setSelectedId}
              onReschedule={startReschedule}
            />
          )}
        </PanelCard>
      </div>
    </div>
  );
}

const pressable =
  "aria-pressed:border-accent-line aria-pressed:bg-accent-soft aria-pressed:text-accent-text";
const fieldLabel = "grid gap-1.5 text-sm font-medium text-ink";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-card border border-line bg-surface px-4 py-3 shadow-card">
      <p className="text-[13px] font-medium text-ink-2">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold capitalize tracking-[-0.02em] text-ink tabular-nums">{value}</p>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={cn("size-2.5 rounded-[3px] border", swatch)} />
      {label}
    </span>
  );
}

function WeekGrid({
  title,
  note,
  days,
  hours,
  cellsByKey,
  selectedKey,
  onChoose,
  labelDay,
  labelFor,
}: {
  title: string;
  note: string | null;
  days: string[];
  hours: number[];
  cellsByKey: Map<string, HourCell>;
  selectedKey: string;
  onChoose: (cell: HourCell) => void;
  labelDay: (ymd: string) => string;
  labelFor: (kind: HourKind) => string;
}) {
  return (
    <div>
      <p className="eyebrow mb-2">{title}</p>
      {note ? <p className="mb-2 text-xs text-ink-2">{note}</p> : null}
      <div className="ui-scroll overflow-x-auto">
        <div className="grid min-w-[36rem] grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] gap-1">
          <span />
          {days.map((day) => (
            <span key={day} className="pb-1 text-center text-[11px] font-medium capitalize text-ink-3">
              {labelDay(day)}
            </span>
          ))}
          {hours.map((hour) => (
            <HourRow
              key={`${days[0]}-${hour}`}
              hour={hour}
              days={days}
              cellsByKey={cellsByKey}
              selectedKey={selectedKey}
              onChoose={onChoose}
              labelFor={labelFor}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function HourRow({
  hour,
  days,
  cellsByKey,
  selectedKey,
  onChoose,
  labelFor,
}: {
  hour: number;
  days: string[];
  cellsByKey: Map<string, HourCell>;
  selectedKey: string;
  onChoose: (cell: HourCell) => void;
  labelFor: (kind: HourKind) => string;
}) {
  return (
    <>
      <span className="num flex items-center text-[11px] text-ink-3">
        {formatMinute(hour)}
      </span>
      {days.map((day) => {
        const cell = cellsByKey.get(`${day}-${hour}`);
        if (!cell) return <span key={day} />;
        const active = selectedKey === `${day}-${hour}`;
        return (
          <button
            key={day}
            type="button"
            disabled={cell.kind !== "free"}
            aria-pressed={cell.kind === "free" ? active : undefined}
            onClick={() => onChoose(cell)}
            className={cellClass(cell.kind, active)}
          >
            {labelFor(cell.kind)}
          </button>
        );
      })}
    </>
  );
}

function MeetingGroup({
  title,
  meetings,
  now,
  empty,
  labelWhen,
  onSelect,
  onReschedule,
}: {
  title: string;
  meetings: MeetingDto[];
  now: number;
  empty?: string;
  labelWhen: (iso: string) => string;
  onSelect: (id: string) => void;
  onReschedule?: (meeting: MeetingDto) => void;
}) {
  const t = useTranslations("support");
  return (
    <div>
      <p className="eyebrow">{title}</p>
      {meetings.length === 0 ? (
        <p className="mt-2 text-[13px] text-ink-2">{empty}</p>
      ) : (
        <ul className="mt-2 grid gap-2">
          {meetings.map((meeting) => {
            const canMove = Boolean(onReschedule) && Date.parse(meeting.startsAt) > now;
            return (
              <li key={meeting.id} className="rounded-box border border-line px-3 py-2.5 hover:border-line-strong">
                <button type="button" onClick={() => onSelect(meeting.id)} className="flex w-full items-start justify-between gap-3 text-left">
                  <span className="grid min-w-0 leading-snug">
                    <b className="font-semibold text-ink [overflow-wrap:anywhere]">{meeting.subject}</b>
                    <small className="text-xs capitalize text-ink-3">
                      {labelWhen(meeting.startsAt)}
                      {meeting.advisorName ? ` · ${meeting.advisorName}` : ""}
                    </small>
                  </span>
                  <ToneBadge tone={statusTone(meeting.status)} dot>
                    {t(`meetings.statuses.${meeting.status}`)}
                  </ToneBadge>
                </button>
                {canMove ? (
                  <button
                    type="button"
                    onClick={() => onReschedule?.(meeting)}
                    className="mt-1.5 text-[13px] font-medium text-accent-text underline-offset-4 hover:underline"
                  >
                    {t("meetings.reschedule")}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function MeetingList({
  meetings,
  now,
  labelWhen,
  onSelect,
  onReschedule,
}: {
  meetings: MeetingDto[];
  now: number;
  labelWhen: (iso: string) => string;
  onSelect: (id: string) => void;
  onReschedule: (meeting: MeetingDto) => void;
}) {
  const t = useTranslations("support");
  const upcoming = meetings
    .filter((meeting) => ACTIVE.has(meeting.status) && Date.parse(meeting.endsAt) >= now)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const history = meetings
    .filter((meeting) => !upcoming.some((item) => item.id === meeting.id))
    .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));
  if (meetings.length === 0) {
    return <EmptyState icon="calendar" title={t("meetings.empty")} />;
  }
  return (
    <div className="grid gap-4">
      <MeetingGroup title={t("meetings.upcoming")} meetings={upcoming} now={now} empty={t("meetings.noUpcoming")} labelWhen={labelWhen} onSelect={onSelect} onReschedule={onReschedule} />
      {history.length > 0 ? (
        <MeetingGroup title={t("meetings.history")} meetings={history} now={now} labelWhen={labelWhen} onSelect={onSelect} />
      ) : null}
    </div>
  );
}

function MeetingDetail({
  meeting,
  now,
  when,
  saving,
  moving,
  canMove,
  nextWhen,
  onClose,
  onCancel,
  onReschedule,
  onMove,
}: {
  meeting: MeetingDto;
  now: number;
  when: string;
  saving: boolean;
  moving: boolean;
  canMove: boolean;
  nextWhen: string | null;
  onClose: () => void;
  onCancel: () => void;
  onReschedule: () => void;
  onMove: () => void;
}) {
  const t = useTranslations("support");
  const open = ACTIVE.has(meeting.status) && Date.parse(meeting.startsAt) > now;
  const canJoin = Boolean(meeting.meetUrl) && (meeting.status === "confirmed" || meeting.status === "rescheduled");
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow">{t("meetings.detail")}</p>
        <button type="button" onClick={onClose} className={buttonClass("ghost", "sm")}>
          {t("meetings.cancelBook")}
        </button>
      </div>
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 text-base font-semibold text-ink [overflow-wrap:anywhere]">{meeting.subject}</h3>
        <ToneBadge tone={statusTone(meeting.status)} dot>
          {t(`meetings.statuses.${meeting.status}`)}
        </ToneBadge>
      </div>
      <PropList
        items={[
          { label: t("meetings.when"), value: <span className="capitalize">{when}</span> },
          { label: t("meetings.type"), value: t(`meetings.types.${meeting.meetingType}`) },
          { label: t("meetings.advisor"), value: meeting.advisorName ?? t("meetings.unassigned") },
          { label: t("meetings.channel"), value: t("meetings.channelValue") },
          {
            label: t("meetings.reminder"),
            value: meeting.clientReminderSent ? t("meetings.sent") : t("meetings.pendingBadge"),
          },
        ]}
      />
      {meeting.notes ? (
        <p className="whitespace-pre-wrap rounded-box bg-field px-3 py-2 text-[13px] text-ink [overflow-wrap:anywhere]">
          {meeting.notes}
        </p>
      ) : null}
      {canJoin ? (
        <a
          href={meeting.meetUrl ?? "#"}
          target="_blank"
          rel="noreferrer"
          className={buttonClass("success", "md", "w-full")}
        >
          <PanelIcon name="video" />
          {t("meetings.join")}
        </a>
      ) : open ? (
        <p className="text-xs text-ink-2">{t("meetings.pendingLink")}</p>
      ) : null}
      {open ? (
        <div className="flex gap-2">
          <button type="button" disabled={saving} onClick={onReschedule} className={buttonClass("outline", "md", "flex-1")}>
            {t("meetings.reschedule")}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onCancel}
            className="inline-flex h-9 flex-1 items-center justify-center rounded-ctl border border-danger-line bg-field px-3.5 text-sm font-medium text-danger-fg shadow-ctl hover:bg-danger-bg disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("meetings.cancel")}
          </button>
        </div>
      ) : null}
      {moving ? (
        <button
          type="button"
          disabled={saving || !canMove}
          onClick={onMove}
          className={buttonClass("primary", "md", "w-full")}
        >
          {canMove && nextWhen ? t("meetings.moveToWhen", { when: nextWhen }) : t("meetings.moveTo")}
        </button>
      ) : null}
    </div>
  );
}
