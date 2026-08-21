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
  createTemplateItem,
  updateTemplateItem,
  deleteTemplateItem,
  reorderTemplateItems,
  moveTemplateItemsToSection,
  bulkSetTemplateItemsOffset,
  bulkDeleteTemplateItems,
  createTemplateSection,
  renameTemplateSection,
  deleteTemplateSection,
  reorderTemplateSections,
} from "@/actions/template";
import { offsetDaysToWeeksDays, weeksDaysToOffsetDays, type DueDateAnchor, type WeeksDaysOffset } from "@/lib/dates";
import { formatOffsetLabel } from "@/lib/format";
import { groupBySection, buildReorderBuckets } from "@/lib/sections";
import { multiContainerCollisionDetection } from "@/lib/dnd";
import { OffsetInput } from "@/components/OffsetInput";
import { DragHandle } from "@/components/DragHandle";
import { SectionHeader } from "@/components/SectionHeader";
import { SubItemEditor } from "@/components/SubItemEditor";
import { MarkdownContent } from "@/components/MarkdownContent";
import { BulkActionsToolbar } from "@/components/BulkActionsToolbar";
import { PencilIcon, PlusIcon, TrashIcon } from "@/components/icons";

type TemplateItem = {
  id: number;
  title: string;
  description: string | null;
  offsetDays: number;
  dueDateAnchor: DueDateAnchor;
  position: number;
  sectionId: number | null;
  subItems: { id: number; text: string; position: number }[];
};

type TemplateSection = { id: number; title: string; position: number };
type InsertGapState = { sectionId: number | null; afterId: number | null } | null;

export function TemplateEditor({
  sections: initialSections,
  items: initialItems,
}: {
  sections: TemplateSection[];
  items: TemplateItem[];
}) {
  const [sections, setSections] = useState(initialSections);
  const [prevInitialSections, setPrevInitialSections] = useState(initialSections);
  const [items, setItems] = useState(initialItems);
  const [prevInitialItems, setPrevInitialItems] = useState(initialItems);
  const [isPending, startTransition] = useTransition();
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [collapsedSectionIds, setCollapsedSectionIds] = useState<Set<number>>(new Set());
  const [insertGap, setInsertGap] = useState<InsertGapState>(null);
  const [sectionInsertAfterId, setSectionInsertAfterId] = useState<number | null>(null);
  const [showNewSectionForm, setShowNewSectionForm] = useState(false);
  const [activeItemId, setActiveItemId] = useState<number | null>(null);

  if (initialSections !== prevInitialSections) {
    setPrevInitialSections(initialSections);
    setSections(initialSections);
  }
  if (initialItems !== prevInitialItems) {
    setPrevInitialItems(initialItems);
    setItems(initialItems);
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const groups = groupBySection(sections, items);

  type ItemDragData = { type: "item"; itemId: number; sectionId: number | null };
  type ItemOverData = ItemDragData | { type: "sectionDrop"; sectionId: number | null };

  function computeMovedItems(activeData: ItemDragData, overData: ItemOverData | undefined) {
    const destSectionId = overData?.sectionId;
    if (destSectionId === undefined) return null;

    const mutableGroups = groups.map((g) => ({ ...g, items: [...g.items] }));
    const sourceGroup = mutableGroups.find((g) => g.sectionId === activeData.sectionId);
    const destGroup = mutableGroups.find((g) => g.sectionId === destSectionId);
    if (!sourceGroup || !destGroup) return null;

    const sourceIndex = sourceGroup.items.findIndex((i) => i.id === activeData.itemId);
    if (sourceIndex === -1) return null;

    if (sourceGroup === destGroup) {
      // Same-section reorder: resolve the destination index from the array as it
      // currently stands (matching dnd-kit's own live-preview semantics) and use
      // arrayMove directly. Removing the item first and re-searching in the
      // mutated array — the previous approach — shifts every later index down by
      // one, so downward drags silently needed an extra slot to land correctly.
      let destIndex = sourceGroup.items.length - 1;
      if (overData?.type === "item") {
        const idx = sourceGroup.items.findIndex((i) => i.id === overData.itemId);
        if (idx !== -1) destIndex = idx;
      }
      sourceGroup.items = arrayMove(sourceGroup.items, sourceIndex, destIndex);
    } else {
      const [moving] = sourceGroup.items.splice(sourceIndex, 1);
      let destIndex = destGroup.items.length;
      if (overData?.type === "item") {
        const idx = destGroup.items.findIndex((i) => i.id === overData.itemId);
        if (idx !== -1) destIndex = idx;
      }
      destGroup.items.splice(destIndex, 0, { ...moving, sectionId: destSectionId });
    }

    const newItems = mutableGroups.flatMap((g) =>
      g.items.map((it, idx) => ({ ...it, sectionId: g.sectionId, position: idx }))
    );
    return { newItems, mutableGroups };
  }

  function handleDragStart(event: DragStartEvent) {
    const activeData = event.active.data.current as ItemDragData | undefined;
    setActiveItemId(activeData?.itemId ?? null);
  }

  // Cross-section drags aren't part of the destination section's SortableContext until
  // committed, so without this dnd-kit shows no reflow/placeholder animation there. Move
  // the item into local state as soon as it crosses into a different section so the drop
  // target animates live; same-section hovers are already animated by dnd-kit itself.
  // The dragged row itself is rendered via DragOverlay (a stable, portal-rendered node) so
  // that re-parenting it between sections mid-drag doesn't disrupt the browser's pointer
  // capture on the real list item.
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeData = active.data.current as ItemDragData | undefined;
    if (!activeData) return;
    const overData = over.data.current as ItemOverData | undefined;
    const destSectionId = overData?.sectionId;
    if (destSectionId === undefined || destSectionId === activeData.sectionId) return;

    const result = computeMovedItems(activeData, overData);
    if (result) setItems(result.newItems);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveItemId(null);
    const { active, over } = event;
    if (!over) return;
    const activeData = active.data.current as ItemDragData | undefined;
    if (!activeData) return;
    const overData = over.data.current as ItemOverData | undefined;

    const result = computeMovedItems(activeData, overData);
    if (!result) return;
    setItems(result.newItems);

    const buckets = buildReorderBuckets(result.mutableGroups.map((g) => ({ sectionId: g.sectionId, items: g.items })));
    startTransition(() => {
      reorderTemplateItems(buckets);
    });
  }

  function patchItem(id: number, patch: Partial<TemplateItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function removeItem(id: number) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  // The newly created item always lands at the end of its section server-side; splice it into
  // the slot the user actually clicked (right after `afterId`, or at the very start when
  // `afterId` is null) and persist that via the same reorder path drag-and-drop already uses,
  // rather than teaching the create action about arbitrary insertion positions.
  function handleInsertedItem(sectionId: number | null, afterId: number | null, newItemId: number) {
    setInsertGap(null);
    const group = groups.find((g) => g.sectionId === sectionId);
    if (!group) return;
    const ids = group.items.map((i) => i.id);
    let orderedIds: number[];
    if (afterId === null) {
      orderedIds = [newItemId, ...ids];
    } else {
      const insertIndex = ids.indexOf(afterId);
      if (insertIndex === -1) return;
      orderedIds = [...ids.slice(0, insertIndex + 1), newItemId, ...ids.slice(insertIndex + 1)];
    }
    startTransition(() => {
      reorderTemplateItems([{ sectionId, orderedIds }]);
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
    await moveTemplateItemsToSection(ids, sectionId);
  }

  async function handleBulkSetOffset(offsetDays: number, dueDateAnchor: DueDateAnchor) {
    const ids = [...selectedIds];
    setSelectedIds(new Set());
    setItems((prev) => prev.map((i) => (ids.includes(i.id) ? { ...i, offsetDays, dueDateAnchor } : i)));
    await bulkSetTemplateItemsOffset(ids, offsetDays, dueDateAnchor);
  }

  async function handleBulkDelete() {
    const ids = [...selectedIds];
    setSelectedIds(new Set());
    setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
    await bulkDeleteTemplateItems(ids);
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
      reorderTemplateSections(reordered.map((s) => s.id));
    });
  }

  // Mirrors handleInsertedItem: the new section always lands at the end server-side, so splice
  // it into the slot the user actually clicked and persist that via the existing section
  // reorder action.
  function handleInsertedSection(afterSectionId: number, newSectionId: number) {
    setSectionInsertAfterId(null);
    const ids = sections.map((s) => s.id);
    const insertIndex = ids.indexOf(afterSectionId);
    if (insertIndex === -1) return;
    const orderedIds = [...ids.slice(0, insertIndex + 1), newSectionId, ...ids.slice(insertIndex + 1)];
    startTransition(() => {
      reorderTemplateSections(orderedIds);
    });
  }

  const itemsWithSubItems = items.filter((i) => i.subItems.length > 0);
  const activeDragItem = activeItemId !== null ? items.find((i) => i.id === activeItemId) ?? null : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs">
        <button
          onClick={toggleSelectMode}
          className={`rounded-md px-2 py-1 ${selectMode ? "bg-blue-600 text-white" : "border border-black/15 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"}`}
        >
          {selectMode ? "Cancel selecting" : "Select items"}
        </button>
        {itemsWithSubItems.length > 0 && (
          <div className="flex gap-3">
            <button
              onClick={() => setExpandedIds(new Set(itemsWithSubItems.map((i) => i.id)))}
              className="text-blue-600 hover:underline"
            >
              Expand all
            </button>
            <button onClick={() => setExpandedIds(new Set())} className="text-blue-600 hover:underline">
              Collapse all
            </button>
          </div>
        )}
      </div>

      {selectMode && (
        <BulkActionsToolbar
          count={selectedIds.size}
          sections={sections}
          onMove={handleBulkMove}
          onSetOffset={handleBulkSetOffset}
          onDelete={handleBulkDelete}
          onClear={() => setSelectedIds(new Set())}
          itemLabel="item"
        />
      )}

      <DndContext
        id="template-list"
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
                  ({groups.find((g) => g.sectionId === null)?.items.length ?? 0})
                </span>
              </h3>
            </div>
            <ItemList
              items={groups.find((g) => g.sectionId === null)?.items ?? []}
              sectionId={null}
              insertGap={insertGap}
              onToggleInsert={setInsertGap}
              onInserted={handleInsertedItem}
              onPatch={patchItem}
              onRemove={removeItem}
              expandedIds={expandedIds}
              onToggleExpanded={toggleExpanded}
              selectMode={selectMode}
              selectedIds={selectedIds}
              onToggleSelected={toggleSelected}
              sections={sections}
              emptyLabel="Inbox is empty."
            />
          </SectionDropZone>

          {sections.length > 0 && <div className="h-8" />}

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
                  count={group.items.length}
                  collapsed={collapsed}
                  onToggleCollapsed={() => toggleSectionCollapsed(section.id)}
                  onRename={(title) => renameTemplateSection(section.id, title)}
                  onDelete={() => {
                    if (!confirm(`Delete section "${section.title}"? Items move to Unsectioned.`)) return;
                    setSections((prev) => prev.filter((s) => s.id !== section.id));
                    deleteTemplateSection(section.id);
                  }}
                  onMoveUp={() => moveSection(section.id, "up")}
                  onMoveDown={() => moveSection(section.id, "down")}
                  canMoveUp={sectionIndex > 0}
                  canMoveDown={sectionIndex < sections.length - 1}
                >
                  <ItemList
                    items={group.items}
                    sectionId={section.id}
                    insertGap={insertGap}
                    onToggleInsert={setInsertGap}
                    onInserted={handleInsertedItem}
                    onPatch={patchItem}
                    onRemove={removeItem}
                    expandedIds={expandedIds}
                    onToggleExpanded={toggleExpanded}
                    selectMode={selectMode}
                    selectedIds={selectedIds}
                    onToggleSelected={toggleSelected}
                    sections={sections}
                    emptyLabel="No items in this section yet."
                  />
                </SectionBlock>
                <SectionInsertGap
                  active={sectionInsertAfterId === section.id}
                  onOpen={() => setSectionInsertAfterId(section.id)}
                >
                  <NewSectionForm
                    onCancel={() => setSectionInsertAfterId(null)}
                    onCreated={(newId) => handleInsertedSection(section.id, newId)}
                  />
                </SectionInsertGap>
              </Fragment>
              );
            })}
        </div>
        <DragOverlay>{activeDragItem && <ItemDragPreview item={activeDragItem} />}</DragOverlay>
      </DndContext>

      {sections.length === 0 && (
        showNewSectionForm ? (
          <NewSectionForm onCancel={() => setShowNewSectionForm(false)} />
        ) : (
          <button
            onClick={() => setShowNewSectionForm(true)}
            className="flex items-center gap-1 rounded-md border border-black/15 px-2 py-1.5 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            <PlusIcon /> Add section
          </button>
        )
      )}

      {isPending && <p className="text-xs text-black/40">Saving order...</p>}
    </div>
  );
}

function SectionDropZone({ sectionId, children }: { sectionId: number | null; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({
    id: `section-drop-${sectionId ?? "none"}`,
    data: { type: "sectionDrop", sectionId },
  });
  return <div ref={setNodeRef}>{children}</div>;
}

/** Same idea as the item-row InsertGap, but sized for the section-level whitespace: hovering
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

function ItemDragPreview({ item }: { item: TemplateItem }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-black/10 bg-white px-3 py-2.5 shadow-lg dark:border-white/10 dark:bg-neutral-900">
      <span className="w-5 flex-shrink-0 text-center text-black/30 dark:text-white/30">⠿</span>
      <span className="text-sm">{item.title}</span>
    </div>
  );
}

function SectionBlock({
  sectionId,
  title,
  count,
  collapsed,
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

function ItemList({
  items,
  sectionId,
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
  sections,
  emptyLabel,
}: {
  items: TemplateItem[];
  sectionId: number | null;
  insertGap: InsertGapState;
  onToggleInsert: (gap: InsertGapState) => void;
  onInserted: (sectionId: number | null, afterId: number | null, newId: number) => void;
  onPatch: (id: number, patch: Partial<TemplateItem>) => void;
  onRemove: (id: number) => void;
  expandedIds: Set<number>;
  onToggleExpanded: (id: number) => void;
  selectMode: boolean;
  selectedIds: Set<number>;
  onToggleSelected: (id: number) => void;
  sections: TemplateSection[];
  emptyLabel: string;
}) {
  const canInsert = !selectMode;

  function isActive(afterId: number | null) {
    return insertGap !== null && insertGap.sectionId === sectionId && insertGap.afterId === afterId;
  }

  function renderInsertForm(afterId: number | null) {
    return (
      <NewItemForm
        sections={sections}
        fixedSectionId={sectionId}
        onCancel={() => onToggleInsert(null)}
        onCreated={(newId) => onInserted(sectionId, afterId, newId)}
      />
    );
  }

  return (
    <SortableContext items={items.map((i) => `item-${i.id}`)} strategy={verticalListSortingStrategy}>
      <ul className="divide-y divide-black/10 rounded-lg border border-black/10 dark:divide-white/10 dark:border-white/10">
        {items.length === 0 ? (
          isActive(null) ? (
            <li className="px-3 py-2">{renderInsertForm(null)}</li>
          ) : (
            <li className="flex flex-col items-center justify-center gap-1.5 px-4 py-6">
              {canInsert && (
                <button
                  onClick={() => onToggleInsert({ sectionId, afterId: null })}
                  aria-label="Add item"
                  title="Add item"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-white hover:bg-blue-600"
                >
                  <PlusIcon />
                </button>
              )}
              <span className="text-sm text-black/40 dark:text-white/40">{emptyLabel}</span>
            </li>
          )
        ) : (
          items.map((item, index) => (
            <Fragment key={item.id}>
              {index === 0 && canInsert && (
                <InsertGap active={isActive(null)} onOpen={() => onToggleInsert({ sectionId, afterId: null })}>
                  {renderInsertForm(null)}
                </InsertGap>
              )}
              <SortableTemplateRow
                item={item}
                onPatch={onPatch}
                onRemove={onRemove}
                expanded={expandedIds.has(item.id)}
                onToggleExpanded={() => onToggleExpanded(item.id)}
                selectMode={selectMode}
                selected={selectedIds.has(item.id)}
                onToggleSelected={() => onToggleSelected(item.id)}
                sections={sections}
              />
              {canInsert && (
                <InsertGap active={isActive(item.id)} onOpen={() => onToggleInsert({ sectionId, afterId: item.id })}>
                  {renderInsertForm(item.id)}
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
          aria-label="Insert item here"
          title="Insert item here"
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-500 text-white opacity-0 shadow transition-opacity hover:bg-blue-600 group-hover/gap:opacity-100"
        >
          <PlusIcon />
        </button>
        <span className="h-px flex-1 bg-blue-500 opacity-0 transition-opacity group-hover/gap:opacity-100" />
      </div>
    </li>
  );
}

function SortableTemplateRow({
  item,
  onPatch,
  onRemove,
  expanded,
  onToggleExpanded,
  selectMode,
  selected,
  onToggleSelected,
  sections,
}: {
  item: TemplateItem;
  onPatch: (id: number, patch: Partial<TemplateItem>) => void;
  onRemove: (id: number) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  selectMode: boolean;
  selected: boolean;
  onToggleSelected: () => void;
  sections: TemplateSection[];
}) {
  const [editing, setEditing] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `item-${item.id}`,
    data: { type: "item", itemId: item.id, sectionId: item.sectionId },
    disabled: selectMode || editing,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [editSession, setEditSession] = useState(0);
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description ?? "");
  const [subItems, setSubItems] = useState(item.subItems.map((s) => s.text));
  const [sectionId, setSectionId] = useState<number | null>(item.sectionId);
  const [offset, setOffset] = useState<WeeksDaysOffset>(offsetDaysToWeeksDays(item.offsetDays, item.dueDateAnchor));

  function startEditing() {
    setTitle(item.title);
    setDescription(item.description ?? "");
    setSubItems(item.subItems.map((s) => s.text));
    setSectionId(item.sectionId);
    setOffset(offsetDaysToWeeksDays(item.offsetDays, item.dueDateAnchor));
    setEditSession((s) => s + 1);
    setEditing(true);
  }

  function handleSave() {
    const offsetDays = weeksDaysToOffsetDays(offset);
    const dueDateAnchor = offset.anchor;
    const cleanedSubItems = subItems.map((s) => s.trim()).filter(Boolean);
    const cleanedDescription = description.trim() || null;
    onPatch(item.id, {
      title: title.trim(),
      description: cleanedDescription,
      offsetDays,
      dueDateAnchor,
      sectionId,
      subItems: cleanedSubItems.map((text, i) => ({ id: -1 - i, text, position: i })),
    });
    setEditing(false);
    updateTemplateItem(item.id, {
      title,
      description: cleanedDescription,
      offsetDays,
      dueDateAnchor,
      sectionId,
      subItems: cleanedSubItems,
    });
  }

  async function handleDelete() {
    if (!confirm(`Remove "${item.title}" from the master template?`)) return;
    onRemove(item.id);
    await deleteTemplateItem(item.id);
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`group flex flex-col gap-2 px-3 py-2.5 ${selected ? "bg-blue-50 dark:bg-blue-950/40" : ""}`}
    >
      <div className="flex items-center gap-3">
        {selectMode ? (
          <input type="checkbox" checked={selected} onChange={onToggleSelected} aria-label="Select item" />
        ) : (
          !editing && <DragHandle attributes={attributes} listeners={listeners} />
        )}
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
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-black/50 dark:text-white/50">Description (optional, Markdown supported)</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="rounded-md border border-black/15 px-2 py-1.5 text-sm dark:border-white/20 dark:bg-black"
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
              onClick={item.subItems.length > 0 || item.description ? onToggleExpanded : undefined}
              className={`group/title text-sm ${item.subItems.length > 0 || item.description ? "cursor-pointer" : ""}`}
            >
              <span className={item.subItems.length > 0 || item.description ? "group-hover/title:underline" : ""}>
                {item.title}
              </span>
              {item.subItems.length > 0 && (
                <span className="ml-1 text-xs font-normal text-black/40 dark:text-white/40">
                  ({item.subItems.length})
                </span>
              )}
            </span>
            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                onClick={startEditing}
                aria-label="Edit item"
                title="Edit item"
                className="rounded p-1 text-black/40 hover:bg-black/5 hover:text-blue-600 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-blue-400"
              >
                <PencilIcon />
              </button>
              <button
                onClick={handleDelete}
                aria-label="Delete item"
                title="Delete item"
                className="rounded p-1 text-black/40 hover:bg-black/5 hover:text-red-600 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-red-400"
              >
                <TrashIcon />
              </button>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-xs text-black/50 dark:text-white/50">
                {formatOffsetLabel(item.offsetDays, item.dueDateAnchor)}
              </span>
            </div>
          </div>
        )}
      </div>
      {!editing && expanded && (item.description || item.subItems.length > 0) && (
        <div className="ml-8 flex flex-col gap-2 rounded-md bg-black/[.03] px-3 py-2 dark:bg-white/[.05]">
          {item.description && <MarkdownContent text={item.description} />}
          {item.subItems.length > 0 && (
            <ul className="flex flex-col gap-1">
              {item.subItems.map((sub) => (
                <li key={sub.id} className="flex items-start gap-2 text-sm">
                  <span className="mt-1 text-black/30 dark:text-white/30">&bull;</span>
                  <MarkdownContent text={sub.text} />
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
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated?: (id: number) => void;
}) {
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    const newId = await createTemplateSection(title);
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
        placeholder="New section name, e.g. Before semester starts"
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

function NewItemForm({
  sections,
  fixedSectionId,
  onCancel,
  onCreated,
}: {
  sections: TemplateSection[];
  fixedSectionId?: number | null;
  onCancel?: () => void;
  onCreated?: (id: number) => void;
}) {
  const hasFixedSection = fixedSectionId !== undefined;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subItems, setSubItems] = useState<string[]>([]);
  const [formSession, setFormSession] = useState(0);
  const [sectionId, setSectionId] = useState<number | null>(hasFixedSection ? fixedSectionId : null);
  const [offset, setOffset] = useState<WeeksDaysOffset>({ weeks: 2, days: 0, direction: "before", anchor: "start" });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    const newId = await createTemplateItem({
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
    setOffset({ weeks: 2, days: 0, direction: "before", anchor: "start" });
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-lg border border-dashed border-black/15 p-3 dark:border-white/20">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New task title, e.g. Post syllabus to LMS"
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
          className="rounded-md border border-black/15 px-2 py-1.5 text-sm dark:border-white/20 dark:bg-black"
        />
      </div>
      <SubItemEditor key={formSession} value={subItems} onChange={setSubItems} />
    </form>
  );
}
