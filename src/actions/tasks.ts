"use server";

import { db } from "@/db";
import { courseTasks, courseSections, courseTaskSubItems, templateItems } from "@/db/schema";
import { asc, and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { resolveCourseSectionId } from "./courses";

function normalizeSubItems(subItems: string[] | undefined): string[] {
  return (subItems ?? []).map((s) => s.trim()).filter(Boolean);
}

async function replaceSubItems(courseTaskId: number, subItems: string[]) {
  await db.delete(courseTaskSubItems).where(eq(courseTaskSubItems.courseTaskId, courseTaskId));
  const normalized = normalizeSubItems(subItems);
  if (normalized.length > 0) {
    await db.insert(courseTaskSubItems).values(
      normalized.map((text, index) => ({ courseTaskId, text, position: index, done: false }))
    );
  }
}

export async function listTasksForCourse(courseId: number) {
  return db.query.courseTasks.findMany({
    where: eq(courseTasks.courseId, courseId),
    orderBy: [asc(courseTasks.position), asc(courseTasks.id)],
    with: { subItems: { orderBy: [asc(courseTaskSubItems.position)] } },
  });
}

export async function listCourseSections(courseId: number) {
  return db.query.courseSections.findMany({
    where: eq(courseSections.courseId, courseId),
    orderBy: [asc(courseSections.position), asc(courseSections.id)],
  });
}

export async function createCourseSection(courseId: number, title: string) {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("Section title is required.");

  const [{ maxPosition }] = await db
    .select({ maxPosition: sql<number>`coalesce(max(${courseSections.position}), -1)` })
    .from(courseSections)
    .where(eq(courseSections.courseId, courseId));

  const [created] = await db
    .insert(courseSections)
    .values({ courseId, title: trimmed, position: maxPosition + 1 })
    .returning({ id: courseSections.id });
  revalidatePath(`/courses/${courseId}`);
  return created.id;
}

export async function renameCourseSection(id: number, courseId: number, title: string) {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("Section title is required.");

  await db.update(courseSections).set({ title: trimmed }).where(eq(courseSections.id, id));
  revalidatePath(`/courses/${courseId}`);
}

export async function deleteCourseSection(id: number, courseId: number) {
  await db.delete(courseSections).where(eq(courseSections.id, id));
  revalidatePath(`/courses/${courseId}`);
}

export async function reorderCourseSections(courseId: number, orderedIds: number[]) {
  if (orderedIds.length === 0) return;

  await Promise.all(
    orderedIds.map((id, index) =>
      db.update(courseSections).set({ position: index }).where(eq(courseSections.id, id))
    )
  );

  revalidatePath(`/courses/${courseId}`);
}

async function nextPosition(courseId: number, sectionId: number | null): Promise<number> {
  const [{ maxPosition }] = await db
    .select({ maxPosition: sql<number>`coalesce(max(${courseTasks.position}), -1)` })
    .from(courseTasks)
    .where(
      and(
        eq(courseTasks.courseId, courseId),
        sectionId === null ? sql`${courseTasks.sectionId} is null` : eq(courseTasks.sectionId, sectionId)
      )
    );
  return maxPosition + 1;
}

export async function addCustomTask(
  courseId: number,
  input: {
    title: string;
    sectionId: number | null;
    subItems?: string[];
    offsetDays: number;
    dueDateAnchor?: "start" | "end";
    description?: string | null;
  }
) {
  const title = input.title.trim();
  if (!title) throw new Error("Title is required.");

  const position = await nextPosition(courseId, input.sectionId);
  const [created] = await db
    .insert(courseTasks)
    .values({
      courseId,
      sectionId: input.sectionId,
      title,
      offsetDays: input.offsetDays,
      dueDateAnchor: input.dueDateAnchor ?? "start",
      description: input.description?.trim() || null,
      position,
      sourceTemplateItemId: null,
    })
    .returning({ id: courseTasks.id });

  await replaceSubItems(created.id, input.subItems ?? []);

  revalidatePath(`/courses/${courseId}`);
  return created.id;
}

export async function addTaskFromTemplate(
  courseId: number,
  templateItemId: number,
  overrideSectionId?: number | null
) {
  const item = await db.query.templateItems.findFirst({
    where: eq(templateItems.id, templateItemId),
    with: { subItems: true },
  });
  if (!item) throw new Error("Template item not found.");

  const sectionId =
    overrideSectionId !== undefined ? overrideSectionId : await resolveCourseSectionId(courseId, item.sectionId);
  const position = await nextPosition(courseId, sectionId);
  const [created] = await db
    .insert(courseTasks)
    .values({
      courseId,
      sectionId,
      title: item.title,
      offsetDays: item.offsetDays,
      dueDateAnchor: item.dueDateAnchor,
      description: item.description,
      position,
      sourceTemplateItemId: item.id,
    })
    .returning({ id: courseTasks.id });

  if (item.subItems.length > 0) {
    await db.insert(courseTaskSubItems).values(
      item.subItems.map((sub, index) => ({
        courseTaskId: created.id,
        text: sub.text,
        position: index,
      }))
    );
  }

  revalidatePath(`/courses/${courseId}`);
  return created.id;
}

export async function updateTask(
  id: number,
  courseId: number,
  input: Partial<{
    title: string;
    sectionId: number | null;
    subItems: string[];
    offsetDays: number;
    dueDateAnchor: "start" | "end";
    done: boolean;
    irrelevant: boolean;
    description: string | null;
  }>
) {
  const values: Record<string, unknown> = {};
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) throw new Error("Title is required.");
    values.title = title;
  }
  if (input.sectionId !== undefined) values.sectionId = input.sectionId;
  if (input.offsetDays !== undefined) values.offsetDays = input.offsetDays;
  if (input.dueDateAnchor !== undefined) values.dueDateAnchor = input.dueDateAnchor;
  if (input.done !== undefined) values.done = input.done;
  if (input.irrelevant !== undefined) values.irrelevant = input.irrelevant;
  if (input.description !== undefined) values.description = input.description?.trim() || null;

  if (Object.keys(values).length > 0) {
    await db.update(courseTasks).set(values).where(eq(courseTasks.id, id));
  }
  if (input.subItems !== undefined) {
    await replaceSubItems(id, input.subItems);
  }

  revalidatePath(`/courses/${courseId}`);
}

export async function toggleSubItemDone(subItemId: number, courseId: number, done: boolean) {
  await db.update(courseTaskSubItems).set({ done }).where(eq(courseTaskSubItems.id, subItemId));
  revalidatePath(`/courses/${courseId}`);
}

export async function deleteTask(id: number, courseId: number) {
  await db.delete(courseTasks).where(eq(courseTasks.id, id));
  revalidatePath(`/courses/${courseId}`);
}

/** Moves a batch of tasks into a section (or to unsectioned) in one call, appending them after whatever's already there. */
export async function moveTasksToSection(courseId: number, ids: number[], sectionId: number | null) {
  if (ids.length === 0) return;

  const position = await nextPosition(courseId, sectionId);

  const tasks = await db.query.courseTasks.findMany({
    where: and(eq(courseTasks.courseId, courseId), inArray(courseTasks.id, ids)),
    orderBy: [asc(courseTasks.position), asc(courseTasks.id)],
  });

  await Promise.all(
    tasks.map((task, index) =>
      db
        .update(courseTasks)
        .set({ sectionId, position: position + index })
        .where(eq(courseTasks.id, task.id))
    )
  );

  revalidatePath(`/courses/${courseId}`);
}

export async function bulkSetTasksOffset(
  courseId: number,
  ids: number[],
  offsetDays: number,
  dueDateAnchor: "start" | "end"
) {
  if (ids.length === 0) return;

  await db
    .update(courseTasks)
    .set({ offsetDays, dueDateAnchor })
    .where(and(eq(courseTasks.courseId, courseId), inArray(courseTasks.id, ids)));

  revalidatePath(`/courses/${courseId}`);
}

export async function bulkDeleteTasks(courseId: number, ids: number[]) {
  if (ids.length === 0) return;

  await db.delete(courseTasks).where(and(eq(courseTasks.courseId, courseId), inArray(courseTasks.id, ids)));

  revalidatePath(`/courses/${courseId}`);
}

export async function reorderTasks(
  courseId: number,
  buckets: { sectionId: number | null; orderedIds: number[] }[]
) {
  const updates = buckets.flatMap((bucket) =>
    bucket.orderedIds.map((id, index) =>
      db
        .update(courseTasks)
        .set({ sectionId: bucket.sectionId, position: index })
        .where(eq(courseTasks.id, id))
    )
  );
  if (updates.length === 0) return;

  await Promise.all(updates);
  revalidatePath(`/courses/${courseId}`);
}
