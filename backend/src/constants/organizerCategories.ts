export const organizerCategories = [
  "technical",
  "cultural",
  "sports",
  "literary",
  "entrepreneurship",
  "academic",
  "social-service",
  "arts",
  "other",
] as const;

export type OrganizerCategory = (typeof organizerCategories)[number];

const organizerCategoryLabelByValue: Record<OrganizerCategory, string> = {
  technical: "Technical",
  cultural: "Cultural",
  sports: "Sports",
  literary: "Literary",
  entrepreneurship: "Entrepreneurship",
  academic: "Academic",
  "social-service": "Social Service",
  arts: "Arts",
  other: "Other",
};

const organizerCategoryAliases: Record<string, OrganizerCategory> = {
  technical: "technical",
  tech: "technical",
  cultural: "cultural",
  culture: "cultural",
  sports: "sports",
  sport: "sports",
  literary: "literary",
  literature: "literary",
  entrepreneurship: "entrepreneurship",
  entrepreneurial: "entrepreneurship",
  startup: "entrepreneurship",
  academic: "academic",
  academics: "academic",
  socialservice: "social-service",
  "social-service": "social-service",
  social: "social-service",
  arts: "arts",
  art: "arts",
  other: "other",
};

export function normalizeOrganizerCategory(
  rawValue: unknown,
): OrganizerCategory | null {
  if (typeof rawValue !== "string") return null;

  const normalized = rawValue.trim().toLowerCase();
  if (!normalized) return null;

  return organizerCategoryAliases[normalized] ?? null;
}

export function getOrganizerCategoryLabel(
  category: OrganizerCategory,
): string {
  return organizerCategoryLabelByValue[category];
}

export const organizerCategoryOptions = organizerCategories.map((value) => ({
  value,
  label: getOrganizerCategoryLabel(value),
}));
