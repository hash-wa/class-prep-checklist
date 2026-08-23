"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type ReportFn = (count: number) => void;

const CountContext = createContext<number>(0);
const ReportContext = createContext<ReportFn>(() => {});

/**
 * Lives in the layout, seeded with the server-fetched count so the sidebar shows the right
 * number even before the Master Template page (the only place that reports live updates) has
 * mounted. The template page's own heading doesn't need this — it re-renders with a fresh
 * count automatically via revalidatePath — but the sidebar is a sibling of that page's route,
 * so it can't see those updates without something reporting them up.
 */
export function TemplateItemCountProvider({
  initialCount,
  children,
}: {
  initialCount: number;
  children: React.ReactNode;
}) {
  const [count, setCount] = useState(initialCount);

  const report = useCallback<ReportFn>((next) => {
    setCount((prev) => (prev === next ? prev : next));
  }, []);

  return (
    <ReportContext.Provider value={report}>
      <CountContext.Provider value={count}>{children}</CountContext.Provider>
    </ReportContext.Provider>
  );
}

export function useTemplateItemCount() {
  return useContext(CountContext);
}

export function useReportTemplateItemCount(count: number) {
  const report = useContext(ReportContext);
  useEffect(() => {
    report(count);
  }, [report, count]);
}
