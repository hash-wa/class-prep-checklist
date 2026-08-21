"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  setCourseAutoSync,
  syncCourseFromTemplate,
  syncTemplateFromCourse,
  mergeCourseAndTemplate,
} from "@/actions/courses";
import { LockIcon, UnlockIcon } from "@/components/icons";

export function CourseSyncControl({ courseId, autoSync }: { courseId: number; autoSync: boolean }) {
  const router = useRouter();
  const [showOptions, setShowOptions] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleUnlock() {
    setBusy(true);
    await setCourseAutoSync(courseId, false);
    router.refresh();
    setBusy(false);
  }

  async function handleEnable(direction: "masterToCourse" | "courseToMaster" | "both") {
    if (direction === "courseToMaster") {
      const confirmed = confirm(
        "This overwrites the Master Template to match this course's current checklist. " +
          "It affects every course that uses the template, not just this one. Continue?"
      );
      if (!confirmed) return;
    }

    setBusy(true);
    if (direction === "masterToCourse") await syncCourseFromTemplate(courseId);
    else if (direction === "courseToMaster") await syncTemplateFromCourse(courseId);
    else await mergeCourseAndTemplate(courseId);
    await setCourseAutoSync(courseId, true);
    router.refresh();
    setShowOptions(false);
    setBusy(false);
  }

  if (autoSync) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
          <LockIcon /> Locked &middot; auto-synced with Master Template
        </span>
        <button
          onClick={handleUnlock}
          disabled={busy}
          className="text-black/50 hover:text-black hover:underline disabled:opacity-50 dark:text-white/50 dark:hover:text-white"
        >
          {busy ? "Unlocking..." : "Unlock"}
        </button>
      </div>
    );
  }

  return (
    <div className="relative text-xs">
      <button
        onClick={() => setShowOptions((prev) => !prev)}
        className="flex items-center gap-1 rounded-full border border-black/15 px-2.5 py-1 text-black/60 hover:bg-black/5 dark:border-white/20 dark:text-white/60 dark:hover:bg-white/10"
      >
        <UnlockIcon /> Not synced &middot; Enable auto-sync
      </button>
      {showOptions && (
        <div className="absolute left-0 top-full z-10 mt-1 flex w-72 flex-col gap-1 rounded-lg border border-black/15 bg-white p-2 shadow-lg dark:border-white/20 dark:bg-neutral-900">
          <button
            disabled={busy}
            onClick={() => handleEnable("masterToCourse")}
            className="rounded-md px-2 py-1.5 text-left hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10"
          >
            <span className="block font-medium text-black dark:text-white">Master list &rarr; course</span>
            <span className="block text-black/50 dark:text-white/50">Course adopts the current template exactly.</span>
          </button>
          <button
            disabled={busy}
            onClick={() => handleEnable("courseToMaster")}
            className="rounded-md px-2 py-1.5 text-left hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10"
          >
            <span className="block font-medium text-black dark:text-white">Course &rarr; master list</span>
            <span className="block text-black/50 dark:text-white/50">Template adopts this course&apos;s checklist exactly.</span>
          </button>
          <button
            disabled={busy}
            onClick={() => handleEnable("both")}
            className="rounded-md px-2 py-1.5 text-left hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10"
          >
            <span className="block font-medium text-black dark:text-white">Both (merge)</span>
            <span className="block text-black/50 dark:text-white/50">Items missing from either side get added to the other.</span>
          </button>
          <button
            onClick={() => setShowOptions(false)}
            className="rounded-md px-2 py-1.5 text-left text-black/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/10"
          >
            Cancel
          </button>
          {busy && <p className="px-2 py-1 text-black/40 dark:text-white/40">Syncing...</p>}
        </div>
      )}
    </div>
  );
}
