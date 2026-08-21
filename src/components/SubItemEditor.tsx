"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DragHandle } from "@/components/DragHandle";

type Row = { id: number; text: string };

let uidCounter = 0;

export function SubItemEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [rows, setRows] = useState<Row[]>(() => value.map((text) => ({ id: ++uidCounter, text })));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function commit(next: Row[]) {
    setRows(next);
    onChange(next.map((r) => r.text));
  }

  function updateAt(id: number, text: string) {
    commit(rows.map((r) => (r.id === id ? { ...r, text } : r)));
  }

  function removeAt(id: number) {
    commit(rows.filter((r) => r.id !== id));
  }

  function add() {
    commit([...rows, { id: ++uidCounter, text: "" }]);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = rows.findIndex((r) => r.id === active.id);
    const newIndex = rows.findIndex((r) => r.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    commit(arrayMove(rows, oldIndex, newIndex));
  }

  return (
    <div className="flex flex-col gap-1.5">
      {rows.length > 0 && (
        <span className="text-xs text-black/50 dark:text-white/50">Sub-items (optional, Markdown supported)</span>
      )}
      <DndContext id="sub-items" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-1.5">
            {rows.map((row) => (
              <SortableSubItemRow
                key={row.id}
                row={row}
                onChange={(text) => updateAt(row.id, text)}
                onRemove={() => removeAt(row.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <button type="button" onClick={add} className="self-start text-xs text-blue-600 hover:underline">
        + Add sub-item
      </button>
    </div>
  );
}

function SortableSubItemRow({
  row,
  onChange,
  onRemove,
}: {
  row: Row;
  onChange: (text: string) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      <DragHandle attributes={attributes} listeners={listeners} />
      <input
        value={row.text}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Sub-item text"
        className="flex-1 rounded-md border border-black/15 px-2 py-1.5 text-sm dark:border-white/20"
      />
      <button
        type="button"
        onClick={onRemove}
        className="text-xs text-red-600 hover:underline"
        aria-label="Remove sub-item"
      >
        Remove
      </button>
    </div>
  );
}
