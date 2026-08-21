import { listSemesters } from "@/actions/semesters";
import { Sidebar } from "@/components/Sidebar";
import { CourseProgressProvider } from "@/components/CourseProgressContext";
import { TaskFilterProvider } from "@/components/TaskFilterContext";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const semesters = await listSemesters();

  return (
    <CourseProgressProvider>
      <TaskFilterProvider>
        <div className="flex h-screen">
          <Sidebar semesters={semesters} />
          <main className="min-w-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl px-6 py-8">{children}</div>
          </main>
        </div>
      </TaskFilterProvider>
    </CourseProgressProvider>
  );
}
