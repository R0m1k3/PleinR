export const WEEK_DAYS = [
  { key: "monday", label: "Lundi", shortLabel: "Lun." },
  { key: "tuesday", label: "Mardi", shortLabel: "Mar." },
  { key: "wednesday", label: "Mercredi", shortLabel: "Mer." },
  { key: "thursday", label: "Jeudi", shortLabel: "Jeu." },
  { key: "friday", label: "Vendredi", shortLabel: "Ven." },
  { key: "saturday", label: "Samedi", shortLabel: "Sam." },
  { key: "sunday", label: "Dimanche", shortLabel: "Dim." },
] as const;

export type WeekDayKey = (typeof WEEK_DAYS)[number]["key"];

export type HoursSlot = {
  start: string;
  end: string;
};

export type DaySchedule = {
  key: WeekDayKey;
  label: string;
  closed: boolean;
  slots: HoursSlot[];
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\./g, "")
    .trim();
}

function dayIndex(value: string) {
  const normalized = normalizeText(value);
  return WEEK_DAYS.findIndex(({ label, shortLabel }) => {
    const full = normalizeText(label);
    const short = normalizeText(shortLabel);
    return normalized === full || normalized === short || normalized.startsWith(full);
  });
}

function parseTime(value: string) {
  const match = value.trim().match(/^(\d{1,2})(?:\s*(?:h|:)\s*(\d{2})?)?$/i);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseSlots(value: string): HoursSlot[] {
  return value
    .split(/\s*(?:\/|,|;|\bet\b)\s*/i)
    .map((part) => {
      const match = part.trim().match(
        /^(\d{1,2}(?:\s*(?:h|:)\s*\d{0,2})?)\s*(?:–|—|-|à)\s*(\d{1,2}(?:\s*(?:h|:)\s*\d{0,2})?)$/i
      );
      if (!match) return null;
      const start = parseTime(match[1]);
      const end = parseTime(match[2]);
      return start && end ? { start, end } : null;
    })
    .filter((slot): slot is HoursSlot => Boolean(slot));
}

function indicesFromLabel(label: string) {
  const parts = label.split(/\s+(?:–|—|-|à)\s+/i);
  if (parts.length === 1) {
    const index = dayIndex(parts[0]);
    return index >= 0 ? [index] : [];
  }

  const start = dayIndex(parts[0]);
  const end = dayIndex(parts[parts.length - 1]);
  if (start < 0 || end < 0) return [];

  const indices: number[] = [];
  let current = start;
  for (let guard = 0; guard < 7; guard += 1) {
    indices.push(current);
    if (current === end) break;
    current = (current + 1) % 7;
  }
  return indices;
}

export function parseMemberHours(value: string | null | undefined): DaySchedule[] {
  if (!value?.trim()) return [];

  const schedules = new Map<number, DaySchedule>();
  for (const line of value.split("\n")) {
    const separator = line.indexOf("|");
    if (separator < 0) continue;

    const label = line.slice(0, separator).trim();
    const range = line.slice(separator + 1).trim();
    const indices = indicesFromLabel(label);
    const closed = normalizeText(range).includes("ferm");
    const slots = closed ? [] : parseSlots(range);
    if (!closed && slots.length === 0) continue;

    for (const index of indices) {
      const day = WEEK_DAYS[index];
      schedules.set(index, {
        key: day.key,
        label: day.label,
        closed,
        slots: slots.map((slot) => ({ ...slot })),
      });
    }
  }

  return Array.from(schedules.entries())
    .sort(([a], [b]) => a - b)
    .map(([, schedule]) => schedule);
}

export function editorSchedule(value: string | null | undefined): DaySchedule[] {
  const parsed = new Map(parseMemberHours(value).map((day) => [day.key, day]));
  return WEEK_DAYS.map((day) => {
    const existing = parsed.get(day.key);
    return (
      existing ?? {
        key: day.key,
        label: day.label,
        closed: true,
        slots: [],
      }
    );
  });
}

export function serializeMemberHours(days: DaySchedule[]) {
  return WEEK_DAYS.map((day) => {
    const schedule = days.find((item) => item.key === day.key);
    if (!schedule || schedule.closed || schedule.slots.length === 0) {
      return `${day.label}|Fermé`;
    }
    const slots = schedule.slots
      .filter((slot) => slot.start && slot.end)
      .map((slot) => `${slot.start} – ${slot.end}`)
      .join(" / ");
    return `${day.label}|${slots || "Fermé"}`;
  }).join("\n");
}

export function formatHour(value: string) {
  const [hour, minute] = value.split(":");
  return `${Number(hour)}h${minute === "00" ? "" : minute}`;
}

export function formatSlots(slots: HoursSlot[]) {
  return slots.map((slot) => `${formatHour(slot.start)} – ${formatHour(slot.end)}`).join(" / ");
}

function minutesOf(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function parisNow(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const weekday = parts.find((part) => part.type === "weekday")?.value.toLowerCase();
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  const dayIndex = WEEK_DAYS.findIndex((day) => day.key === weekday);
  return { dayIndex: dayIndex < 0 ? 0 : dayIndex, minutes: hour * 60 + minute };
}

export type OpenStatus = {
  isOpen: boolean;
  label: string;
  detail: string | null;
  todayKey: WeekDayKey;
};

export function getOpenStatus(
  schedules: DaySchedule[],
  date = new Date()
): OpenStatus | null {
  if (schedules.length === 0) return null;

  const byKey = new Map(schedules.map((schedule) => [schedule.key, schedule]));
  const now = parisNow(date);
  const today = WEEK_DAYS[now.dayIndex];
  const todaySchedule = byKey.get(today.key);

  for (const slot of todaySchedule?.slots ?? []) {
    const start = minutesOf(slot.start);
    const end = minutesOf(slot.end);
    if (now.minutes >= start && now.minutes < end) {
      return {
        isOpen: true,
        label: "Ouvert maintenant",
        detail: `Ferme à ${formatHour(slot.end)}`,
        todayKey: today.key,
      };
    }
    if (now.minutes < start) {
      return {
        isOpen: false,
        label: "Fermé actuellement",
        detail: `Ouvre à ${formatHour(slot.start)}`,
        todayKey: today.key,
      };
    }
  }

  for (let offset = 1; offset <= 7; offset += 1) {
    const index = (now.dayIndex + offset) % 7;
    const nextDay = WEEK_DAYS[index];
    const nextSlot = byKey.get(nextDay.key)?.slots[0];
    if (!nextSlot) continue;
    return {
      isOpen: false,
      label: "Fermé actuellement",
      detail:
        offset === 1
          ? `Ouvre demain à ${formatHour(nextSlot.start)}`
          : `Ouvre ${nextDay.label.toLowerCase()} à ${formatHour(nextSlot.start)}`,
      todayKey: today.key,
    };
  }

  return {
    isOpen: false,
    label: "Fermé actuellement",
    detail: null,
    todayKey: today.key,
  };
}

export function normalizeWebsite(value: string | null | undefined) {
  const raw = value?.trim();
  if (!raw) return null;
  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const normalized = url.toString();
    return normalized.length <= 200 ? normalized : null;
  } catch {
    return null;
  }
}

export function websiteLabel(value: string | null | undefined) {
  const normalized = normalizeWebsite(value);
  if (!normalized) return null;
  const url = new URL(normalized);
  const path = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
  return `${url.hostname.replace(/^www\./i, "")}${path}`;
}
