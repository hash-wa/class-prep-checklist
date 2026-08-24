"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Deletes still happen immediately (server call fires right away, same as before) — "undo"
 * doesn't defer or reverse that. Instead it recreates a copy via the same create-then-reorder
 * path the insert-gap flow already uses, so callers just need to capture enough to redo the
 * create, and offer this as the toast's undo action.
 */
export function useUndoToast(durationMs = 6000) {
  const [toast, setToast] = useState<{ id: number; message: string; durationMs: number } | null>(null);
  const pendingRef = useRef<{
    id: number;
    onUndo: () => void | Promise<void>;
    timeoutId: ReturnType<typeof setTimeout>;
  } | null>(null);
  const idRef = useRef(0);

  const show = useCallback(
    (message: string, onUndo: () => void | Promise<void>) => {
      // No stacking — a new delete while a toast is showing just replaces it. The previous
      // delete already happened either way; only the chance to undo it is what's dropped.
      if (pendingRef.current) clearTimeout(pendingRef.current.timeoutId);
      const id = ++idRef.current;
      const timeoutId = setTimeout(() => {
        if (pendingRef.current?.id === id) {
          pendingRef.current = null;
          setToast(null);
        }
      }, durationMs);
      pendingRef.current = { id, onUndo, timeoutId };
      setToast({ id, message, durationMs });
    },
    [durationMs]
  );

  const undo = useCallback(async () => {
    const pending = pendingRef.current;
    if (!pending) return;
    clearTimeout(pending.timeoutId);
    pendingRef.current = null;
    setToast(null);
    await pending.onUndo();
  }, []);

  const dismiss = useCallback(() => {
    if (pendingRef.current) clearTimeout(pendingRef.current.timeoutId);
    pendingRef.current = null;
    setToast(null);
  }, []);

  useEffect(
    () => () => {
      if (pendingRef.current) clearTimeout(pendingRef.current.timeoutId);
    },
    []
  );

  return { toast, show, undo, dismiss };
}

export function UndoToast({
  message,
  durationMs,
  onUndo,
  onDismiss,
}: {
  message: string;
  durationMs: number;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 flex-col overflow-hidden rounded-lg bg-neutral-900 text-sm text-white shadow-lg dark:bg-neutral-800">
      <div className="flex items-center gap-4 px-4 py-2.5">
        <span>{message}</span>
        <button onClick={onUndo} className="font-medium text-blue-400 hover:text-blue-300">
          Undo
        </button>
        <button onClick={onDismiss} aria-label="Dismiss" className="text-white/50 hover:text-white">
          ✕
        </button>
      </div>
      {/* Shrinks over the toast's lifetime so the user can see how long they have left to undo. */}
      <div className="h-0.5 bg-white/10">
        <div
          className="h-full bg-blue-400"
          style={{ animation: `undo-toast-countdown ${durationMs}ms linear forwards` }}
        />
      </div>
    </div>
  );
}
