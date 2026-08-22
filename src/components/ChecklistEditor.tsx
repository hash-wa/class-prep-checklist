"use client";

import { Fragment, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  addCustomTask,
  addTaskFromTemplate,
  updateTask,
  deleteTask,
  reorderTasks,
  moveTasksToSection,
  bulkSetTasksOffset,
  bulkDeleteTasks,
  toggleSubItemDone,
  createCourseSection,
  renameCourseSection,
  deleteCourseSection,
  reorderCourseSections,
} from "@/actions/tasks";
import {
  offsetDaysToWeeksDays,
  weeksDaysToOffsetDays,
  resolveDueDate,
  formatDateFriendly,
  formatDateShort,
  formatWeekdayLetter,
  daysUntil,
  type DueDateAnchor,
  type WeeksDaysOffset,
} from "@/lib/dates";
import { formatOffsetLabel } from "@/lib/format";
import { groupBySection, buildReorderBuckets } from "@/lib/sections";
import { multiContainerCollisionDetection } from "@/lib/dnd";
import { getSectionColorStyle } from "@/lib/sectionColors";
import { OffsetInput } from "@/components/OffsetInput";
import { DragHandle } from "@/components/DragHandle";
import { DeleteButton } from "@/components/DeleteButton";
import { SectionHeader } from "@/components/SectionHeader";
import { SubItemEditor } from "@/components/SubItemEditor";
import { MarkdownContent } from "@/components/MarkdownContent";
import { BulkActionsToolbar } from "@/components/BulkActionsToolbar";
import { ProgressBar } from "@/components/ProgressBar";
import { useReportCourseProgress } from "@/components/CourseProgressContext";
import { useTaskFilters } from "@/components/TaskFilterContext";
import { PencilIcon, PlusIcon } from "@/components/icons";

type SubItem = { id: number; text: string; position: number; done: boolean };

type Task = {
  id: number;
  title: string;
  description: string | null;
  offsetDays: number;
  dueDateAnchor: DueDateAnchor;
  position: number;
  sectionId: number | null;
  done: boolean;
  irrelevant: boolean;
  sourceTemplateItemId: number | null;
  subItems: SubItem[];
};

type CourseSection = { id: number; title: string; position: number };
type AvailableTemplateItem = { id: number; title: string; offsetDays: number; dueDateAnchor: DueDateAnchor };
type InsertGapState = { sectionId: number | null; afterId: number | null } | null;
type SectionInsertState = { afterId: number | null } | null;

export function ChecklistEditor({
  courseId,
  semesterStartDate,
  semesterEndDate,
  sections: initialSections,
  tasks: initialTasks,
  availableTemplateItems,
  locked = false,
}: {
  courseId: number;
  semesterStartDate: string;
  semesterEndDate: string | null;
  sections: CourseSection[];
  tasks: Task[];
  availableTemplateItems: AvailableTemplateItem[];
  locked?: boolean;
}) {
  const [sections, setSections] = useState(initialSections);
  const [prevInitialSections, setPrevInitialSections] = useState(initialSections);
  const [tasks, setTasks] = useState(initialTasks);
  const [prevInitialTasks, setPrevInitialTasks] = useState(initialTasks);
  const [sortMode, setSortMode] = useState<"manual" | "dueDate">("manual");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [collapsedSectionIds, setCollapsedSectionIds] = useState<Set<number>>(new Set());
  const [insertGap, setInsertGap] = useState<InsertGapState>(null);
  const [sectionInsertGap, setSectionInsertGap] = useState<SectionInsertState>(null);
  const [showDueDateAddForm, setShowDueDateAddForm] = useState(false);
  const [showNewSectionForm, setShowNewSectionForm] = useState(false);
  const { hideNA, setHideNA, hideDone, setHideDone } = useTaskFilters();
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  if (initialSections !== prevInitialSections) {
    setPrevInitialSections(initialSections);
    setSections(initialSections);
  }
  if (initialTasks !== prevInitialTasks) {
    setPrevInitialTasks(initialTasks);
    setTasks(initialTasks);
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const groups = groupBySection(sections, tasks);

  type TaskDragData = { type: "task"; taskId: number; sectionId: number | null };
  type TaskOverData = TaskDragData | { type: "sectionDrop"; sectionId: number | null };

  function computeMovedTasks(activeData: TaskDragData, overData: TaskOverData | undefined) {
    const destSectionId = overData?.sectionId;
    if (destSectionId === undefined) return null;

    const mutableGroups = groups.map((g) => ({ ...g, items: [...g.items] }));
    const sourceGroup = mutableGroups.find((g) => g.sectionId === activeData.sectionId);
    const destGroup = mutableGroups.find((g) => g.sectionId === destSectionId);
    if (!sourceGroup || !destGroup) return null;

    const sourceIndex = sourceGroup.items.findIndex((t) => t.id === activeData.taskId);
    if (sourceIndex === -1) return null;

    if (sourceGroup === destGroup) {
      // Same-section reorder: resolve the destination index from the array as it
      // currently stands (matching dnd-kit's own live-preview semantics) and use
      // arrayMove directly. Removing the item first and re-searching in the
      // mutated array — the previous approach — shifts every later index down by
      // one, so downward drags silently needed an extra slot to land correctly.
      let destIndex = sourceGroup.items.length - 1;
      if (overData?.type === "task") {
        const idx = sourceGroup.items.findIndex((t) => t.id === overData.taskId);
        if (idx !== -1) destIndex = idx;
      }
      sourceGroup.items = arrayMove(sourceGroup.items, sourceIndex, destIndex);
    } else {
      const [moving] = sourceGroup.items.splice(sourceIndex, 1);
      let destIndex = destGroup.items.length;
      if (overData?.type === "task") {
        const idx = destGroup.items.findIndex((t) => t.id === overData.taskId);
        if (idx !== -1) destIndex = idx;
      }
      destGroup.items.splice(destIndex, 0, { ...moving, sectionId: destSectionId });
    }

    const newTasks = mutableGroups.flatMap((g) =>
      g.items.map((t, idx) => ({ ...t, sectionId: g.sectionId, position: idx }))
    );
    return { newTasks, mutableGroups };
  }

  function handleDragStart(event: DragStartEvent) {
    const activeData = event.active.data.current as TaskDragData | undefined;
    setActiveTaskId(activeData?.taskId ?? null);
  }

  // Cross-section drags aren't part of the destination section's SortableContext until
  // committed, so without this dnd-kit shows no reflow/placeholder animation there. Move
  // the item into local state as soon as it crosses into a different section so the drop
  // target animates live; same-section hovers are already animated by dnd-kit itself.
  // The dragged row itself is rendered via DragOverlay (a stable, portal-rendered node) so
  // that re-parenting it between sections mid-drag doesn't disrupt the browser's pointer
  // capture on the real list item, which was causing stray clicks (e.g. toggling "done").
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeData = active.data.current as TaskDragData | undefined;
    if (!activeData) return;
    const overData = over.data.current as TaskOverData | undefined;
    const destSectionId = overData?.sectionId;
    if (destSectionId === undefined || destSectionId === activeData.sectionId) return;

    const result = computeMovedTasks(activeData, overData);
    if (result) setTasks(result.newTasks);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTaskId(null);
    const { active, over } = event;
    if (!over) return;
    const activeData = active.data.current as TaskDragData | undefined;
    if (!activeData) return;
    const overData = over.data.current as TaskOverData | undefined;

    const result = computeMovedTasks(activeData, overData);
    if (!result) return;
    setTasks(result.newTasks);

    const buckets = buildReorderBuckets(result.mutableGroups.map((g) => ({ sectionId: g.sectionId, items: g.items })));
    startTransition(() => {
      reorderTasks(courseId, buckets);
    });
  }

  function patchTask(id: number, patch: Partial<Task>) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function removeTask(id: number) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  // The newly created task always lands at the end of its section server-side; splice it into
  // the slot the user actually clicked (right after `afterId`, or at the very start when
  // `afterId` is null) and persist that via the same reorder path drag-and-drop already uses,
  // rather than teaching the create action about arbitrary insertion positions.
  function handleInsertedTask(sectionId: number | null, afterId: number | null, newTaskId: number) {
    setInsertGap(null);
    const group = groups.find((g) => g.sectionId === sectionId);
    if (!group) return;
    const ids = group.items.map((t) => t.id);
    let orderedIds: number[];
    if (afterId === null) {
      orderedIds = [newTaskId, ...ids];
    } else {
      const insertIndex = ids.indexOf(afterId);
      if (insertIndex === -1) return;
      orderedIds = [...ids.slice(0, insertIndex + 1), newTaskId, ...ids.slice(insertIndex + 1)];
    }
    startTransition(() => {
      reorderTasks(courseId, [{ sectionId, orderedIds }]);
    });
  }

  function toggleExpanded(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelected(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkMove(sectionId: number | null) {
    const ids = [...selectedIds];
    setSelectedIds(new Set());
    await moveTasksToSection(courseId, ids, sectionId);
  }

  async function handleBulkSetOffset(offsetDays: number, dueDateAnchor: DueDateAnchor) {
    const ids = [...selectedIds];
    setSelectedIds(new Set());
    setTasks((prev) => prev.map((t) => (ids.includes(t.id) ? { ...t, offsetDays, dueDateAnchor } : t)));
    await bulkSetTasksOffset(courseId, ids, offsetDays, dueDateAnchor);
  }

  async function handleBulkDelete() {
    const ids = [...selectedIds];
    setSelectedIds(new Set());
    setTasks((prev) => prev.filter((t) => !ids.includes(t.id)));
    await bulkDeleteTasks(courseId, ids);
  }

  function toggleSelectMode() {
    setSelectMode((prev) => !prev);
    setSelectedIds(new Set());
  }

  function toggleSectionCollapsed(sectionId: number) {
    setCollapsedSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  function moveSection(sectionId: number, direction: "up" | "down") {
    const index = sections.findIndex((s) => s.id === sectionId);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || targetIndex < 0 || targetIndex >= sections.length) return;
    const reordered = arrayMove(sections, index, targetIndex);
    setSections(reordered);
    startTransition(() => {
      reorderCourseSections(courseId, reordered.map((s) => s.id));
    });
  }

  // Mirrors handleInsertedTask: the new section always lands at the end server-side, so splice
  // it into the slot the user actually clicked and persist that via the existing section
  // reorder action.
  function handleInsertedSection(afterSectionId: number | null, newSectionId: number) {
    setSectionInsertGap(null);
    const ids = sections.map((s) => s.id);
    const insertIndex = afterSectionId === null ? -1 : ids.indexOf(afterSectionId);
    if (afterSectionId !== null && insertIndex === -1) return;
    const orderedIds = [...ids.slice(0, insertIndex + 1), newSectionId, ...ids.slice(insertIndex + 1)];
    startTransition(() => {
      reorderCourseSections(courseId, orderedIds);
    });
  }

  const relevantTasks = tasks.filter((t) => !t.irrelevant);
  const doneCount = relevantTasks.filter((t) => t.done).length;
  useReportCourseProgress(courseId, doneCount, relevantTasks.length);
  const tasksWithSubItems = tasks.filter((t) => t.subItems.length > 0);
  const hasNATasks = tasks.some((t) => t.irrelevant);
  const hasDoneTasks = tasks.some((t) => t.done);

  function visibleOf(items: Task[]) {
    return items.filter((t) => (!hideNA || !t.irrelevant) && (!hideDone || !t.done));
  }

  function emptyLabelFor(items: Task[], defaultLabel: string) {
    if ((hideNA || hideDone) && items.length > 0 && visibleOf(items).length === 0) {
      return "All tasks here are hidden (done/N/A).";
    }
    return defaultLabel;
  }

  function dueDateTime(task: Task): number {
    const date = resolveDueDate(semesterStartDate, semesterEndDate, task.offsetDays, task.dueDateAnchor);
    return date ? date.getTime() : Number.POSITIVE_INFINITY;
  }
  const dueDateSorted = [...tasks].sort((a, b) => dueDateTime(a) - dueDateTime(b));
  const activeDragTask = activeTaskId !== null ? tasks.find((t) => t.id === activeTaskId) ?? null : null;

  const toolbarGroups: React.ReactNode[] = [];
  if ((sortMode === "manual" && !locked) || hasNATasks || hasDoneTasks) {
    toolbarGroups.push(
      <div key="select-na" className="flex items-center gap-2">
        {sortMode === "manual" && !locked && (
          <button
            onClick={toggleSelectMode}
            className={`rounded-md px-2 py-1 text-xs ${selectMode ? "bg-blue-600 text-white" : "border border-black/15 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"}`}
          >
            {selectMode ? "Cancel selecting" : "Select tasks"}
          </button>
        )}
        {hasNATasks && (
          <button
            onClick={() => setHideNA((prev) => !prev)}
            className={`rounded-md px-2 py-1 text-xs ${hideNA ? "bg-blue-600 text-white" : "border border-black/15 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"}`}
          >
            {hideNA ? "Show N/A" : "Hide N/A"}
          </button>
        )}
        {hasDoneTasks && (
          <button
            onClick={() => setHideDone((prev) => !prev)}
            className={`rounded-md px-2 py-1 text-xs ${hideDone ? "bg-blue-600 text-white" : "border border-black/15 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"}`}
          >
            {hideDone ? "Show Done" : "Hide Done"}
          </button>
        )}
      </div>
    );
  }
  if (tasksWithSubItems.length > 0) {
    toolbarGroups.push(
      <div key="expand-collapse" className="flex items-center gap-3 text-xs">
        <button
          onClick={() => setExpandedIds(new Set(tasksWithSubItems.map((t) => t.id)))}
          className="text-blue-600 hover:underline"
        >
          Expand all
        </button>
        <button onClick={() => setExpandedIds(new Set())} className="text-blue-600 hover:underline">
          Collapse all
        </button>
      </div>
    );
  }
  const toolbarItems: React.ReactNode[] = [];
  toolbarGroups.forEach((group, i) => {
    if (i > 0) toolbarItems.push(<span key={`div-${i}`} className="h-4 w-px bg-black/10 dark:bg-white/10" />);
    toolbarItems.push(group);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex flex-wrap items-center gap-3">{toolbarItems}</div>
        <div className="flex items-center gap-2">
          <span className="text-black/50 dark:text-white/50">Sort:</span>
          <button
            onClick={() => setSortMode("manual")}
            className={`rounded-md px-2 py-1 ${sortMode === "manual" ? "bg-blue-600 text-white" : "text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"}`}
          >
            Manual
          </button>
          <button
            onClick={() => {
              setSortMode("dueDate");
              setSelectMode(false);
              setSelectedIds(new Set());
            }}
            className={`rounded-md px-2 py-1 ${sortMode === "dueDate" ? "bg-blue-600 text-white" : "text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"}`}
          >
            Due date
          </button>
        </div>
      </div>

      {sortMode === "manual" && selectMode && !locked && (
        <BulkActionsToolbar
          count={selectedIds.size}
          sections={sections}
          onMove={handleBulkMove}
          onSetOffset={handleBulkSetOffset}
          onDelete={handleBulkDelete}
          onClear={() => setSelectedIds(new Set())}
          itemLabel="task"
        />
      )}

      <ProgressBar done={doneCount} total={relevantTasks.length} />

      {sortMode === "dueDate" ? (
        <div>
          {!locked && (
            <div className="mb-2 flex items-center justify-end">
              <button
                onClick={() => setShowDueDateAddForm((prev) => !prev)}
                aria-label="Add task"
                title="Add task"
                className="flex items-center gap-1 rounded p-1 text-sm text-black/40 hover:bg-black/5 hover:text-blue-600 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-blue-400"
              >
                <PlusIcon /> Add task
              </button>
            </div>
          )}
          {showDueDateAddForm && !locked && (
            <div className="mb-2">
              <AddTaskForm
                courseId={courseId}
                sections={sections}
                availableTemplateItems={availableTemplateItems}
                onCancel={() => setShowDueDateAddForm(false)}
              />
            </div>
          )}
          <ul className="divide-y divide-black/10 rounded-lg border border-black/10 dark:divide-white/10 dark:border-white/10">
            {visibleOf(dueDateSorted).map((task) => (
              <SortableTaskRow
                key={task.id}
                task={task}
                courseId={courseId}
                semesterStartDate={semesterStartDate}
                semesterEndDate={semesterEndDate}
                draggable={false}
                locked={locked}
                onPatch={patchTask}
                onRemove={removeTask}
                expanded={expandedIds.has(task.id)}
                onToggleExpanded={() => toggleExpanded(task.id)}
              />
            ))}
            {visibleOf(dueDateSorted).length === 0 && (
              <EmptyState label={emptyLabelFor(dueDateSorted, "No tasks yet.")} />
            )}
          </ul>
        </div>
      ) : (
        <DndContext
          id="course-checklist"
          sensors={sensors}
          collisionDetection={multiContainerCollisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-col">
            <SectionDropZone sectionId={null}>
              <div className="mb-0.5 flex items-center gap-2 px-1">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-black/70 dark:text-white/70">
                  Inbox{" "}
                  <span className="font-normal normal-case text-black/40 dark:text-white/40">
                    ({visibleOf(groups.find((g) => g.sectionId === null)?.items ?? []).length})
                  </span>
                </h3>
              </div>
              <TaskList
                tasks={visibleOf(groups.find((g) => g.sectionId === null)?.items ?? [])}
                courseId={courseId}
                semesterStartDate={semesterStartDate}
                semesterEndDate={semesterEndDate}
                locked={locked}
                sectionId={null}
                sections={sections}
                availableTemplateItems={availableTemplateItems}
                insertGap={insertGap}
                onToggleInsert={setInsertGap}
                onInserted={handleInsertedTask}
                onPatch={patchTask}
                onRemove={removeTask}
                expandedIds={expandedIds}
                onToggleExpanded={toggleExpanded}
                selectMode={selectMode}
                selectedIds={selectedIds}
                onToggleSelected={toggleSelected}
                emptyLabel={emptyLabelFor(groups.find((g) => g.sectionId === null)?.items ?? [], "Inbox is empty.")}
              />
            </SectionDropZone>

            {sections.length > 0 && (
              locked ? (
                <div className="h-8" />
              ) : (
                <SectionInsertGap
                  active={sectionInsertGap?.afterId === null}
                  onOpen={() => setSectionInsertGap({ afterId: null })}
                >
                  <NewSectionForm
                    courseId={courseId}
                    onCancel={() => setSectionInsertGap(null)}
                    onCreated={(newId) => handleInsertedSection(null, newId)}
                  />
                </SectionInsertGap>
              )
            )}

            {groups
              .filter((g) => g.section !== null)
              .map((group) => {
                const section = group.section!;
                const sectionIndex = sections.findIndex((s) => s.id === section.id);
                const collapsed = collapsedSectionIds.has(section.id);
                return (
                  <Fragment key={section.id}>
                    <SectionBlock
                      sectionId={section.id}
                      title={section.title}
                      count={visibleOf(group.items).length}
                      collapsed={collapsed}
                      colorIndex={section.id}
                      locked={locked}
                      onToggleCollapsed={() => toggleSectionCollapsed(section.id)}
                      onRename={(title) => renameCourseSection(section.id, courseId, title)}
                      onDelete={() => {
                        if (!confirm(`Delete section "${section.title}"? Tasks move to Unsectioned.`)) return;
                        setSections((prev) => prev.filter((s) => s.id !== section.id));
                        deleteCourseSection(section.id, courseId);
                      }}
                      onMoveUp={() => moveSection(section.id, "up")}
                      onMoveDown={() => moveSection(section.id, "down")}
                      canMoveUp={sectionIndex > 0}
                      canMoveDown={sectionIndex < sections.length - 1}
                    >
                      <TaskList
                        tasks={visibleOf(group.items)}
                        courseId={courseId}
                        semesterStartDate={semesterStartDate}
                        semesterEndDate={semesterEndDate}
                        locked={locked}
                        sectionId={section.id}
                        sectionColorIndex={section.id}
                        sections={sections}
                        availableTemplateItems={availableTemplateItems}
                        insertGap={insertGap}
                        onToggleInsert={setInsertGap}
                        onInserted={handleInsertedTask}
                        onPatch={patchTask}
                        onRemove={removeTask}
                        expandedIds={expandedIds}
                        onToggleExpanded={toggleExpanded}
                        selectMode={selectMode}
                        selectedIds={selectedIds}
                        onToggleSelected={toggleSelected}
                        emptyLabel={emptyLabelFor(group.items, "No tasks in this section yet.")}
                      />
                    </SectionBlock>
                    {locked ? (
                      <div className="h-8" />
                    ) : (
                      <SectionInsertGap
                        active={sectionInsertGap?.afterId === section.id}
                        onOpen={() => setSectionInsertGap({ afterId: section.id })}
                      >
                        <NewSectionForm
                          courseId={courseId}
                          onCancel={() => setSectionInsertGap(null)}
                          onCreated={(newId) => handleInsertedSection(section.id, newId)}
                        />
                      </SectionInsertGap>
                    )}
                  </Fragment>
                );
              })}
          </div>
          <DragOverlay>{activeDragTask && <TaskDragPreview task={activeDragTask} />}</DragOverlay>
        </DndContext>
      )}

      {!locked && sections.length === 0 && (
        showNewSectionForm ? (
          <NewSectionForm courseId={courseId} onCancel={() => setShowNewSectionForm(false)} />
        ) : (
          <button
            onClick={() => setShowNewSectionForm(true)}
            className="flex items-center gap-1 rounded-md border border-black/15 px-2 py-1.5 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            <PlusIcon /> Add section
          </button>
        )
      )}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <li className="px-4 py-6 text-center text-sm text-black/50 dark:text-white/50">{label}</li>;
}

function TaskDragPreview({ task }: { task: Task }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-black/10 bg-white px-3 py-2.5 shadow-lg dark:border-white/10 dark:bg-neutral-900">
      <span className="w-5 flex-shrink-0 text-center text-black/30 dark:text-white/30">⠿</span>
      <span className={`text-sm ${task.done ? "text-black/40 line-through dark:text-white/40" : ""}`}>{task.title}</span>
    </div>
  );
}

function DueDateBadge({
  dueDate,
  offsetDays,
  title,
}: {
  dueDate: Date;
  offsetDays: number;
  title?: string;
}) {
  const daysLeft = daysUntil(dueDate);
  const daysLabel = daysLeft === 0 ? "Due today" : daysLeft < 0 ? `Overdue ${Math.abs(daysLeft)}d` : `${daysLeft}d left`;

  // The task's own lead time (how far before/after start it's due) is its natural
  // countdown window: the bar fills as that window elapses, reaching full at the due date.
  const windowDays = Math.max(1, Math.abs(offsetDays));
  const ratio = Math.min(1, Math.max(0, (windowDays - daysLeft) / windowDays));

  let colorClass = "text-black/50 dark:text-white/50";
  let fillClass = "bg-black/30 dark:bg-white/30";
  if (daysLeft < 0) {
    colorClass = "text-red-600 dark:text-red-400";
    fillClass = "bg-red-500";
  } else if (daysLeft <= 2) {
    colorClass = "text-amber-600 dark:text-amber-400";
    fillClass = "bg-amber-500";
  }

  return (
    <span title={title} className={`flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap text-xs ${colorClass}`}>
      {formatWeekdayLetter(dueDate)} {formatDateShort(dueDate)} · {daysLabel}
      <span className="h-1.5 w-10 flex-shrink-0 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <span className={`block h-full rounded-full transition-[width] ${fillClass}`} style={{ width: `${ratio * 100}%` }} />
      </span>
    </span>
  );
}

function SectionDropZone({ sectionId, children }: { sectionId: number | null; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({
    id: `section-drop-${sectionId ?? "none"}`,
    data: { type: "sectionDrop", sectionId },
  });
  return <div ref={setNodeRef}>{children}</div>;
}

/** Same idea as the task-row InsertGap, but sized for the section-level whitespace: hovering
 *  the gap between two sections (or after the last one) reveals a "+" for adding a section
 *  right there, without changing that gap's existing size. */
function SectionInsertGap({
  active,
  onOpen,
  children,
}: {
  active: boolean;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  if (active) {
    return <div className="py-2">{children}</div>;
  }
  return (
    <div className="group flex h-10 items-center gap-2 pt-2">
      <span className="h-0 flex-1 border-t-2 border-dashed border-blue-400 opacity-0 transition-opacity group-hover:opacity-100" />
      <button
        onClick={onOpen}
        aria-label="Add new section here"
        title="Add new section here"
        className="flex flex-shrink-0 items-center gap-1 rounded-full bg-blue-500 px-3 py-1 text-xs font-medium text-white opacity-0 shadow transition-opacity hover:bg-blue-600 group-hover:opacity-100"
      >
        <PlusIcon /> Add new section here
      </button>
      <span className="h-0 flex-1 border-t-2 border-dashed border-blue-400 opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
  );
}

function SectionBlock({
  sectionId,
  title,
  count,
  collapsed,
  colorIndex,
  locked,
  onToggleCollapsed,
  onRename,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  children,
}: {
  sectionId: number;
  title: string;
  count: number;
  collapsed: boolean;
  colorIndex?: number;
  locked?: boolean;
  onToggleCollapsed: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  children: React.ReactNode;
}) {
  return (
    <SectionDropZone sectionId={sectionId}>
      <SectionHeader
        title={title}
        count={count}
        collapsed={collapsed}
        colorIndex={colorIndex}
        locked={locked}
        onToggleCollapsed={onToggleCollapsed}
        onRename={onRename}
        onDelete={onDelete}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
      />
      {!collapsed && children}
    </SectionDropZone>
  );
}

function TaskList({
  tasks,
  courseId,
  semesterStartDate,
  semesterEndDate,
  locked,
  sectionId,
  sectionColorIndex,
  sections,
  availableTemplateItems,
  insertGap,
  onToggleInsert,
  onInserted,
  onPatch,
  onRemove,
  expandedIds,
  onToggleExpanded,
  selectMode,
  selectedIds,
  onToggleSelected,
  emptyLabel,
}: {
  tasks: Task[];
  courseId: number;
  semesterStartDate: string;
  semesterEndDate: string | null;
  locked?: boolean;
  sectionId: number | null;
  sectionColorIndex?: number;
  sections: CourseSection[];
  availableTemplateItems: AvailableTemplateItem[];
  insertGap: InsertGapState;
  onToggleInsert: (gap: InsertGapState) => void;
  onInserted: (sectionId: number | null, afterId: number | null, newId: number) => void;
  onPatch: (id: number, patch: Partial<Task>) => void;
  onRemove: (id: number) => void;
  expandedIds: Set<number>;
  onToggleExpanded: (id: number) => void;
  selectMode: boolean;
  selectedIds: Set<number>;
  onToggleSelected: (id: number) => void;
  emptyLabel: string;
}) {
  const canInsert = !locked && !selectMode;

  function isActive(afterId: number | null) {
    return insertGap !== null && insertGap.sectionId === sectionId && insertGap.afterId === afterId;
  }

  function renderInsertForm(afterId: number | null) {
    return (
      <AddTaskForm
        courseId={courseId}
        sections={sections}
        availableTemplateItems={availableTemplateItems}
        fixedSectionId={sectionId}
        onCancel={() => onToggleInsert(null)}
        onCreated={(newId) => onInserted(sectionId, afterId, newId)}
      />
    );
  }

  const colorStyle = sectionColorIndex !== undefined ? getSectionColorStyle(sectionColorIndex) : null;

  return (
    <SortableContext items={tasks.map((t) => `task-${t.id}`)} strategy={verticalListSortingStrategy}>
      <ul
        className={`divide-y divide-black/10 dark:divide-white/10 ${
          colorStyle ? `rounded-b-lg border-x border-b ${colorStyle.border}` : "rounded-lg border border-black/10 dark:border-white/10"
        }`}
      >
        {tasks.length === 0 ? (
          isActive(null) ? (
            <li className="px-3 py-2">{renderInsertForm(null)}</li>
          ) : (
            <li className="flex flex-col items-center justify-center gap-1.5 px-4 py-6">
              {canInsert && (
                <button
                  onClick={() => onToggleInsert({ sectionId, afterId: null })}
                  aria-label="Add task"
                  title="Add task"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-white hover:bg-blue-600"
                >
                  <PlusIcon />
                </button>
              )}
              <span className="text-sm text-black/40 dark:text-white/40">{emptyLabel}</span>
            </li>
          )
        ) : (
          tasks.map((task, index) => (
            <Fragment key={task.id}>
              {index === 0 && canInsert && (
                <InsertGap active={isActive(null)} onOpen={() => onToggleInsert({ sectionId, afterId: null })}>
                  {renderInsertForm(null)}
                </InsertGap>
              )}
              <SortableTaskRow
                task={task}
                courseId={courseId}
                semesterStartDate={semesterStartDate}
                semesterEndDate={semesterEndDate}
                draggable={!selectMode && !locked}
                locked={locked}
                onPatch={onPatch}
                onRemove={onRemove}
                expanded={expandedIds.has(task.id)}
                onToggleExpanded={() => onToggleExpanded(task.id)}
                selectMode={selectMode}
                selected={selectedIds.has(task.id)}
                onToggleSelected={() => onToggleSelected(task.id)}
              />
              {canInsert && (
                <InsertGap active={isActive(task.id)} onOpen={() => onToggleInsert({ sectionId, afterId: task.id })}>
                  {renderInsertForm(task.id)}
                </InsertGap>
              )}
            </Fragment>
          ))
        )}
      </ul>
    </SortableContext>
  );
}

function InsertGap({
  active,
  onOpen,
  children,
}: {
  active: boolean;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  if (active) {
    return <li className="px-3 py-2">{children}</li>;
  }
  return (
    <li className="relative h-0 list-none">
      <div className="group/gap absolute inset-x-0 -top-2 -bottom-2 z-10 flex items-center gap-1.5 px-3">
        <span className="h-px flex-1 bg-blue-500 opacity-0 transition-opacity group-hover/gap:opacity-100" />
        <button
          onClick={onOpen}
          aria-label="Insert task here"
          title="Insert task here"
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-500 text-white opacity-0 shadow transition-opacity hover:bg-blue-600 group-hover/gap:opacity-100"
        >
          <PlusIcon />
        </button>
        <span className="h-px flex-1 bg-blue-500 opacity-0 transition-opacity group-hover/gap:opacity-100" />
      </div>
    </li>
  );
}

function SortableTaskRow({
  task,
  courseId,
  semesterStartDate,
  semesterEndDate,
  draggable,
  locked,
  onPatch,
  onRemove,
  expanded,
  onToggleExpanded,
  selectMode,
  selected,
  onToggleSelected,
}: {
  task: Task;
  courseId: number;
  semesterStartDate: string;
  semesterEndDate: string | null;
  draggable: boolean;
  locked?: boolean;
  onPatch: (id: number, patch: Partial<Task>) => void;
  onRemove: (id: number) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelected?: () => void;
}) {
  const [editing, setEditing] = useState(false);

  const sortable = useSortable({
    id: `task-${task.id}`,
    data: { type: "task", taskId: task.id, sectionId: task.sectionId },
    disabled: !draggable || editing,
  });
  const { setNodeRef, transform, transition, isDragging } = sortable;
  const rowOpacity = isDragging ? 0.5 : task.irrelevant ? 0.5 : 1;
  const style = draggable
    ? { transform: CSS.Transform.toString(transform), transition, opacity: rowOpacity }
    : { opacity: rowOpacity };

  const [editSession, setEditSession] = useState(0);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [subItems, setSubItems] = useState(task.subItems.map((s) => s.text));
  const [offset, setOffset] = useState<WeeksDaysOffset>(offsetDaysToWeeksDays(task.offsetDays, task.dueDateAnchor));
  const subItemsDoneCount = task.subItems.filter((s) => s.done).length;

  function startEditing() {
    setTitle(task.title);
    setDescription(task.description ?? "");
    setSubItems(task.subItems.map((s) => s.text));
    setOffset(offsetDaysToWeeksDays(task.offsetDays, task.dueDateAnchor));
    setEditSession((s) => s + 1);
    setEditing(true);
  }

  const dueDate = resolveDueDate(semesterStartDate, semesterEndDate, task.offsetDays, task.dueDateAnchor);

  function toggle(field: "done" | "irrelevant", value: boolean) {
    onPatch(task.id, { [field]: value });
    updateTask(task.id, courseId, { [field]: value });
  }

  function toggleSub(subItemId: number, done: boolean) {
    onPatch(task.id, {
      subItems: task.subItems.map((s) => (s.id === subItemId ? { ...s, done } : s)),
    });
    toggleSubItemDone(subItemId, courseId, done);
  }

  function handleSave() {
    const offsetDays = weeksDaysToOffsetDays(offset);
    const dueDateAnchor = offset.anchor;
    const cleanedSubItems = subItems.map((s) => s.trim()).filter(Boolean);
    const cleanedDescription = description.trim() || null;
    onPatch(task.id, {
      title: title.trim(),
      description: cleanedDescription,
      offsetDays,
      dueDateAnchor,
      subItems: cleanedSubItems.map((text, i) => ({ id: -1 - i, text, position: i, done: false })),
    });
    setEditing(false);
    updateTask(task.id, courseId, {
      title,
      description: cleanedDescription,
      offsetDays,
      dueDateAnchor,
      subItems: cleanedSubItems,
    });
  }

  async function handleDelete() {
    onRemove(task.id);
    await deleteTask(task.id, courseId);
  }

  return (
    <li
      ref={draggable ? setNodeRef : undefined}
      style={style}
      className={`group flex flex-col gap-2 px-3 py-2.5 ${selected ? "bg-blue-50 dark:bg-blue-950/40" : ""}`}
    >
      <div className="flex items-center gap-3">
        {selectMode ? (
          <input type="checkbox" checked={selected ?? false} onChange={onToggleSelected} aria-label="Select task" />
        ) : draggable && !editing ? (
          <DragHandle attributes={sortable.attributes} listeners={sortable.listeners} />
        ) : (
          <span className="w-5" />
        )}

        <input
          type="checkbox"
          checked={task.done}
          onChange={(e) => toggle("done", e.target.checked)}
          disabled={task.irrelevant}
          aria-label="Done"
        />

        {editing ? (
          <div className="flex flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSave();
                  }
                }}
                className="min-w-[10rem] flex-1 rounded-md border border-black/15 px-2 py-1.5 text-sm dark:border-white/20"
              />
              <OffsetInput value={offset} onChange={setOffset} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-black/50 dark:text-white/50">Description (optional, Markdown supported)</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="rounded-md border border-black/15 px-2 py-1.5 text-sm dark:border-white/20"
              />
            </div>
            <SubItemEditor key={editSession} value={subItems} onChange={setSubItems} />
            <div className="flex items-center gap-2">
              <button onClick={handleSave} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">
                Save
              </button>
              <button onClick={() => setEditing(false)} className="text-sm text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center gap-3">
            <span
              onClick={task.subItems.length > 0 || task.description ? onToggleExpanded : undefined}
              className={`group/title text-sm ${task.done ? "line-through text-black/40 dark:text-white/40" : ""} ${task.subItems.length > 0 || task.description ? "cursor-pointer" : ""}`}
            >
              <span className={task.subItems.length > 0 || task.description ? "group-hover/title:underline" : ""}>
                {task.title}
              </span>
              {task.subItems.length > 0 && (
                <span
                  className={`ml-1 text-xs font-normal ${
                    subItemsDoneCount === task.subItems.length
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-black/40 dark:text-white/40"
                  }`}
                >
                  ({subItemsDoneCount}/{task.subItems.length})
                </span>
              )}
            </span>
            {!locked && (
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={startEditing}
                  aria-label="Edit task"
                  title="Edit task"
                  className="rounded p-1 text-black/40 hover:bg-black/5 hover:text-blue-600 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-blue-400"
                >
                  <PencilIcon />
                </button>
                <DeleteButton confirmText={`Remove "${task.title}"?`} onDelete={handleDelete} label="Delete task" icon />
              </div>
            )}
            <div className="ml-auto flex items-center gap-3">
              {!task.done && !task.irrelevant && dueDate ? (
                <DueDateBadge
                  dueDate={dueDate}
                  offsetDays={task.offsetDays}
                  title={`${formatOffsetLabel(task.offsetDays, task.dueDateAnchor)} — ${formatDateFriendly(dueDate)}`}
                />
              ) : (
                !task.done &&
                !task.irrelevant && (
                  <span
                    className="text-xs text-black/40 dark:text-white/40"
                    title={formatOffsetLabel(task.offsetDays, task.dueDateAnchor)}
                  >
                    {formatOffsetLabel(task.offsetDays, task.dueDateAnchor)} · set semester end date
                  </span>
                )
              )}
              <label className="flex items-center gap-1 text-xs text-black/50 dark:text-white/50">
                <input
                  type="checkbox"
                  checked={task.irrelevant}
                  onChange={(e) => toggle("irrelevant", e.target.checked)}
                />
                N/A
              </label>
            </div>
          </div>
        )}
      </div>
      {!editing && expanded && (task.description || task.subItems.length > 0) && (
        <div className="ml-8 flex flex-col gap-2 rounded-md bg-black/[.03] px-3 py-2 dark:bg-white/[.05]">
          {task.description && <MarkdownContent text={task.description} />}
          {task.subItems.length > 0 && (
            <ul className="flex flex-col gap-1">
              {task.subItems.map((sub) => (
                <li key={sub.id} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={sub.done}
                    onChange={(e) => toggleSub(sub.id, e.target.checked)}
                    className="mt-0.5"
                    aria-label="Sub-item done"
                  />
                  <span className={sub.done ? "line-through text-black/40 dark:text-white/40" : ""}>
                    <MarkdownContent text={sub.text} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

function NewSectionForm({
  courseId,
  onCancel,
  onCreated,
}: {
  courseId: number;
  onCancel: () => void;
  onCreated?: (id: number) => void;
}) {
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    const newId = await createCourseSection(courseId, title);
    onCreated?.(newId);
    setTitle("");
    setSubmitting(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 rounded-lg border border-dashed border-black/15 p-3 dark:border-white/20"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="New section name, e.g. Week 1"
        autoFocus
        className="min-w-[12rem] flex-1 rounded-md border border-black/15 px-2 py-1.5 text-sm dark:border-white/20"
      />
      <button
        type="submit"
        disabled={submitting || !title.trim()}
        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
      >
        Add
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="text-sm text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white"
      >
        Done
      </button>
    </form>
  );
}

function AddTaskForm({
  courseId,
  sections,
  availableTemplateItems,
  fixedSectionId,
  onCancel,
  onCreated,
}: {
  courseId: number;
  sections: CourseSection[];
  availableTemplateItems: AvailableTemplateItem[];
  fixedSectionId?: number | null;
  onCancel?: () => void;
  onCreated?: (id: number) => void;
}) {
  const hasFixedSection = fixedSectionId !== undefined;
  const [mode, setMode] = useState<"template" | "custom">(
    availableTemplateItems.length > 0 ? "template" : "custom"
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | "">(
    availableTemplateItems[0]?.id ?? ""
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subItems, setSubItems] = useState<string[]>([]);
  const [formSession, setFormSession] = useState(0);
  const [sectionId, setSectionId] = useState<number | null>(hasFixedSection ? fixedSectionId : null);
  const [offset, setOffset] = useState<WeeksDaysOffset>({ weeks: 1, days: 0, direction: "before", anchor: "start" });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    if (mode === "template") {
      if (selectedTemplateId !== "") {
        const newId = await addTaskFromTemplate(courseId, selectedTemplateId, hasFixedSection ? fixedSectionId : undefined);
        onCreated?.(newId);
      }
    } else {
      if (title.trim()) {
        const newId = await addCustomTask(courseId, {
          title,
          sectionId: hasFixedSection ? fixedSectionId : sectionId,
          subItems: subItems.map((s) => s.trim()).filter(Boolean),
          offsetDays: weeksDaysToOffsetDays(offset),
          dueDateAnchor: offset.anchor,
          description: description.trim() || null,
        });
        onCreated?.(newId);
        setTitle("");
        setDescription("");
        setSubItems([]);
        setFormSession((s) => s + 1);
        if (!hasFixedSection) setSectionId(null);
      }
    }
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-lg border border-dashed border-black/15 p-3 dark:border-white/20">
      <div className="flex items-center gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            checked={mode === "template"}
            onChange={() => setMode("template")}
            disabled={availableTemplateItems.length === 0}
          />
          From master template
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={mode === "custom"} onChange={() => setMode("custom")} />
          Custom task
        </label>
      </div>

      {mode === "template" ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(Number(e.target.value))}
            className="min-w-[14rem] flex-1 rounded-md border border-black/15 px-2 py-1.5 text-sm dark:border-white/20 dark:bg-black"
          >
            {availableTemplateItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title} ({formatOffsetLabel(item.offsetDays, item.dueDateAnchor)})
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={submitting || selectedTemplateId === ""}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Add
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-sm text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white"
            >
              Done
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              autoFocus={hasFixedSection}
              className="min-w-[12rem] flex-1 rounded-md border border-black/15 px-2 py-1.5 text-sm dark:border-white/20"
            />
            <OffsetInput value={offset} onChange={setOffset} />
            {!hasFixedSection && sections.length > 0 && (
              <select
                value={sectionId ?? ""}
                onChange={(e) => setSectionId(e.target.value ? Number(e.target.value) : null)}
                className="rounded-md border border-black/15 px-2 py-1.5 text-sm dark:border-white/20 dark:bg-black"
              >
                <option value="">Inbox</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            )}
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Add
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="text-sm text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white"
              >
                Done
              </button>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-black/50 dark:text-white/50">Description (optional, Markdown supported)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="rounded-md border border-black/15 px-2 py-1.5 text-sm dark:border-white/20"
            />
          </div>
          <SubItemEditor key={formSession} value={subItems} onChange={setSubItems} />
        </div>
      )}
    </form>
  );
}
