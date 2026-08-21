export type SectionLike = { id: number; title: string; position: number };
export type SectionedItem = { id: number; sectionId: number | null; position: number };

export type SectionGroup<S extends SectionLike, I extends SectionedItem> = {
  sectionId: number | null;
  section: S | null;
  items: I[];
};

/** Groups items by section, unsectioned items first, sections ordered by position, items within each ordered by position. */
export function groupBySection<S extends SectionLike, I extends SectionedItem>(
  sections: S[],
  items: I[]
): SectionGroup<S, I>[] {
  const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position;
  const sortedSections = [...sections].sort(byPosition);

  const unsectioned: SectionGroup<S, I> = {
    sectionId: null,
    section: null,
    items: items.filter((i) => i.sectionId === null).sort(byPosition),
  };

  const sectionGroups = sortedSections.map((section) => ({
    sectionId: section.id,
    section,
    items: items.filter((i) => i.sectionId === section.id).sort(byPosition),
  }));

  return [unsectioned, ...sectionGroups];
}

/** Flattens grouped buckets into the {sectionId, orderedIds} payload shape reorder server actions expect. */
export function buildReorderBuckets<I extends SectionedItem>(
  groups: { sectionId: number | null; items: I[] }[]
): { sectionId: number | null; orderedIds: number[] }[] {
  return groups.map((g) => ({ sectionId: g.sectionId, orderedIds: g.items.map((i) => i.id) }));
}
