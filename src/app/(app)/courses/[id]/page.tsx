import { notFound } from "next/navigation";
import { getCourse, getTemplateDiffForCourse, syncCourseFromTemplate } from "@/actions/courses";
import { getSemester } from "@/actions/semesters";
import { listTasksForCourse, listCourseSections } from "@/actions/tasks";
import { listTemplateItems, getLatestTemplateUpdatedAt } from "@/actions/template";
import { ChecklistEditor } from "@/components/ChecklistEditor";
import { TemplateDiffBanner } from "@/components/TemplateDiffBanner";
import { CourseSyncControl } from "@/components/CourseSyncControl";

export const dynamic = "force-dynamic";

export default async function CoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const courseId = Number(id);
  const course = await getCourse(courseId);
  if (!course) notFound();

  const semester = await getSemester(course.semesterId);
  if (!semester) notFound();

  // Locked courses stay mirrored to the master template lazily: resync right before
  // rendering rather than reacting to template edits in real time. Skip the (expensive,
  // per-item) resync entirely when nothing's changed since the last one — otherwise every
  // view of a locked course rewrites every task, even when there's nothing to do.
  if (course.autoSync) {
    const latestTemplateUpdatedAt = await getLatestTemplateUpdatedAt();
    if (latestTemplateUpdatedAt && latestTemplateUpdatedAt > course.templateSnapshotVersion) {
      await syncCourseFromTemplate(courseId);
    }
  }

  // Locked courses never show the "add from template" form (they only allow editing
  // Done/N/A/sub-item checkboxes), so availableTemplateItems is unused there — skip
  // fetching the full template list in that case.
  const [sections, tasks, allTemplateItems, diff] = await Promise.all([
    listCourseSections(courseId),
    listTasksForCourse(courseId),
    course.autoSync ? Promise.resolve([]) : listTemplateItems(),
    course.autoSync
      ? Promise.resolve({ hasChanges: false, addedCount: 0, removedCount: 0, addedTitles: [], removedTitles: [] })
      : getTemplateDiffForCourse(courseId),
  ]);

  const addedTemplateIds = new Set(
    tasks.map((t) => t.sourceTemplateItemId).filter((id): id is number => id !== null)
  );
  const availableTemplateItems = allTemplateItems
    .filter((item) => !addedTemplateIds.has(item.id))
    .map((item) => ({
      id: item.id,
      title: item.title,
      offsetDays: item.offsetDays,
      dueDateAnchor: item.dueDateAnchor,
    }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{course.name}</h1>
        <CourseSyncControl courseId={courseId} autoSync={course.autoSync} />
      </div>

      {!course.autoSync && <TemplateDiffBanner diff={diff} courseId={courseId} />}

      <ChecklistEditor
        courseId={courseId}
        courseName={course.name}
        semesterStartDate={semester.startDate}
        semesterEndDate={semester.endDate}
        sections={sections}
        tasks={tasks}
        availableTemplateItems={availableTemplateItems}
        locked={course.autoSync}
      />
    </div>
  );
}
