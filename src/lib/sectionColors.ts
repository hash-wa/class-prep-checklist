// Cycled by section id (assigned once, at creation) so a section's color never
// changes just because it gets reordered, and each looks visually distinct from
// its neighbors.
export const SECTION_COLOR_STYLES = [
  { gradient: "from-blue-500 to-indigo-600", border: "border-indigo-400 dark:border-indigo-500" },
  { gradient: "from-emerald-500 to-teal-600", border: "border-teal-400 dark:border-teal-500" },
  { gradient: "from-amber-500 to-orange-600", border: "border-orange-400 dark:border-orange-500" },
  { gradient: "from-pink-500 to-rose-600", border: "border-rose-400 dark:border-rose-500" },
  { gradient: "from-violet-500 to-purple-600", border: "border-purple-400 dark:border-purple-500" },
  { gradient: "from-cyan-500 to-sky-600", border: "border-sky-400 dark:border-sky-500" },
  { gradient: "from-fuchsia-500 to-pink-600", border: "border-pink-400 dark:border-pink-500" },
  { gradient: "from-lime-500 to-emerald-600", border: "border-emerald-400 dark:border-emerald-500" },
] as const;

export function getSectionColorStyle(colorIndex: number) {
  const n = SECTION_COLOR_STYLES.length;
  return SECTION_COLOR_STYLES[((colorIndex % n) + n) % n];
}
