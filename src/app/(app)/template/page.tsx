import { listTemplateItems, listTemplateSections } from "@/actions/template";
import { TemplateEditor } from "@/components/TemplateEditor";

export const dynamic = "force-dynamic";

export default async function TemplatePage() {
  const [sections, items] = await Promise.all([listTemplateSections(), listTemplateItems()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Master Template</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          This is the reusable checklist applied whenever you add a new course. Editing it
          only affects courses created afterward &mdash; existing courses show a note when
          they&apos;re out of date with this list.
        </p>
      </div>
      <TemplateEditor sections={sections} items={items} />
    </div>
  );
}
