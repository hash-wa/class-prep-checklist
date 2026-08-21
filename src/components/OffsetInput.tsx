"use client";

import type { WeeksDaysOffset } from "@/lib/dates";

export function OffsetInput({
  value,
  onChange,
}: {
  value: WeeksDaysOffset;
  onChange: (value: WeeksDaysOffset) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={0}
        value={value.weeks}
        onChange={(e) => onChange({ ...value, weeks: Math.max(0, Number(e.target.value) || 0) })}
        className="w-16 rounded-md border border-black/15 px-2 py-1.5 text-sm dark:border-white/20"
        aria-label="Weeks"
      />
      <span className="text-sm text-black/60 dark:text-white/60">wk</span>
      <input
        type="number"
        min={0}
        max={6}
        value={value.days}
        onChange={(e) => onChange({ ...value, days: Math.max(0, Number(e.target.value) || 0) })}
        className="w-16 rounded-md border border-black/15 px-2 py-1.5 text-sm dark:border-white/20"
        aria-label="Days"
      />
      <span className="text-sm text-black/60 dark:text-white/60">d</span>
      <select
        value={value.direction}
        onChange={(e) =>
          onChange({ ...value, direction: e.target.value as "before" | "after" })
        }
        className="rounded-md border border-black/15 px-2 py-1.5 text-sm dark:border-white/20 dark:bg-black"
      >
        <option value="before">before</option>
        <option value="after">after</option>
      </select>
      <select
        value={value.anchor}
        onChange={(e) => onChange({ ...value, anchor: e.target.value as "start" | "end" })}
        className="rounded-md border border-black/15 px-2 py-1.5 text-sm dark:border-white/20 dark:bg-black"
      >
        <option value="start">start</option>
        <option value="end">end</option>
      </select>
    </div>
  );
}
