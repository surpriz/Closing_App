export type BusinessHours = {
  startHour: number; // inclusive, local time
  endHour: number; // exclusive, local time
  days: readonly number[]; // ISO weekdays, 1 = Monday
};

type LocalParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
};

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function getLocalParts(date: Date, timeZone: string): LocalParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAYS[parts.weekday],
  };
}

function timeZoneOffsetMs(date: Date, timeZone: string) {
  const p = getLocalParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

// Wall-clock time in `timeZone` -> UTC instant. The second pass handles DST
// transitions where the offset differs between the guess and the result.
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
) {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const firstOffset = timeZoneOffsetMs(new Date(guess), timeZone);
  let result = guess - firstOffset;
  const secondOffset = timeZoneOffsetMs(new Date(result), timeZone);
  if (secondOffset !== firstOffset) result = guess - secondOffset;
  return new Date(result);
}

function addDays(year: number, month: number, day: number, days: number) {
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    weekday: ((date.getUTCDay() + 6) % 7) + 1,
  };
}

/**
 * Next moment a message may be sent to someone living in `timeZone`.
 * - "asap": now if inside business hours, otherwise the next opening.
 * - "next-morning": opening of the next business day (never today).
 */
export function nextBusinessSlot(
  from: Date,
  timeZone: string,
  hours: BusinessHours,
  mode: "asap" | "next-morning",
) {
  const local = getLocalParts(from, timeZone);

  const openNow =
    hours.days.includes(local.weekday) &&
    local.hour >= hours.startHour &&
    local.hour < hours.endHour;
  if (mode === "asap" && openNow) return from;

  for (let offset = mode === "asap" ? 0 : 1; offset <= 14; offset++) {
    const day = addDays(local.year, local.month, local.day, offset);
    if (!hours.days.includes(day.weekday)) continue;

    const slot = zonedTimeToUtc(day.year, day.month, day.day, hours.startHour, 0, timeZone);
    if (slot > from) return slot;
  }

  // No business day configured: fall back to 24h later
  return new Date(from.getTime() + 24 * 60 * 60 * 1000);
}
