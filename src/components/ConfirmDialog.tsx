"use client";

import { useEscapeKey } from "@/lib/useEscapeKey";

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  danger = true,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEscapeKey(onCancel);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-sm rounded-xl border border-black/10 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1.5 text-base font-semibold">{title}</h2>
        <p className="mb-4 text-sm text-black/60 dark:text-white/60">{message}</p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onConfirm}
            className={`rounded-md px-3 py-2 text-left text-sm text-white ${
              danger ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {confirmLabel}
          </button>
          <button
            onClick={onCancel}
            className="rounded-md px-3 py-2 text-left text-sm text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
