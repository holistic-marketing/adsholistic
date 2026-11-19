"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { PageHeader, PanelCard } from "@/components/ui/PageHeader";
import { PanelIcon } from "@/components/ui/PanelIcon";
import {
  Avatar,
  EmptyState,
  FilterBar,
  Note,
  PropList,
  SearchField,
  StatCard,
  ToneBadge,
  type Tone,
} from "@/components/ui/PanelKit";
import { cn } from "@/lib/cn";
import {
  HORIZON_DAYS,
  addDaysYmd,
  formatMinute,
  limaDayBounds,
  limaParts,
  limaWallToUtc,
  mondayOf,
  todayYmd,
  weekdayLabel,
  type HourCell,
  type HourKind,
} from "@/features/support/lib/meeting-slots";
import type { MeetingCounts, MeetingDto, ScheduleDto } from "@/features/support/lib/meeting-types";

const TYPES = ["consulta", "onboarding", "revision", "estrategia", "seguimiento", "soporte"] as const;
const STATUSES = ["pending", "confirmed", "completed", "rescheduled", "cancelled", "no_show"] as const;
const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const TYPE_LABEL: Record<string, string> = {
  consulta: "Consulta",
  onboarding: "Onboarding",
  revision: "Revisión",
  estrategia: "Estrategia",
  seguimiento: "Seguimiento",
  soporte: "Soporte",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  completed: "Completada",
  rescheduled: "Reprogramada",
  cancelled: "Cancelada",
  no_show: "No show",
};

type BoardResponse = {
  ok?: boolean;
  error?: string;
  meetings: MeetingDto[];
  schedules: ScheduleDto[];
  counts: MeetingCounts;
};

function limaDate(ymd: string) {
  const [year, month, day] = ymd.split("-").map(Number);
  return limaWallToUtc(year, month, day, 12 * 60);
}

function whenLabel(iso: string) {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

function statusTone(status: string): Tone {
  if (status === "confirmed") return "ok";
  if (status === "pending" || status === "rescheduled") return "warn";
  if (status === "no_show") return "danger";
  return "neutral";
}

function cellClass(kind: HourKind) {
  if (kind === "free") return "bg-ok-bg text-ok-fg";
  if (kind === "break") return "bg-warn-bg text-warn-fg";
  if (kind === "full") return "bg-active text-ink-3";
  return "bg-subtle text-transparent";
}

export function StaffMeetingsBoard({
  onBackToChats,
  onPending,
}: {
  onBackToChats: () => void;
  onPending?: (count: number) => void;
}) {
  const currentMonday = mondayOf(todayYmd());
  const maxMonday = mondayOf(addDaysYmd(todayYmd(), HORIZON_DAYS));
  const [weekStart, setWeekStart] = useState(currentMonday);
  const [board, setBoard] = useState<BoardResponse | null>(null);
  const [cells, setCells] = useState<HourCell[]>([]);
  const [days, setDays] = useState<string[]>([]);
  const [hours, setHours] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [editing, setEditing] = useState<ScheduleDto | null>(null);
  const [moving, setMoving] = useState(false);
  const [slotStart, setSlotStart] = useState<string>("");
  const [slotChoices, setSlotChoices] = useState<{ startsAt: string; minute: number }[]>([]);
  const [meetUrl, setMeetUrl] = useState("");
  const [advisorEmail, setAdvisorEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const loadBoard = useCallback(async () => {
    const res = await fetch("/api/support/meetings", { credentials: "include", cache: "no-store" });
    const data = (await res.json()) as BoardResponse;
    if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo cargar la agenda.");
    setBoard(data);
    onPending?.(data.counts.pending);
  }, [onPending]);

  const loadSlots = useCallback(async (ignore?: string) => {
    const params = new URLSearchParams({ from: weekStart, days: "7" });
    if (ignore) params.set("ignore", ignore);
    const res = await fetch(`/api/support/meetings/slots?${params}`, {
      credentials: "include",
      cache: "no-store",
    });
    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      days: string[];
      hours: number[];
      cells: HourCell[];
    };
    if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo cargar la disponibilidad.");
    setDays(data.days);
    setHours(data.hours);
    setCells(data.cells);
  }, [weekStart]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadBoard(), loadSlots(moving && selectedId ? selectedId : undefined)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar.");
    } finally {
      setLoading(false);
    }
  }, [loadBoard, loadSlots, moving, selectedId]);

  useEffect(() => {
    // Cargador intencional (carga del tablero de reuniones): activa loading/limpia error y luego hace fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional lifecycle loader
    void reload();
  }, [reload]);

  const meetings = board?.meetings ?? [];
  const schedules = board?.schedules ?? [];
  const counts = board?.counts;
  const selected = meetings.find((meeting) => meeting.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return meetings.filter((meeting) => {
      if (statusFilter !== "all" && meeting.status !== statusFilter) return false;
      if (typeFilter !== "all" && meeting.meetingType !== typeFilter) return false;
      if (!q) return true;
      return [meeting.requesterName, meeting.requesterEmail, meeting.subject, meeting.advisorName ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [meetings, query, statusFilter, typeFilter]);

  const todayMeetings = useMemo(() => {
    const bounds = limaDayBounds();
    return meetings
      .filter((meeting) => {
        const start = Date.parse(meeting.startsAt);
        return meeting.status !== "cancelled" && start >= bounds.start.getTime() && start < bounds.end.getTime();
      })
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  }, [meetings]);

  async function runAction(body: Record<string, string>) {
    if (!selected || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/support/meetings/${selected.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo actualizar.");
      setMoving(false);
      setSlotStart("");
      setSlotChoices([]);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar.");
    } finally {
      setSaving(false);
    }
  }

  async function saveSchedule() {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/support/meetings/schedules", {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editing),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo guardar el horario.");
      setEditing(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el horario.");
    } finally {
      setSaving(false);
    }
  }

  const cellsByKey = useMemo(() => {
    const map = new Map<string, HourCell>();
    for (const cell of cells) map.set(`${cell.day}-${cell.minute}`, cell);
    return map;
  }, [cells]);

  function pickMeeting(meeting: MeetingDto, fromTable: boolean) {
    setSelectedId(meeting.id);
    setMeetUrl(meeting.meetUrl ?? "");
    if (fromTable) {
      setAdvisorEmail(meeting.advisorEmail ?? schedules.find((item) => item.isAvailable)?.email ?? "");
      setMoving(false);
    } else {
      setAdvisorEmail(meeting.advisorEmail ?? "");
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Soporte"
        title="Reuniones"
        lede="Confirma, reprograma y sigue las reuniones que piden los clientes."
        actions={
          <button type="button" onClick={onBackToChats} className={buttonClass("outline")}>
            <PanelIcon name="arrow-left" />
            Volver a chats
          </button>
        }
      />

      {error ? (
        <Note tone="danger" className="mb-4">
          {error}
        </Note>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Reuniones hoy" value={<span className="num">{counts?.today ?? 0}</span>} sub="En el día de Lima" />
        <StatCard label="Por confirmar" value={<span className="num">{counts?.pending ?? 0}</span>} sub="Esperan enlace" />
        <StatCard
          label="Asesores disponibles"
          value={<span className="num">{`${counts?.advisorsAvailable ?? 0} / ${counts?.advisorsTotal ?? 0}`}</span>}
          sub="Con horario activo"
        />
        <StatCard label="Próximas 24 h" value={<span className="num">{counts?.next24h ?? 0}</span>} sub="Pendientes o confirmadas" />
        <StatCard label="No show / reprogramadas" value={<span className="num">{counts?.attention ?? 0}</span>} sub="Últimos 7 días" />
      </div>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)_18rem]">
        <PanelCard title="Horarios del equipo" description="El cliente solo ve los bloques donde alguien está libre.">
          <ul className="grid gap-2">
            {schedules.map((schedule) => (
              <li key={schedule.email} className="rounded-box border border-line p-3">
                <div className="flex items-start gap-2.5">
                  <Avatar name={schedule.displayName} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-semibold text-ink">{schedule.displayName}</p>
                      <ToneBadge tone={schedule.isAvailable ? "ok" : "danger"} dot>
                        {schedule.isAvailable ? "Disponible" : "Ocupado"}
                      </ToneBadge>
                    </div>
                    <p className="mt-1 text-xs text-ink-2">
                      {weekdayLabel(schedule.weekdayMask)} · <span className="num">{formatMinute(schedule.startMinute)}–{formatMinute(schedule.endMinute)}</span>
                    </p>
                    <p className="text-xs text-ink-3">
                      Descanso <span className="num">{formatMinute(schedule.breakStartMinute)}–{formatMinute(schedule.breakEndMinute)}</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => setEditing(schedule)}
                      className="mt-1.5 inline-flex min-h-7 items-center gap-1 text-[13px] font-medium text-accent-text hover:underline"
                    >
                      <PanelIcon name="pencil" className="size-3.5" />
                      Editar horario<span className="sr-only"> de {schedule.displayName}</span>
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </PanelCard>

        <PanelCard
          title="Disponibilidad semanal"
          description={moving ? "Elige un bloque verde para mover la reunión." : "Lo mismo que ve el cliente al agendar."}
          action={
            <>
              <button
                type="button"
                aria-label="Semana anterior"
                disabled={weekStart <= currentMonday}
                onClick={() => setWeekStart((value) => addDaysYmd(value, -7))}
                className={iconButton}
              >
                <PanelIcon name="chevron-left" />
              </button>
              <button
                type="button"
                aria-label="Semana siguiente"
                disabled={weekStart >= maxMonday}
                onClick={() => setWeekStart((value) => addDaysYmd(value, 7))}
                className={iconButton}
              >
                <PanelIcon name="chevron-right" />
              </button>
            </>
          }
        >
          {loading && cells.length === 0 ? (
            <p role="status" className="py-10 text-center text-[13px] text-ink-2">Cargando disponibilidad…</p>
          ) : (
            <div className="ui-scroll overflow-x-auto">
              <div className="grid min-w-[34rem] grid-cols-[3rem_repeat(7,minmax(0,1fr))] gap-1">
                <span />
                {days.map((day) => (
                  <span key={day} className="pb-1 text-center text-[11px] font-medium capitalize text-ink-3">
                    {new Intl.DateTimeFormat("es-PE", {
                      timeZone: "America/Lima",
                      weekday: "short",
                      day: "numeric",
                    }).format(limaDate(day))}
                  </span>
                ))}
                {hours.map((hour) => (
                  <WeekHour
                    key={hour}
                    hour={hour}
                    days={days}
                    cellsByKey={cellsByKey}
                    onPick={(cell) => {
                      if (!moving || cell.slots.length === 0) return;
                      const choices = cell.slots.map((slot) => ({
                        startsAt: slot.startsAt,
                        minute: slot.minute,
                      }));
                      setSlotChoices(choices);
                      setSlotStart(choices.length === 1 ? choices[0].startsAt : "");
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </PanelCard>

        <PanelCard
          title="Agenda de hoy"
          description={
            <span className="capitalize">
              {new Intl.DateTimeFormat("es-PE", {
                timeZone: "America/Lima",
                weekday: "long",
                day: "numeric",
                month: "long",
              }).format(new Date())}
            </span>
          }
        >
          {todayMeetings.length === 0 ? (
            <p className="py-6 text-[13px] text-ink-2">No hay reuniones para hoy.</p>
          ) : (
            <ul className="grid gap-2">
              {todayMeetings.map((meeting) => (
                <li key={meeting.id}>
                  <button
                    type="button"
                    onClick={() => pickMeeting(meeting, false)}
                    aria-current={selectedId === meeting.id ? "true" : undefined}
                    className="grid w-full rounded-box border border-line px-3 py-2 text-left hover:border-line-strong hover:bg-field aria-[current=true]:border-accent-line aria-[current=true]:bg-accent-soft"
                  >
                    <span className="num text-xs font-semibold text-accent-text">
                      {formatMinute(limaParts(new Date(meeting.startsAt)).minuteOfDay)}
                    </span>
                    <span className="truncate font-semibold text-ink">{meeting.requesterName}</span>
                    <span className="truncate text-xs text-ink-3">
                      {meeting.advisorName ?? "Sin asesor"} · {TYPE_LABEL[meeting.meetingType]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>
      </div>

      {editing ? (
        <ScheduleEditor
          schedule={editing}
          saving={saving}
          onChange={setEditing}
          onCancel={() => setEditing(null)}
          onSave={() => void saveSchedule()}
        />
      ) : null}

      <FilterBar className="mt-4">
        <SearchField
          label="Buscar cliente o asunto"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="w-44 max-sm:flex-1">
        <Select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="Filtrar por estado"
        >
          <option value="all">Todos los estados</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABEL[status]}
            </option>
          ))}
        </Select>
        </div>
        <div className="w-44 max-sm:flex-1">
        <Select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
          aria-label="Filtrar por tipo"
        >
          <option value="all">Todos los tipos</option>
          {TYPES.map((type) => (
            <option key={type} value={type}>
              {TYPE_LABEL[type]}
            </option>
          ))}
        </Select>
        </div>
      </FilterBar>

      <section className="mt-4 min-w-0 rounded-card border border-line bg-surface shadow-card">
        <h2 className="border-b border-line px-4 py-4 text-base font-semibold tracking-[-0.01em] text-ink sm:px-6">Seguimiento</h2>
        <div className="grid xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="ui-scroll overflow-x-auto px-2 py-2 sm:px-4">
            <table className="w-full min-w-[46rem] border-collapse text-left text-[13px]">
              <thead>
                <tr>
                  {["Fecha", "Cliente", "Asesor", "Asunto", "Tipo", "Estado"].map((heading) => (
                    <th key={heading} scope="col" className="h-10 whitespace-nowrap border-b border-line px-2 text-sm font-medium text-ink">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-[13px] text-ink-2">
                      No hay reuniones con ese filtro.
                    </td>
                  </tr>
                ) : (
                  filtered.map((meeting) => (
                    <tr
                      key={meeting.id}
                      onClick={() => pickMeeting(meeting, true)}
                      className={cn(
                        "cursor-pointer border-b border-line last:border-b-0",
                        selectedId === meeting.id ? "bg-accent-soft" : "hover:bg-field",
                      )}
                    >
                      <td className="num whitespace-nowrap px-2 py-2.5 capitalize text-ink">{whenLabel(meeting.startsAt)}</td>
                      <td className="px-2 py-2.5">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            pickMeeting(meeting, true);
                          }}
                          aria-pressed={selectedId === meeting.id}
                          className="text-left font-semibold text-ink hover:text-accent-text"
                        >
                          {meeting.requesterName}
                        </button>
                      </td>
                      <td className="px-2 py-2.5 text-ink-2">{meeting.advisorName ?? "—"}</td>
                      <td className="max-w-[12rem] truncate px-2 py-2.5 text-ink">{meeting.subject}</td>
                      <td className="px-2 py-2.5 text-ink-2">{TYPE_LABEL[meeting.meetingType]}</td>
                      <td className="px-2 py-2.5">
                        <ToneBadge tone={statusTone(meeting.status)} dot>
                          {STATUS_LABEL[meeting.status]}
                        </ToneBadge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t border-line p-4 sm:p-5 xl:border-l xl:border-t-0">
            {selected ? (
              <Detail
                meeting={selected}
                schedules={schedules}
                saving={saving}
                moving={moving}
                slotStart={slotStart}
                slotChoices={slotChoices}
                meetUrl={meetUrl}
                advisorEmail={advisorEmail}
                onMeetUrl={setMeetUrl}
                onAdvisor={setAdvisorEmail}
                onMoveToggle={() => {
                  setMoving((value) => !value);
                  setSlotStart("");
                  setSlotChoices([]);
                }}
                onPickSlot={setSlotStart}
                onConfirm={() =>
                  void runAction({
                    action: "confirm",
                    meetUrl,
                    advisorEmail,
                  })
                }
                onReschedule={() =>
                  void runAction({
                    action: "reschedule",
                    meetUrl,
                    advisorEmail,
                    startsAt: slotStart,
                  })
                }
                onStatus={(action) => void runAction({ action })}
              />
            ) : (
              <EmptyState
                icon="calendar"
                title="Elige una reunión"
                description="Para confirmarla, reprogramarla o enviar el recordatorio."
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function WeekHour({
  hour,
  days,
  cellsByKey,
  onPick,
}: {
  hour: number;
  days: string[];
  cellsByKey: Map<string, HourCell>;
  onPick: (cell: HourCell) => void;
}) {
  return (
    <>
      <span className="num flex items-center text-[11px] text-ink-3">{formatMinute(hour)}</span>
      {days.map((day) => {
        const cell = cellsByKey.get(`${day}-${hour}`);
        const kind = cell?.kind ?? "off";
        return (
          <button
            key={day}
            type="button"
            disabled={kind !== "free"}
            onClick={() => cell && onPick(cell)}
            className={cn("h-8 rounded-[6px] text-[10px] font-medium", cellClass(kind))}
          >
            {kind === "free" ? "Libre" : kind === "break" ? "Pausa" : kind === "full" ? "Lleno" : ""}
          </button>
        );
      })}
    </>
  );
}

const pressable =
  "aria-pressed:border-accent-line aria-pressed:bg-accent-soft aria-pressed:text-accent-text";
const iconButton =
  "inline-grid size-8 place-items-center rounded-ctl border border-line bg-field text-ink shadow-ctl hover:border-line-strong hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50";
const dangerOutline =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-ctl border border-line bg-field px-2.5 text-[13px] font-medium text-danger-fg shadow-ctl hover:border-danger-line hover:bg-danger-bg disabled:cursor-not-allowed disabled:opacity-50";
const dangerGhost =
  "inline-flex h-8 w-full items-center justify-center rounded-ctl text-[13px] font-medium text-danger-fg hover:bg-danger-bg disabled:cursor-not-allowed disabled:opacity-50";

function ScheduleEditor({
  schedule,
  saving,
  onChange,
  onCancel,
  onSave,
}: {
  schedule: ScheduleDto;
  saving: boolean;
  onChange: (schedule: ScheduleDto) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const options: number[] = [];
  for (let minute = 7 * 60; minute <= 21 * 60; minute += 30) options.push(minute);
  return (
    <PanelCard title={`Editar horario de ${schedule.displayName}`} className="mt-4">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Días de atención">
        {DAY_NAMES.map((name, index) => {
          const bit = 1 << index;
          const on = (schedule.weekdayMask & bit) !== 0;
          return (
            <button
              key={name}
              type="button"
              aria-pressed={on}
              onClick={() => {
                const next = schedule.weekdayMask ^ bit;
                if (next === 0) return;
                onChange({ ...schedule, weekdayMask: next });
              }}
              className={cn(buttonClass("outline", "sm"), pressable)}
            >
              {name}
            </button>
          );
        })}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <MinuteField
          label="Desde"
          value={schedule.startMinute}
          options={options}
          onChange={(startMinute) => onChange({ ...schedule, startMinute })}
        />
        <MinuteField
          label="Hasta"
          value={schedule.endMinute}
          options={options}
          onChange={(endMinute) => onChange({ ...schedule, endMinute })}
        />
        <MinuteField
          label="Descanso desde"
          value={schedule.breakStartMinute}
          options={options}
          onChange={(breakStartMinute) => onChange({ ...schedule, breakStartMinute })}
        />
        <MinuteField
          label="Descanso hasta"
          value={schedule.breakEndMinute}
          options={options}
          onChange={(breakEndMinute) => onChange({ ...schedule, breakEndMinute })}
        />
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm font-medium text-ink">
        <input
          type="checkbox"
          checked={schedule.isAvailable}
          onChange={(event) => onChange({ ...schedule, isAvailable: event.target.checked })}
          className="size-4 accent-[var(--ui-accent-btn)]"
        />
        Disponible para nuevas reuniones
      </label>
      <div className="mt-4 flex gap-2">
        <button type="button" disabled={saving} onClick={onSave} className={buttonClass("primary")}>
          Guardar horario
        </button>
        <button type="button" onClick={onCancel} className={buttonClass("ghost")}>
          Cerrar
        </button>
      </div>
    </PanelCard>
  );
}

function MinuteField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number;
  options: number[];
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-ink">
      {label}
      <Select value={value} onChange={(event) => onChange(Number(event.target.value))} className="num">
        {options.map((minute) => (
          <option key={minute} value={minute}>
            {formatMinute(minute)}
          </option>
        ))}
      </Select>
    </label>
  );
}

function Detail({
  meeting,
  schedules,
  saving,
  moving,
  slotStart,
  slotChoices,
  meetUrl,
  advisorEmail,
  onMeetUrl,
  onAdvisor,
  onMoveToggle,
  onPickSlot,
  onConfirm,
  onReschedule,
  onStatus,
}: {
  meeting: MeetingDto;
  schedules: ScheduleDto[];
  saving: boolean;
  moving: boolean;
  slotStart: string;
  slotChoices: { startsAt: string; minute: number }[];
  meetUrl: string;
  advisorEmail: string;
  onMeetUrl: (value: string) => void;
  onAdvisor: (value: string) => void;
  onMoveToggle: () => void;
  onPickSlot: (startsAt: string) => void;
  onConfirm: () => void;
  onReschedule: () => void;
  onStatus: (action: string) => void;
}) {
  const closed = meeting.status === "completed" || meeting.status === "cancelled" || meeting.status === "no_show";
  return (
    <div className="grid gap-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 text-base font-semibold text-ink [overflow-wrap:anywhere]">{meeting.subject}</h3>
        <ToneBadge tone={statusTone(meeting.status)} dot>
          {STATUS_LABEL[meeting.status]}
        </ToneBadge>
      </div>
      <PropList
        items={[
          { label: "Cliente", value: `${meeting.requesterName} · ${meeting.requesterEmail}` },
          { label: "Teléfono", value: meeting.requesterPhone || "No dejó teléfono" },
          { label: "Cuándo", value: <span className="capitalize">{whenLabel(meeting.startsAt)}</span> },
          { label: "Tipo", value: TYPE_LABEL[meeting.meetingType] ?? meeting.meetingType },
          { label: "Asesor", value: meeting.advisorName ?? "Por asignar" },
          { label: "Canal", value: "Google Meet" },
          { label: "Recordatorio cliente", value: meeting.clientReminderSent ? "Enviado" : "Pendiente" },
          { label: "Recordatorio asesor", value: meeting.advisorReminderSent ? "Enviado" : "Pendiente" },
        ]}
      />
      {meeting.notes ? (
        <p className="whitespace-pre-wrap rounded-box bg-field px-3 py-2 text-[13px] text-ink [overflow-wrap:anywhere]">{meeting.notes}</p>
      ) : null}
      {meeting.meetUrl ? (
        <a href={meeting.meetUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent-text hover:underline">
          <PanelIcon name="external" className="size-3.5" />
          Abrir Meet
        </a>
      ) : null}
      {!closed ? (
        <div className="grid gap-2.5 border-t border-line pt-3">
          <label className="grid gap-1.5 text-sm font-medium text-ink">
            Asesor
            <Select value={advisorEmail} onChange={(event) => onAdvisor(event.target.value)}>
              <option value="">Elegir</option>
              {schedules
                .filter((item) => item.isAvailable)
                .map((item) => (
                  <option key={item.email} value={item.email}>
                    {item.displayName}
                  </option>
                ))}
            </Select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-ink">
            Enlace de la reunión
            <Input
              value={meetUrl}
              onChange={(event) => onMeetUrl(event.target.value)}
              placeholder="https://meet.google.com/..."
            />
          </label>
          <button type="button" disabled={saving} onClick={onConfirm} className={buttonClass("success", "md", "w-full")}>
            <PanelIcon name="check" />
            Confirmar
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={saving} onClick={onMoveToggle} aria-pressed={moving} className={cn(buttonClass("outline", "sm"), pressable)}>
              Reprogramar
            </button>
            <button type="button" disabled={saving} onClick={() => onStatus("remind")} className={buttonClass("outline", "sm")}>
              Recordatorio
            </button>
            <button type="button" disabled={saving} onClick={() => onStatus("complete")} className={buttonClass("outline", "sm")}>
              Completar
            </button>
            <button type="button" disabled={saving} onClick={() => onStatus("no_show")} className={dangerOutline}>
              No show
            </button>
          </div>
          {moving ? (
            <div className="grid gap-2">
              {slotChoices.length > 1 ? (
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Hora de inicio">
                  {slotChoices.map((choice) => (
                    <button
                      key={choice.startsAt}
                      type="button"
                      aria-pressed={slotStart === choice.startsAt}
                      onClick={() => onPickSlot(choice.startsAt)}
                      className={cn(buttonClass("outline", "sm", "num"), pressable)}
                    >
                      {formatMinute(choice.minute)}
                    </button>
                  ))}
                </div>
              ) : null}
              <button
                type="button"
                disabled={saving || !slotStart}
                onClick={onReschedule}
                className={buttonClass("primary", "md", "w-full")}
              >
                {slotStart ? `Mover a ${whenLabel(slotStart)}` : slotChoices.length > 1 ? "Elige :00 o :30" : "Elige un bloque verde"}
              </button>
            </div>
          ) : null}
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              if (window.confirm("¿Cancelar esta reunión?")) onStatus("cancel");
            }}
            className={dangerGhost}
          >
            Cancelar reunión
          </button>
        </div>
      ) : null}
    </div>
  );
}
