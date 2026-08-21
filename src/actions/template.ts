"use server";

import { db } from "@/db";
import { templateItems, templateSections, templateSubItems } from "@/db/schema";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

function normalizeSubItems(subItems: string[] | undefined): string[] {
  return (subItems ?? []).map((s) => s.trim()).filter(Boolean);
}

async function replaceSubItems(templateItemId: number, subItems: string[]) {
  await db.delete(templateSubItems).where(eq(templateSubItems.templateItemId, templateItemId));
  const normalized = normalizeSubItems(subItems);
  if (normalized.length > 0) {
    await db.insert(templateSubItems).values(
      normalized.map((text, index) => ({ templateItemId, text, position: index }))
    );
  }
}

export async function listTemplateItems() {
  return db.query.templateItems.findMany({
    orderBy: [asc(templateItems.position), asc(templateItems.id)],
    with: { subItems: { orderBy: [asc(templateSubItems.position)] } },
  });
}

export async function listTemplateSections() {
  return db.query.templateSections.findMany({
    orderBy: [asc(templateSections.position), asc(templateSections.id)],
  });
}

export async function createTemplateSection(title: string) {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("Section title is required.");

  const [{ maxPosition }] = await db
    .select({ maxPosition: sql<number>`coalesce(max(${templateSections.position}), -1)` })
    .from(templateSections);

  const [created] = await db
    .insert(templateSections)
    .values({ title: trimmed, position: maxPosition + 1 })
    .returning({ id: templateSections.id });
  revalidatePath("/template");
  return created.id;
}

export async function renameTemplateSection(id: number, title: string) {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("Section title is required.");

  await db.update(templateSections).set({ title: trimmed }).where(eq(templateSections.id, id));
  revalidatePath("/template");
}

export async function deleteTemplateSection(id: number) {
  await db.delete(templateSections).where(eq(templateSections.id, id));
  revalidatePath("/template");
}

export async function reorderTemplateSections(orderedIds: number[]) {
  if (orderedIds.length === 0) return;

  await Promise.all(
    orderedIds.map((id, index) =>
      db.update(templateSections).set({ position: index }).where(eq(templateSections.id, id))
    )
  );

  revalidatePath("/template");
}

export async function createTemplateItem(input: {
  title: string;
  sectionId: number | null;
  subItems?: string[];
  offsetDays: number;
  dueDateAnchor?: "start" | "end";
  description?: string | null;
}) {
  const title = input.title.trim();
  if (!title) throw new Error("Title is required.");

  const [{ maxPosition }] = await db
    .select({ maxPosition: sql<number>`coalesce(max(${templateItems.position}), -1)` })
    .from(templateItems)
    .where(
      input.sectionId === null
        ? sql`${templateItems.sectionId} is null`
        : eq(templateItems.sectionId, input.sectionId)
    );

  const [created] = await db
    .insert(templateItems)
    .values({
      title,
      sectionId: input.sectionId,
      offsetDays: input.offsetDays,
      dueDateAnchor: input.dueDateAnchor ?? "start",
      description: input.description?.trim() || null,
      position: maxPosition + 1,
      updatedAt: new Date(),
    })
    .returning({ id: templateItems.id });

  await replaceSubItems(created.id, input.subItems ?? []);

  revalidatePath("/template");
  return created.id;
}

export async function updateTemplateItem(
  id: number,
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

  await db
    .update(templateItems)
    .set({
      title,
      sectionId: input.sectionId,
      offsetDays: input.offsetDays,
      dueDateAnchor: input.dueDateAnchor ?? "start",
      description: input.description?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(templateItems.id, id));

  await replaceSubItems(id, input.subItems ?? []);

  revalidatePath("/template");
}

export async function deleteTemplateItem(id: number) {
  await db.delete(templateItems).where(eq(templateItems.id, id));
  revalidatePath("/template");
}

export async function reorderTemplateItems(
  buckets: { sectionId: number | null; orderedIds: number[] }[]
) {
  const updates = buckets.flatMap((bucket) =>
    bucket.orderedIds.map((id, index) =>
      db
        .update(templateItems)
        .set({ sectionId: bucket.sectionId, position: index })
        .where(eq(templateItems.id, id))
    )
  );
  if (updates.length === 0) return;

  await Promise.all(updates);
  revalidatePath("/template");
}

/** Moves a batch of items into a section (or to unsectioned) in one call, appending them after whatever's already there. */
export async function moveTemplateItemsToSection(ids: number[], sectionId: number | null) {
  if (ids.length === 0) return;

  const [{ maxPosition }] = await db
    .select({ maxPosition: sql<number>`coalesce(max(${templateItems.position}), -1)` })
    .from(templateItems)
    .where(
      sectionId === null ? sql`${templateItems.sectionId} is null` : eq(templateItems.sectionId, sectionId)
    );

  const items = await db.query.templateItems.findMany({
    where: inArray(templateItems.id, ids),
    orderBy: [asc(templateItems.position), asc(templateItems.id)],
  });

  await Promise.all(
    items.map((item, index) =>
      db
        .update(templateItems)
        .set({ sectionId, position: maxPosition + 1 + index })
        .where(eq(templateItems.id, item.id))
    )
  );

  revalidatePath("/template");
}

export async function bulkSetTemplateItemsOffset(ids: number[], offsetDays: number, dueDateAnchor: "start" | "end") {
  if (ids.length === 0) return;

  await db
    .update(templateItems)
    .set({ offsetDays, dueDateAnchor, updatedAt: new Date() })
    .where(inArray(templateItems.id, ids));

  revalidatePath("/template");
}

export async function bulkDeleteTemplateItems(ids: number[]) {
  if (ids.length === 0) return;

  await db.delete(templateItems).where(inArray(templateItems.id, ids));

  revalidatePath("/template");
}

export async function getLatestTemplateUpdatedAt(): Promise<Date | null> {
  const rows = await db
    .select({ latest: sql<string | null>`max(${templateItems.updatedAt})` })
    .from(templateItems);
  const value = rows[0]?.latest;
  return value ? new Date(value) : null;
}
