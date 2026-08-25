"use client";

import { useEscapeKey } from "@/lib/useEscapeKey";

export function ShortcutsHelpDialog({
  itemNoun,
  canAdd,
  onClose,
}: {
  itemNoun: string;
  canAdd: boolean;
  onClose: () => void;
}) {
  useEscapeKey(onClose);

  const rows: { keys: string; description: string }[] = [
    { keys: "Ctrl/Cmd + Z", description: "Undo the last delete" },
    { keys: "/", description: "Open the filter box" },
    { keys: "Esc", description: "Close a dialog, or cancel the row you're editing" },
    ...(canAdd ? [{ keys: "N", description: `Add a new ${itemNoun}` }] : []),
    { keys: "?", description: "Show this list" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-black/10 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Keyboard shortcuts</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-black/40 hover:bg-black/5 hover:text-black dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
          >
            ✕
          </button>
        </div>
        <ul className="flex flex-col gap-2 text-sm">
          {rows.map((row) => (
            <li key={row.keys} className="flex items-center justify-between gap-4">
              <span className="text-black/70 dark:text-white/70">{row.description}</span>
              <kbd className="flex-shrink-0 rounded border border-black/15 bg-black/[.03] px-1.5 py-0.5 font-mono text-xs dark:border-white/20 dark:bg-white/[.06]">
                {row.keys}
              </kbd>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
