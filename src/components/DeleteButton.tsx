"use client";

import { useTransition } from "react";
import { TrashIcon } from "@/components/icons";

export function DeleteButton({
  onDelete,
  label = "Delete",
  icon = false,
}: {
  onDelete: () => Promise<void>;
  label?: string;
  icon?: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      try {
        await onDelete();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to delete.");
      }
    });
  }

  if (icon) {
    return (
      <button
        onClick={handleClick}
        disabled={isPending}
        aria-label={label}
        title={label}
        className="rounded p-1 text-black/40 hover:bg-black/5 hover:text-red-600 disabled:opacity-50 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-red-400"
      >
        <TrashIcon />
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="text-xs text-red-600 hover:underline disabled:opacity-50"
    >
      {isPending ? "Deleting..." : label}
    </button>
  );
}
