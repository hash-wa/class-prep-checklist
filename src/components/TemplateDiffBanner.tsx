"use client";

import { useState } from "react";
import type { TemplateDiff } from "@/actions/courses";
import { addAllMissingTemplateItems } from "@/actions/courses";

export function TemplateDiffBanner({ diff, courseId }: { diff: TemplateDiff; courseId: number }) {
  const [dismissed, setDismissed] = useState(false);
  const [adding, setAdding] = useState(false);
  if (!diff.hasChanges || dismissed) return null;

  async function handleAddAll() {
    setAdding(true);
    await addAllMissingTemplateItems(courseId);
    setAdding(false);
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-400/50 bg-amber-50 px-3 py-2.5 text-sm dark:border-amber-400/30 dark:bg-amber-400/10">
      <div>
        <p className="font-medium text-amber-900 dark:text-amber-200">
          The master template has changed since this checklist was created.
        </p>
        <p className="mt-0.5 text-amber-800/80 dark:text-amber-200/70">
          {diff.addedCount > 0 && (
            <>
              {diff.addedCount} new item{diff.addedCount === 1 ? "" : "s"} in the template
              {diff.addedTitles.length > 0 && `: ${diff.addedTitles.join(", ")}`}.{" "}
            </>
          )}
          {diff.removedCount > 0 && (
            <>
              {diff.removedCount} item{diff.removedCount === 1 ? "" : "s"} removed from the template
              {diff.removedTitles.length > 0 && `: ${diff.removedTitles.join(", ")}`}.
            </>
          )}
          {" "}Add or remove tasks below to reconcile manually if you&apos;d like.
        </p>
        {diff.addedCount > 0 && (
          <button
            onClick={handleAddAll}
            disabled={adding}
            className="mt-2 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {adding ? "Adding..." : `Add all ${diff.addedCount} missing item${diff.addedCount === 1 ? "" : "s"}`}
          </button>
        )}
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
