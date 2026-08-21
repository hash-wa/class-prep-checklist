"use client";

import { useState } from "react";
import { OffsetInput } from "@/components/OffsetInput";
import { weeksDaysToOffsetDays, type DueDateAnchor, type WeeksDaysOffset } from "@/lib/dates";

export function BulkActionsToolbar({
  count,
  sections,
  onMove,
  onSetOffset,
  onDelete,
  onClear,
  itemLabel = "item",
}: {
  count: number;
  sections: { id: number; title: string }[];
  onMove: (sectionId: number | null) => void | Promise<void>;
  onSetOffset: (offsetDays: number, anchor: DueDateAnchor) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  onClear: () => void;
  itemLabel?: string;
}) {
  const [target, setTarget] = useState<number | "">("");
  const [moving, setMoving] = useState(false);
  const [offset, setOffset] = useState<WeeksDaysOffset>({ weeks: 1, days: 0, direction: "before", anchor: "start" });
  const [settingOffset, setSettingOffset] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const busy = moving || settingOffset || deleting;

  async function handleMove() {
    setMoving(true);
    await onMove(target === "" ? null : target);
    setMoving(false);
    setTarget("");
  }

  async function handleSetOffset() {
    setSettingOffset(true);
    await onSetOffset(weeksDaysToOffsetDays(offset), offset.anchor);
    setSettingOffset(false);
  }

  async function handleDelete() {
    if (count === 0) return;
    if (!confirm(`Delete ${count} selected ${itemLabel}${count === 1 ? "" : "s"}? This cannot be undone.`)) return;
    setDeleting(true);
    await onDelete();
    setDeleting(false);
  }

  return (
    <div className="sticky top-2 z-10 flex flex-col gap-2.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2.5 text-sm shadow-sm dark:border-blue-700 dark:bg-blue-950/60">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-blue-900 dark:text-blue-200">
          {count > 0 ? `${count} selected` : `Tap ${itemLabel}s below to select them`}
        </span>
        <button
          onClick={onClear}
          disabled={count === 0}
          className="text-blue-900/70 hover:text-blue-900 disabled:opacity-40 dark:text-blue-200/70 dark:hover:text-blue-200"
        >
          Clear selection
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="w-20 flex-shrink-0 text-xs text-blue-900/70 dark:text-blue-200/70">Move to</span>
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value ? Number(e.target.value) : "")}
          className="rounded-md border border-black/15 px-2 py-1 text-sm dark:border-white/20 dark:bg-black"
        >
          <option value="">Inbox</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
        <button
          onClick={handleMove}
          disabled={busy || count === 0}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {moving ? "Moving..." : "Move"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="w-20 flex-shrink-0 text-xs text-blue-900/70 dark:text-blue-200/70">Due date</span>
        <OffsetInput value={offset} onChange={setOffset} />
        <button
          onClick={handleSetOffset}
          disabled={busy || count === 0}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {settingOffset ? "Updating..." : "Set"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="w-20 flex-shrink-0 text-xs text-blue-900/70 dark:text-blue-200/70">Danger</span>
        <button
          onClick={handleDelete}
          disabled={busy || count === 0}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
        >
          {deleting ? "Deleting..." : "Delete selected"}
        </button>
      </div>
    </div>
  );
}
