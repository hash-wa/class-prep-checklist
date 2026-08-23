import { listSemesters } from "@/actions/semesters";
import { getTemplateItemCount } from "@/actions/template";
import { Sidebar } from "@/components/Sidebar";
import { CourseProgressProvider } from "@/components/CourseProgressContext";
import { TaskFilterProvider } from "@/components/TaskFilterContext";
import { TemplateItemCountProvider } from "@/components/TemplateItemCountContext";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [semesters, templateItemCount] = await Promise.all([listSemesters(), getTemplateItemCount()]);

  return (
    <CourseProgressProvider>
      <TaskFilterProvider>
        <TemplateItemCountProvider initialCount={templateItemCount}>
          <div className="flex h-screen">
            <Sidebar semesters={semesters} />
            <main className="min-w-0 flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-3xl px-6 py-8">{children}</div>
            </main>
          </div>
        </TemplateItemCountProvider>
      </TaskFilterProvider>
    </CourseProgressProvider>
  );
}
