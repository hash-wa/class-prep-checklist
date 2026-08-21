import { offsetDaysToWeeksDays, type DueDateAnchor } from "./dates";

/** Human-readable label for a signed day offset, e.g. "3w 2d before end" or "On start date". */
export function formatOffsetLabel(offsetDays: number, anchor: DueDateAnchor = "start"): string {
  if (offsetDays === 0) return `On ${anchor} date`;
  const { weeks, days, direction } = offsetDaysToWeeksDays(offsetDays, anchor);
  const parts: string[] = [];
  if (weeks > 0) parts.push(`${weeks}w`);
  if (days > 0 || weeks === 0) parts.push(`${days}d`);
  return `${parts.join(" ")} ${direction} ${anchor}`;
}
