"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Progress = { done: number; total: number };
type ProgressMap = Record<number, Progress>;
type ReportFn = (courseId: number, done: number, total: number) => void;

const ProgressStateContext = createContext<ProgressMap>({});
const ProgressReportContext = createContext<ReportFn>(() => {});

export function CourseProgressProvider({ children }: { children: React.ReactNode }) {
  const [progress, setProgress] = useState<ProgressMap>({});

  const report = useCallback<ReportFn>((courseId, done, total) => {
    setProgress((prev) => {
      const existing = prev[courseId];
      if (existing && existing.done === done && existing.total === total) return prev;
      return { ...prev, [courseId]: { done, total } };
    });
  }, []);

  return (
    <ProgressReportContext.Provider value={report}>
      <ProgressStateContext.Provider value={progress}>{children}</ProgressStateContext.Provider>
    </ProgressReportContext.Provider>
  );
}

/** Sidebar-side: read live overrides, keyed by course id, to merge on top of fetched data. */
export function useCourseProgressMap() {
  return useContext(ProgressStateContext);
}

/** Course-page-side: report this course's current done/total whenever they change. */
export function useReportCourseProgress(courseId: number, done: number, total: number) {
  const report = useContext(ProgressReportContext);
  useEffect(() => {
    report(courseId, done, total);
  }, [report, courseId, done, total]);
}
