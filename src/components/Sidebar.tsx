"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createSemester, updateSemester, deleteSemester } from "@/actions/semesters";
import {
  listCoursesWithProgressForSemester,
  getCourse,
  createCourse,
  updateCourseName,
  deleteCourse,
} from "@/actions/courses";
import { LogoutButton } from "@/components/LogoutButton";
import { ProgressBar } from "@/components/ProgressBar";
import { useCourseProgressMap } from "@/components/CourseProgressContext";
import { useTemplateItemCount } from "@/components/TemplateItemCountContext";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  BookIcon,
  LockIcon,
  UnlockIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";
import { LAST_VISITED_KEY } from "@/lib/storage";

function CourseProgressRing({
  done,
  total,
  size = 36,
  children,
}: {
  done: number;
  total: number;
  size?: number;
  children: React.ReactNode;
}) {
  const pct = total > 0 ? done / total : 0;
  const strokeWidth = 2.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-black/10 dark:stroke-white/10"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="stroke-emerald-500 transition-[stroke-dashoffset]"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

function CollapsedSidebar({
  courses,
  activeCourseId,
  isTemplateActive,
  onExpand,
}: {
  courses: Course[];
  activeCourseId: string | undefined;
  isTemplateActive: boolean;
  onExpand: () => void;
}) {
  const templateItemCount = useTemplateItemCount();

  return (
    <div className="flex h-screen w-14 flex-shrink-0 flex-col items-center border-r border-black/10 bg-neutral-50/80 py-3 dark:border-white/10 dark:bg-neutral-950">
      <button
        onClick={onExpand}
        aria-label="Expand sidebar"
        title="Expand sidebar"
        className="rounded-md p-2 text-black/50 transition-colors hover:bg-black/5 hover:text-black dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
      >
        <ChevronRightIcon />
      </button>

      <nav className="mt-3 flex w-full flex-1 flex-col items-center gap-2 overflow-y-auto px-1 py-1">
        {courses.map((course) => (
          <Link
            key={course.id}
            href={`/courses/${course.id}`}
            title={`${course.name} — ${course.totalCount > 0 ? Math.round((course.doneCount / course.totalCount) * 100) : 0}% (${course.doneCount}/${course.totalCount})`}
            aria-label={course.name}
            className={`inline-flex rounded-full transition-transform hover:scale-105 ${
              activeCourseId === String(course.id)
                ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-neutral-50 dark:ring-offset-neutral-950"
                : ""
            }`}
          >
            <CourseProgressRing done={course.doneCount} total={course.totalCount}>
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                style={{ backgroundColor: courseColor(course.id) }}
              >
                {courseInitials(course.name)}
              </div>
            </CourseProgressRing>
          </Link>
        ))}
      </nav>

      <div className="flex flex-col items-center gap-1.5 border-t border-black/10 pt-3 dark:border-white/10">
        <Link
          href="/template"
          title={`Master Template (${templateItemCount} ${templateItemCount === 1 ? "item" : "items"})`}
          aria-label={`Master Template (${templateItemCount} ${templateItemCount === 1 ? "item" : "items"})`}
          className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
            isTemplateActive
              ? "bg-blue-600 text-white"
              : "text-black/60 hover:bg-black/5 hover:text-black dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
          }`}
        >
          <BookIcon />
        </Link>
        <LogoutButton iconOnly />
      </div>
    </div>
  );
}

type Semester = { id: number; name: string; startDate: string; endDate: string | null };
type Course = { id: number; name: string; doneCount: number; totalCount: number; autoSync: boolean };

const AVATAR_COLORS = ["#2563eb", "#7c3aed", "#db2777", "#dc2626", "#ea580c", "#65a30d", "#0d9488", "#0891b2"];

function courseColor(id: number) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

function courseInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function semesterIdFromPathname(path: string): number | null {
  const match = path.match(/^\/semesters\/(\d+)/);
  return match ? Number(match[1]) : null;
}

export function Sidebar({ semesters }: { semesters: Semester[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const progressOverrides = useCourseProgressMap();
  const templateItemCount = useTemplateItemCount();

  const [collapsed, setCollapsed] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(
    () => semesterIdFromPathname(pathname) ?? semesters[0]?.id ?? null
  );
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(() => selectedSemesterId !== null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editName, setEditName] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [showAddCourseForm, setShowAddCourseForm] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseAutoSync, setNewCourseAutoSync] = useState(false);
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [courseError, setCourseError] = useState<string | null>(null);
  const [editingCourseId, setEditingCourseId] = useState<number | null>(null);
  const [editCourseName, setEditCourseName] = useState("");

  // Record wherever the user currently is so signing back in after a sign-out can
  // return them here (sign-out destroys all in-memory state, so this needs localStorage).
  useEffect(() => {
    window.localStorage.setItem(LAST_VISITED_KEY, pathname);
  }, [pathname]);

  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setShowAddForm(false);
    setNewName("");
    setNewStartDate("");
    setNewEndDate("");
    setShowEditForm(false);
    setShowAddCourseForm(false);
    setNewCourseName("");
    setNewCourseAutoSync(false);
    setCreatingCourse(false);
    setEditingCourseId(null);
    const derived = semesterIdFromPathname(pathname);
    if (derived !== null && derived !== selectedSemesterId) {
      setSelectedSemesterId(derived);
      setCourses([]);
      setLoadingCourses(true);
    }
  }

  // Course pages don't encode their semester in the URL, so resolve it async and
  // always refresh the course list (it may have just gained a newly-added course).
  useEffect(() => {
    const courseMatch = pathname.match(/^\/courses\/(\d+)/);
    if (!courseMatch) return;
    let cancelled = false;
    getCourse(Number(courseMatch[1])).then((course) => {
      if (cancelled || !course) return;
      setSelectedSemesterId(course.semesterId);
      setLoadingCourses(true);
      listCoursesWithProgressForSemester(course.semesterId).then((result) => {
        if (!cancelled) {
          setCourses(result);
          setLoadingCourses(false);
        }
      });
    });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    if (selectedSemesterId === null) return;
    let cancelled = false;
    listCoursesWithProgressForSemester(selectedSemesterId).then((result) => {
      if (!cancelled) {
        setCourses(result);
        setLoadingCourses(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedSemesterId]);

  function handleSemesterChange(value: string) {
    setSelectedSemesterId(Number(value));
    setCourses([]);
    setLoadingCourses(true);
    setShowAddForm(false);
    setShowEditForm(false);
  }

  function handleOpenAddSemester() {
    setShowAddForm(true);
    setShowEditForm(false);
  }

  async function handleCreateSemester(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const created = await createSemester({ name: newName, startDate: newStartDate, endDate: newEndDate });
      router.refresh();
      setSelectedSemesterId(created.id);
      setCourses([]);
      setLoadingCourses(true);
      setShowAddForm(false);
      setNewName("");
      setNewStartDate("");
      setNewEndDate("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create semester.");
    } finally {
      setCreating(false);
    }
  }

  function handleOpenEditSemester() {
    const semester = semesters.find((s) => s.id === selectedSemesterId);
    if (!semester) return;
    setEditName(semester.name);
    setEditStartDate(semester.startDate);
    setEditEndDate(semester.endDate ?? "");
    setEditError(null);
    setShowEditForm(true);
    setShowAddForm(false);
  }

  async function handleSaveEditSemester(e: React.FormEvent) {
    e.preventDefault();
    if (selectedSemesterId === null) return;
    setSavingEdit(true);
    setEditError(null);
    try {
      await updateSemester(selectedSemesterId, { name: editName, startDate: editStartDate, endDate: editEndDate });
      router.refresh();
      setShowEditForm(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update semester.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleCreateCourse(e: React.FormEvent) {
    e.preventDefault();
    if (selectedSemesterId === null) return;
    setCreatingCourse(true);
    setCourseError(null);
    try {
      await createCourse({ semesterId: selectedSemesterId, name: newCourseName, autoSync: newCourseAutoSync });
    } catch (err) {
      const digest = (err as { digest?: string })?.digest;
      if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) throw err;
      setCourseError(err instanceof Error ? err.message : "Failed to create course.");
      setCreatingCourse(false);
    }
  }

  async function handleDeleteCourse(id: number, name: string) {
    if (!confirm(`Delete "${name}" and its checklist?`)) return;
    setCourses((prev) => prev.filter((c) => c.id !== id));
    await deleteCourse(id);
    if (pathname === `/courses/${id}`) {
      router.push("/");
    }
  }

  function startEditCourse(course: Course) {
    setEditingCourseId(course.id);
    setEditCourseName(course.name);
  }

  async function handleSaveCourseName(id: number) {
    const trimmed = editCourseName.trim();
    setEditingCourseId(null);
    if (!trimmed) return;
    setCourses((prev) => prev.map((c) => (c.id === id ? { ...c, name: trimmed } : c)));
    await updateCourseName(id, trimmed);
    router.refresh();
  }

  async function handleDeleteSemester() {
    if (selectedSemesterId === null) return;
    const semester = semesters.find((s) => s.id === selectedSemesterId);
    if (!semester) return;
    if (!confirm(`Delete "${semester.name}" and all its courses?`)) return;

    const deletedId = selectedSemesterId;
    await deleteSemester(deletedId);
    router.refresh();

    const remaining = semesters.filter((s) => s.id !== deletedId);
    const next = remaining[0]?.id ?? null;
    setSelectedSemesterId(next);
    setCourses([]);
    setLoadingCourses(next !== null);
    if (pathname.startsWith("/courses/")) {
      router.push("/");
    }
  }

  const activeCourseId = pathname.match(/^\/courses\/(\d+)/)?.[1];

  const liveCourses = courses.map((course) => {
    const override = progressOverrides[course.id];
    return override ? { ...course, doneCount: override.done, totalCount: override.total } : course;
  });

  if (collapsed) {
    return (
      <CollapsedSidebar
        courses={liveCourses}
        activeCourseId={activeCourseId}
        isTemplateActive={pathname === "/template"}
        onExpand={() => setCollapsed(false)}
      />
    );
  }

  return (
    <div className="flex h-screen w-64 flex-shrink-0 flex-col border-r border-black/10 bg-neutral-50/80 dark:border-white/10 dark:bg-neutral-950">
      <div className="flex items-center justify-between px-4 py-4">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Class Prep
        </Link>
        <button
          onClick={() => setCollapsed(true)}
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
          className="rounded-md p-1.5 text-black/40 transition-colors hover:bg-black/5 hover:text-black dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <ChevronLeftIcon />
        </button>
      </div>

      <div className="px-3">
        <div className="group mb-1 flex items-center gap-1 px-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">
            Semester
          </p>
          <button
            onClick={handleOpenAddSemester}
            aria-label="Add semester"
            title="Add semester"
            className="rounded p-0.5 text-black/40 hover:bg-black/5 hover:text-blue-600 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-blue-400"
          >
            <PlusIcon />
          </button>
          {selectedSemesterId !== null && (
            <button
              onClick={handleOpenEditSemester}
              aria-label="Edit semester"
              title="Edit semester"
              className="rounded p-0.5 text-black/40 opacity-0 transition-opacity hover:bg-black/5 hover:text-blue-600 group-hover:opacity-100 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-blue-400"
            >
              <PencilIcon />
            </button>
          )}
          {selectedSemesterId !== null && (
            <button
              onClick={handleDeleteSemester}
              aria-label="Delete semester"
              title="Delete semester"
              className="rounded p-0.5 text-black/40 opacity-0 transition-opacity hover:bg-black/5 hover:text-red-600 group-hover:opacity-100 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-red-400"
            >
              <TrashIcon />
            </button>
          )}
        </div>
        <select
          value={selectedSemesterId ?? ""}
          onChange={(e) => handleSemesterChange(e.target.value)}
          className="w-full cursor-pointer rounded-lg border border-black/10 bg-white px-2.5 py-2 text-sm font-medium shadow-sm outline-none transition-shadow focus:ring-2 focus:ring-blue-500/40 dark:border-white/10 dark:bg-neutral-900"
        >
          {semesters.length === 0 && <option value="">No semesters yet</option>}
          {semesters.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleCreateSemester}
          className="mx-3 mt-2 flex flex-col gap-2 rounded-lg border border-dashed border-black/15 p-2.5 dark:border-white/20"
        >
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Semester name"
            autoFocus
            className="rounded-md border border-black/15 px-2 py-1.5 text-sm dark:border-white/20 dark:bg-black"
          />
          <label className="flex flex-col gap-1 text-xs text-black/50 dark:text-white/50">
            Start date
            <input
              type="date"
              value={newStartDate}
              onChange={(e) => setNewStartDate(e.target.value)}
              className="rounded-md border border-black/15 px-2 py-1.5 text-sm dark:border-white/20 dark:bg-black"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-black/50 dark:text-white/50">
            End date
            <input
              type="date"
              value={newEndDate}
              onChange={(e) => setNewEndDate(e.target.value)}
              min={newStartDate || undefined}
              className="rounded-md border border-black/15 px-2 py-1.5 text-sm dark:border-white/20 dark:bg-black"
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={creating || !newName.trim() || !newStartDate || !newEndDate}
              className="rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white"
            >
              Cancel
            </button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </form>
      )}

      {showEditForm && (
        <form
          onSubmit={handleSaveEditSemester}
          className="mx-3 mt-2 flex flex-col gap-2 rounded-lg border border-dashed border-black/15 p-2.5 dark:border-white/20"
        >
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Semester name"
            autoFocus
            className="rounded-md border border-black/15 px-2 py-1.5 text-sm dark:border-white/20 dark:bg-black"
          />
          <label className="flex flex-col gap-1 text-xs text-black/50 dark:text-white/50">
            Start date
            <input
              type="date"
              value={editStartDate}
              onChange={(e) => setEditStartDate(e.target.value)}
              className="rounded-md border border-black/15 px-2 py-1.5 text-sm dark:border-white/20 dark:bg-black"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-black/50 dark:text-white/50">
            End date
            <input
              type="date"
              value={editEndDate}
              onChange={(e) => setEditEndDate(e.target.value)}
              min={editStartDate || undefined}
              className="rounded-md border border-black/15 px-2 py-1.5 text-sm dark:border-white/20 dark:bg-black"
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={savingEdit || !editName.trim() || !editStartDate || !editEndDate}
              className="rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setShowEditForm(false)}
              className="text-xs text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white"
            >
              Cancel
            </button>
          </div>
          {editError && <p className="text-xs text-red-600">{editError}</p>}
        </form>
      )}

      <div className="mt-3 flex-1 overflow-y-auto px-3">
        {selectedSemesterId !== null && (
          <>
            <div className="flex items-center gap-1 px-2 pb-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">
                Courses
              </p>
              <button
                onClick={() => setShowAddCourseForm((prev) => !prev)}
                aria-label="Add course"
                title="Add course"
                className="rounded p-0.5 text-black/40 hover:bg-black/5 hover:text-blue-600 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-blue-400"
              >
                <PlusIcon />
              </button>
            </div>

            {showAddCourseForm && (
              <form
                onSubmit={handleCreateCourse}
                className="mb-2 flex flex-col gap-2 rounded-lg border border-dashed border-black/15 p-2.5 dark:border-white/20"
              >
                <input
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  placeholder="Course name"
                  autoFocus
                  className="rounded-md border border-black/15 px-2 py-1.5 text-sm dark:border-white/20 dark:bg-black"
                />
                <label className="flex items-start gap-1.5 text-xs text-black/60 dark:text-white/60">
                  <input
                    type="checkbox"
                    checked={newCourseAutoSync}
                    onChange={(e) => setNewCourseAutoSync(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    Lock &amp; auto-sync with Master Template
                    <span className="block text-black/40 dark:text-white/40">
                      Checklist mirrors the template automatically; you can only mark items done/N&#47;A.
                    </span>
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={creatingCourse || !newCourseName.trim()}
                    className="rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddCourseForm(false)}
                    className="text-xs text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
                {courseError && <p className="text-xs text-red-600">{courseError}</p>}
              </form>
            )}

            <nav className="flex flex-col gap-0.5">
              {liveCourses.map((course) => {
                const isActive = activeCourseId === String(course.id);
                return (
                  <div
                    key={course.id}
                    className={`group relative flex flex-col gap-1 rounded-md px-2.5 py-1.5 transition-colors ${
                      isActive ? "bg-blue-600" : "hover:bg-black/5 dark:hover:bg-white/10"
                    }`}
                  >
                    {editingCourseId !== course.id && (
                      <Link
                        href={`/courses/${course.id}`}
                        aria-label={course.name}
                        className="absolute inset-0 rounded-md"
                      />
                    )}
                    <div className="flex items-center gap-1">
                      {editingCourseId === course.id ? (
                        <>
                          <input
                            value={editCourseName}
                            onChange={(e) => setEditCourseName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleSaveCourseName(course.id);
                              }
                              if (e.key === "Escape") {
                                e.preventDefault();
                                setEditingCourseId(null);
                              }
                            }}
                            autoFocus
                            className="relative min-w-0 flex-1 rounded-md border border-black/15 px-1.5 py-0.5 text-sm dark:border-white/20 dark:bg-black"
                          />
                          <button
                            onClick={() => handleSaveCourseName(course.id)}
                            className={`relative text-xs hover:underline ${
                              isActive ? "text-white" : "text-blue-600 dark:text-blue-400"
                            }`}
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingCourseId(null)}
                            className={`relative text-xs hover:underline ${
                              isActive ? "text-white/70 hover:text-white" : "text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white"
                            }`}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <span
                            className={`pointer-events-none min-w-0 truncate text-sm ${
                              isActive ? "text-white" : "text-black/70 dark:text-white/70"
                            }`}
                          >
                            {course.name}
                          </span>
                          <button
                            onClick={() => startEditCourse(course)}
                            aria-label="Edit course"
                            title="Edit course"
                            className="relative flex-shrink-0 rounded p-1 text-black/40 opacity-0 transition-opacity hover:bg-black/5 hover:text-blue-600 group-hover:opacity-100 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-blue-400"
                          >
                            <PencilIcon />
                          </button>
                          <button
                            onClick={() => handleDeleteCourse(course.id, course.name)}
                            aria-label="Delete course"
                            title="Delete course"
                            className="relative flex-shrink-0 rounded p-1 text-black/40 opacity-0 transition-opacity hover:bg-black/5 hover:text-red-600 group-hover:opacity-100 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-red-400"
                          >
                            <TrashIcon />
                          </button>
                          <span
                            aria-label={course.autoSync ? "Locked and auto-synced with Master Template" : "Not synced with Master Template"}
                            title={course.autoSync ? "Locked · auto-synced with Master Template" : "Not synced with Master Template"}
                            className={`ml-auto flex-shrink-0 ${
                              course.autoSync
                                ? "text-emerald-500 dark:text-emerald-400"
                                : isActive
                                  ? "text-white/40"
                                  : "text-black/25 dark:text-white/25"
                            }`}
                          >
                            {course.autoSync ? <LockIcon /> : <UnlockIcon />}
                          </span>
                        </>
                      )}
                    </div>
                    <ProgressBar
                      done={course.doneCount}
                      total={course.totalCount}
                      size="sm"
                      invert={isActive}
                      className="pointer-events-none"
                    />
                  </div>
                );
              })}
              {!loadingCourses && courses.length === 0 && (
                <p className="px-2.5 py-1.5 text-xs text-black/40 dark:text-white/40">No courses yet.</p>
              )}
            </nav>
          </>
        )}
      </div>

      <div className="border-t border-black/10 px-3 py-3 dark:border-white/10">
        <Link
          href="/template"
          className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
            pathname === "/template"
              ? "bg-blue-600 text-white"
              : "text-black/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/10"
          }`}
        >
          <BookIcon /> Master Template
          <span
            className={`ml-auto text-xs ${pathname === "/template" ? "text-white/70" : "text-black/40 dark:text-white/40"}`}
          >
            {templateItemCount} {templateItemCount === 1 ? "item" : "items"}
          </span>
        </Link>
        <div className="mt-2 px-2.5">
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
