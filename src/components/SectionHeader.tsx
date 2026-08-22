"use client";

import { useState } from "react";
import { ChevronRightIcon, PencilIcon, TrashIcon } from "@/components/icons";
import { getSectionColorStyle } from "@/lib/sectionColors";

export function SectionHeader({
  title,
  count,
  collapsed,
  colorIndex = 0,
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
  colorIndex?: number;
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
  const { gradient } = getSectionColorStyle(colorIndex);

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
    <div className={`group flex items-center gap-2 rounded-t-lg bg-gradient-to-br ${gradient} px-3 py-2 shadow-sm`}>
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
            className="flex-1 rounded-md border border-white/40 bg-white/95 px-2 py-1 text-sm font-semibold text-black outline-none"
          />
          <button onClick={handleSave} className="text-xs font-medium text-white hover:underline">
            Save
          </button>
          <button
            onClick={() => {
              setValue(title);
              setEditing(false);
            }}
            className="text-xs text-white/80 hover:text-white"
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
            className="-ml-1 flex items-center gap-1 rounded p-1 text-sm font-semibold uppercase tracking-wide text-white hover:bg-white/15"
          >
            <span className={`flex-shrink-0 text-white/80 transition-transform ${collapsed ? "" : "rotate-90"}`}>
              <ChevronRightIcon />
            </span>
            <h3>
              {title} <span className="font-normal normal-case text-white/70">({count})</span>
            </h3>
          </button>
          {!locked && (
            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                onClick={() => setEditing(true)}
                aria-label="Rename section"
                title="Rename section"
                className="rounded p-1 text-white/80 hover:bg-white/15 hover:text-white"
              >
                <PencilIcon />
              </button>
              <button
                onClick={onDelete}
                aria-label="Delete section"
                title="Delete section"
                className="rounded p-1 text-white/80 hover:bg-white/15 hover:text-white"
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
                className="rounded px-1 text-white/70 hover:bg-white/15 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
              >
                &#9650;
              </button>
              <button
                onClick={onMoveDown}
                disabled={!canMoveDown}
                aria-label="Move section down"
                className="rounded px-1 text-white/70 hover:bg-white/15 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
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
