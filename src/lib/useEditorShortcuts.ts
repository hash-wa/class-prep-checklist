"use client";

import { useEffect, useState } from "react";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/** Shared power-user shortcuts for the Master Template / course checklist editors:
 *  Ctrl/Cmd+Z undoes the last delete, "/" opens the filter box, "n" starts a new
 *  task/item, and "?" opens a cheat-sheet dialog (state for that lives here too, since
 *  it's the same across both editors). All except undo are ignored while typing in a
 *  field, and undo itself is also skipped there so native text-undo still works. */
export function useEditorShortcuts({
  canUndo,
  onUndo,
  onOpenFilter,
  canAdd,
  onAdd,
}: {
  canUndo: boolean;
  onUndo: () => void;
  onOpenFilter: () => void;
  canAdd: boolean;
  onAdd: () => void;
}) {
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const editable = isEditableTarget(e.target);
      const isUndoCombo = (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "z";

      if (isUndoCombo) {
        if (!editable && canUndo) {
          e.preventDefault();
          onUndo();
        }
        return;
      }

      if (editable || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "/") {
        e.preventDefault();
        onOpenFilter();
      } else if ((e.key === "n" || e.key === "N") && canAdd) {
        e.preventDefault();
        onAdd();
      } else if (e.key === "?") {
        e.preventDefault();
        setHelpOpen(true);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canUndo, onUndo, onOpenFilter, canAdd, onAdd]);

  return { helpOpen, closeHelp: () => setHelpOpen(false) };
}
