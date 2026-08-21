"use server";

import { db } from "@/db";
import { semesters } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function listSemesters() {
  return db.query.semesters.findMany({
    orderBy: [desc(semesters.startDate)],
  });
}

export async function getSemester(id: number) {
  return db.query.semesters.findFirst({
    where: eq(semesters.id, id),
  });
}

export async function createSemester(input: { name: string; startDate: string; endDate: string }) {
  const name = input.name.trim();
  if (!name) throw new Error("Semester name is required.");
  if (!input.startDate) throw new Error("Start date is required.");
  if (!input.endDate) throw new Error("End date is required.");
  if (input.endDate < input.startDate) throw new Error("End date must be after the start date.");

  const [created] = await db
    .insert(semesters)
    .values({ name, startDate: input.startDate, endDate: input.endDate })
    .returning({ id: semesters.id });

  revalidatePath("/");
  return created;
}

export async function updateSemester(
  id: number,
  input: { name: string; startDate: string; endDate: string }
) {
  const name = input.name.trim();
  if (!name) throw new Error("Semester name is required.");
  if (!input.startDate) throw new Error("Start date is required.");
  if (!input.endDate) throw new Error("End date is required.");
  if (input.endDate < input.startDate) throw new Error("End date must be after the start date.");

  await db
    .update(semesters)
    .set({ name, startDate: input.startDate, endDate: input.endDate })
    .where(eq(semesters.id, id));

  revalidatePath("/");
}

export async function deleteSemester(id: number) {
  await db.delete(semesters).where(eq(semesters.id, id));
  revalidatePath("/");
}
