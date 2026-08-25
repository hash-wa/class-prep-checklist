"use client";

import { useEscapeKey } from "@/lib/useEscapeKey";

export function DeleteSectionDialog({
  sectionTitle,
  itemCount,
  itemNoun,
  onMoveToInbox,
  onDeleteItems,
  onCancel,
}: {
  sectionTitle: string;
  itemCount: number;
  itemNoun: string;
  onMoveToInbox: () => void;
  onDeleteItems: () => void;
  onCancel: () => void;
}) {
  useEscapeKey(onCancel);

  const plural = itemCount === 1 ? itemNoun : `${itemNoun}s`;
  const pronoun = itemCount === 1 ? "it" : "them";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-sm rounded-xl border border-black/10 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1.5 text-base font-semibold">Delete section &quot;{sectionTitle}&quot;?</h2>
        <p className="mb-4 text-sm text-black/60 dark:text-white/60">
          It contains {itemCount} {plural}. What should happen to {pronoun}?
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onMoveToInbox}
            className="rounded-md border border-black/15 px-3 py-2 text-left text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            Move {pronoun} to Inbox
          </button>
          <button
            onClick={onDeleteItems}
            className="rounded-md bg-red-600 px-3 py-2 text-left text-sm text-white hover:bg-red-700"
          >
            Delete {plural} too
          </button>
          <button
            onClick={onCancel}
            className="rounded-md px-3 py-2 text-left text-sm text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
