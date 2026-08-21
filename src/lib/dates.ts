export type DueDateAnchor = "start" | "end";

export type WeeksDaysOffset = {
  weeks: number;
  days: number;
  direction: "before" | "after";
  anchor: DueDateAnchor;
};

/** Converts a signed day offset (negative = before the anchor) into a weeks/days/direction/anchor quadruple for UI display. */
export function offsetDaysToWeeksDays(offsetDays: number, anchor: DueDateAnchor = "start"): WeeksDaysOffset {
  const direction: "before" | "after" = offsetDays < 0 ? "before" : "after";
  const magnitude = Math.abs(offsetDays);
  return {
    weeks: Math.floor(magnitude / 7),
    days: magnitude % 7,
    direction,
    anchor,
  };
}

/** Converts a weeks/days/direction triple from the UI into a single signed day offset for storage. */
export function weeksDaysToOffsetDays(input: Pick<WeeksDaysOffset, "weeks" | "days" | "direction">): number {
  const magnitude = input.weeks * 7 + input.days;
  return input.direction === "before" ? -magnitude : magnitude;
}

/**
 * Resolves the actual calendar date for a task given the semester's start/end dates, the task's
 * offset in days, and which end of the semester that offset is anchored to. Returns null when
 * anchored to the end date but the semester has none set yet.
 */
export function resolveDueDate(
  semesterStartDate: string,
  semesterEndDate: string | null,
  offsetDays: number,
  anchor: DueDateAnchor = "start"
): Date | null {
  const anchorDate = anchor === "end" ? semesterEndDate : semesterStartDate;
  if (!anchorDate) return null;
  const [year, month, day] = anchorDate.split("-").map(Number);
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() + offsetDays);
  return base;
}

/** Formats a Date as YYYY-MM-DD for stable, timezone-independent display/sorting. */
export function formatDateISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Formats a Date for friendly display, e.g. "Mon, Aug 24, 2026". */
export function formatDateFriendly(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Formats a Date compactly as m/dd, e.g. "8/25". */
export function formatDateShort(date: Date): string {
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
}

const WEEKDAY_LETTERS = ["U", "M", "T", "W", "H", "F", "S"];

/** Single-letter weekday abbreviation (Sun=U, Mon=M, Tue=T, Wed=W, Thu=H, Fri=F, Sat=S). */
export function formatWeekdayLetter(date: Date): string {
  return WEEKDAY_LETTERS[date.getUTCDay()];
}

/** Whole days between today (UTC midnight) and the given date; negative means the date has passed. */
export function daysUntil(date: Date): number {
  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const targetUTC = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.round((targetUTC - todayUTC) / 86_400_000);
}
