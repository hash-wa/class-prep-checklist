import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  date,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Single-row marker touched by every template-mutating action (item/section create, update,
// delete, reorder — anything). MAX(template_items.updated_at) alone can't detect deletions or
// reorders (a delete doesn't bump any remaining row's timestamp), which silently let deleted
// template items stay in synced courses forever. This is the reliable "has anything changed"
// signal the lazy course auto-sync's staleness check reads instead.
export const templateMeta = pgTable("template_meta", {
  id: integer("id").primaryKey(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const templateSections = pgTable("template_sections", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const templateItems = pgTable("template_items", {
  id: serial("id").primaryKey(),
  sectionId: integer("section_id").references(() => templateSections.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  description: text("description"),
  offsetDays: integer("offset_days").notNull(),
  dueDateAnchor: text("due_date_anchor", { enum: ["start", "end"] }).notNull().default("start"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const templateSubItems = pgTable("template_sub_items", {
  id: serial("id").primaryKey(),
  templateItemId: integer("template_item_id")
    .notNull()
    .references(() => templateItems.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  position: integer("position").notNull().default(0),
});

export const templateSectionsRelations = relations(templateSections, ({ many }) => ({
  items: many(templateItems),
}));

export const templateItemsRelations = relations(templateItems, ({ one, many }) => ({
  section: one(templateSections, {
    fields: [templateItems.sectionId],
    references: [templateSections.id],
  }),
  subItems: many(templateSubItems),
}));

export const templateSubItemsRelations = relations(templateSubItems, ({ one }) => ({
  templateItem: one(templateItems, {
    fields: [templateSubItems.templateItemId],
    references: [templateItems.id],
  }),
}));

export const semesters = pgTable("semesters", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const courses = pgTable("courses", {
  id: serial("id").primaryKey(),
  semesterId: integer("semester_id")
    .notNull()
    .references(() => semesters.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  templateSnapshotVersion: timestamp("template_snapshot_version", { withTimezone: true }).notNull(),
  autoSync: boolean("auto_sync").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const courseSections = pgTable("course_sections", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  position: integer("position").notNull().default(0),
  sourceTemplateSectionId: integer("source_template_section_id").references(
    () => templateSections.id,
    { onDelete: "set null" }
  ),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const courseTasks = pgTable(
  "course_tasks",
  {
    id: serial("id").primaryKey(),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    sectionId: integer("section_id").references(() => courseSections.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description"),
    offsetDays: integer("offset_days").notNull(),
    dueDateAnchor: text("due_date_anchor", { enum: ["start", "end"] }).notNull().default("start"),
    position: integer("position").notNull().default(0),
    done: boolean("done").notNull().default(false),
    irrelevant: boolean("irrelevant").notNull().default(false),
    sourceTemplateItemId: integer("source_template_item_id").references(
      () => templateItems.id,
      { onDelete: "set null" }
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Prevents concurrent/overlapping syncs from ever inserting two course_tasks linked to the
    // same master-template item for the same course (NULLs, i.e. custom tasks, are unaffected —
    // Postgres never treats two NULLs as duplicates under a unique index).
    uniqueIndex("course_tasks_course_source_template_item_unique").on(
      table.courseId,
      table.sourceTemplateItemId
    ),
  ]
);

export const courseTaskSubItems = pgTable("course_task_sub_items", {
  id: serial("id").primaryKey(),
  courseTaskId: integer("course_task_id")
    .notNull()
    .references(() => courseTasks.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  position: integer("position").notNull().default(0),
  done: boolean("done").notNull().default(false),
});

export const courseSectionsRelations = relations(courseSections, ({ many }) => ({
  tasks: many(courseTasks),
}));

export const courseTasksRelations = relations(courseTasks, ({ one, many }) => ({
  section: one(courseSections, {
    fields: [courseTasks.sectionId],
    references: [courseSections.id],
  }),
  subItems: many(courseTaskSubItems),
}));

export const courseTaskSubItemsRelations = relations(courseTaskSubItems, ({ one }) => ({
  courseTask: one(courseTasks, {
    fields: [courseTaskSubItems.courseTaskId],
    references: [courseTasks.id],
  }),
}));
