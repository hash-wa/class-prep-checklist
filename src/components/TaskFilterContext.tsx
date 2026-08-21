"use client";

import { createContext, useCallback, useContext, useSyncExternalStore } from "react";
import { TASK_FILTERS_KEY } from "@/lib/storage";

type Filters = { hideNA: boolean; hideDone: boolean };
type SetFilter = (value: boolean | ((prev: boolean) => boolean)) => void;

const DEFAULT_FILTERS: Filters = { hideNA: false, hideDone: false };

const listeners = new Set<() => void>();

function readRaw(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(TASK_FILTERS_KEY) ?? "";
}

function getServerSnapshot(): string {
  return "";
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

function parseFilters(raw: string): Filters {
  if (!raw) return DEFAULT_FILTERS;
  try {
    const parsed = JSON.parse(raw);
    return { hideNA: !!parsed.hideNA, hideDone: !!parsed.hideDone };
  } catch {
    return DEFAULT_FILTERS;
  }
}

function writeFilters(filters: Filters) {
  window.localStorage.setItem(TASK_FILTERS_KEY, JSON.stringify(filters));
  listeners.forEach((listener) => listener());
}

type TaskFilterContextValue = {
  hideNA: boolean;
  hideDone: boolean;
  setHideNA: SetFilter;
  setHideDone: SetFilter;
};

const TaskFilterContext = createContext<TaskFilterContextValue | null>(null);

/**
 * Lives in the layout (not the per-course page) and reads/writes localStorage
 * directly, so "Hide N/A"/"Hide Done" survive both switching courses and a full
 * sign-out/sign-in cycle, which destroys any in-memory React state.
 */
export function TaskFilterProvider({ children }: { children: React.ReactNode }) {
  const raw = useSyncExternalStore(subscribe, readRaw, getServerSnapshot);
  const filters = parseFilters(raw);

  const setHideNA = useCallback<SetFilter>((value) => {
    const current = parseFilters(readRaw());
    const next = typeof value === "function" ? value(current.hideNA) : value;
    writeFilters({ ...current, hideNA: next });
  }, []);

  const setHideDone = useCallback<SetFilter>((value) => {
    const current = parseFilters(readRaw());
    const next = typeof value === "function" ? value(current.hideDone) : value;
    writeFilters({ ...current, hideDone: next });
  }, []);

  return (
    <TaskFilterContext.Provider
      value={{ hideNA: filters.hideNA, hideDone: filters.hideDone, setHideNA, setHideDone }}
    >
      {children}
    </TaskFilterContext.Provider>
  );
}

export function useTaskFilters() {
  const ctx = useContext(TaskFilterContext);
  if (!ctx) throw new Error("useTaskFilters must be used within TaskFilterProvider");
  return ctx;
}
