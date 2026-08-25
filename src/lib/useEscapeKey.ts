"use client";

import { useEffect } from "react";

/** Fires `onEscape` for every Escape keydown, regardless of focus — dialogs and inline
 *  edit forms both expect Esc to close/cancel even while a text field inside them is focused. */
export function useEscapeKey(onEscape: () => void) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onEscape();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onEscape]);
}
