import type { useSortable } from "@dnd-kit/sortable";

type SortableResult = ReturnType<typeof useSortable>;

export function DragHandle({
  listeners,
  attributes,
}: {
  listeners?: SortableResult["listeners"];
  attributes?: SortableResult["attributes"];
}) {
  return (
    <button
      type="button"
      className="-m-1.5 cursor-grab touch-none rounded p-1.5 text-base text-black/30 hover:bg-black/5 hover:text-black/60 active:cursor-grabbing dark:text-white/30 dark:hover:bg-white/10 dark:hover:text-white/60"
      aria-label="Drag to reorder"
      {...attributes}
      {...listeners}
    >
      ⠿
    </button>
  );
}
