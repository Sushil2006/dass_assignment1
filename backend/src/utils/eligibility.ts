export type ParticipantType = "iiit" | "non-iiit";

type EligibilityConstraint = "all" | ParticipantType | null;

function normalizeEligibility(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_]+/g, "-");
}

function parseEligibilityConstraint(rawEligibility: string): EligibilityConstraint {
  const normalized = normalizeEligibility(rawEligibility);

  if (!normalized || normalized === "all" || normalized === "any") {
    return "all";
  }

  if (
    normalized === "iiit" ||
    normalized === "iiit-only" ||
    normalized === "iiit-students"
  ) {
    return "iiit";
  }

  if (
    normalized === "non-iiit" ||
    normalized === "noniiit" ||
    normalized === "non-iiit-only" ||
    normalized === "external"
  ) {
    return "non-iiit";
  }

  // Unrecognized free-form eligibility values stay permissive.
  return null;
}

export function isParticipantEligibleForEvent(params: {
  eventEligibility: string;
  participantType?: ParticipantType | null;
}): boolean {
  const requiredType = parseEligibilityConstraint(params.eventEligibility);
  if (requiredType === "all" || requiredType === null) return true;
  return params.participantType === requiredType;
}
