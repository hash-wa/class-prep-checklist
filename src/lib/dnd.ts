import { pointerWithin, closestCenter, type CollisionDetection } from "@dnd-kit/core";

/**
 * `closestCenter` alone is unreliable for multi-container sortable lists — it can
 * resolve back to the source container instead of whatever's under the pointer,
 * making cross-container drops feel like they silently fail. Prefer whatever
 * droppable the pointer is actually within, falling back to closestCenter only
 * when the pointer isn't over any droppable (e.g. a gap between sections).
 */
export const multiContainerCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  return pointerCollisions.length > 0 ? pointerCollisions : closestCenter(args);
};
