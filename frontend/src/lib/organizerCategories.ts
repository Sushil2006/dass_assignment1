export const organizerCategoryOptions = [
  { value: "technical", label: "Technical" },
  { value: "cultural", label: "Cultural" },
  { value: "sports", label: "Sports" },
  { value: "literary", label: "Literary" },
  { value: "entrepreneurship", label: "Entrepreneurship" },
  { value: "academic", label: "Academic" },
  { value: "social-service", label: "Social Service" },
  { value: "arts", label: "Arts" },
  { value: "other", label: "Other" },
] as const;

export type OrganizerCategory = (typeof organizerCategoryOptions)[number]["value"];

const organizerCategoryLabelByValue: Record<OrganizerCategory, string> =
  organizerCategoryOptions.reduce(
    (accumulator, option) => ({
      ...accumulator,
      [option.value]: option.label,
    }),
    {} as Record<OrganizerCategory, string>,
  );

export function organizerCategoryLabel(
  category: string | null | undefined,
): string {
  if (!category) return "-";

  const normalized = category.trim().toLowerCase() as OrganizerCategory;
  return organizerCategoryLabelByValue[normalized] ?? category;
}
