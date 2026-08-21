"use client";

import { useState } from "react";
import { ChevronRightIcon, PencilIcon, TrashIcon } from "@/components/icons";

export function SectionHeader({
  title,
  count,
  collapsed,
  locked = false,
  onToggleCollapsed,
  onRename,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  title: string;
  count: number;
  collapsed: boolean;
  locked?: boolean;
  onToggleCollapsed: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);

  function handleSave() {
    const trimmed = value.trim();
    if (!trimmed) {
      setValue(title);
      setEditing(false);
      return;
    }
    onRename(trimmed);
    setEditing(false);
  }

  return (
    <div className="group mb-0.5 flex items-center gap-2 px-1">
      {editing ? (
        <div className="flex flex-1 items-center gap-2">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSave();
              }
            }}
            autoFocus
            className="flex-1 rounded-md border border-black/15 px-2 py-1 text-sm font-semibold dark:border-white/20"
          />
          <button onClick={handleSave} className="text-xs text-blue-600 hover:underline">
            Save
          </button>
          <button
            onClick={() => {
              setValue(title);
              setEditing(false);
            }}
            className="text-xs text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex flex-1 items-center gap-2">
          <button
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand section" : "Collapse section"}
            title={collapsed ? "Expand section" : "Collapse section"}
            className="-ml-0.5 flex items-center gap-1 rounded p-0.5 text-sm font-semibold uppercase tracking-wide text-black/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/10"
          >
            <span
              className={`flex-shrink-0 text-black/40 transition-transform dark:text-white/40 ${collapsed ? "" : "rotate-90"}`}
            >
              <ChevronRightIcon />
            </span>
            <h3>
              {title} <span className="font-normal normal-case text-black/40 dark:text-white/40">({count})</span>
            </h3>
          </button>
          {!locked && (
            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                onClick={() => setEditing(true)}
                aria-label="Rename section"
                title="Rename section"
                className="rounded p-1 text-black/40 hover:bg-black/5 hover:text-blue-600 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-blue-400"
              >
                <PencilIcon />
              </button>
              <button
                onClick={onDelete}
                aria-label="Delete section"
                title="Delete section"
                className="rounded p-1 text-black/40 hover:bg-black/5 hover:text-red-600 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-red-400"
              >
                <TrashIcon />
              </button>
            </div>
          )}
          {!locked && (
            <div className="ml-auto flex items-center gap-0.5">
              <button
                onClick={onMoveUp}
                disabled={!canMoveUp}
                aria-label="Move section up"
                className="rounded px-1 text-black/50 hover:bg-black/5 hover:text-black disabled:opacity-30 disabled:hover:bg-transparent dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
              >
                &#9650;
              </button>
              <button
                onClick={onMoveDown}
                disabled={!canMoveDown}
                aria-label="Move section down"
                className="rounded px-1 text-black/50 hover:bg-black/5 hover:text-black disabled:opacity-30 disabled:hover:bg-transparent dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
              >
                &#9660;
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
