export const grantApplicationRubric = {
  "Business & Market": "Business Narrative & Value Proposition",
  "Financial Health": "Financial Performance & Business Health",
  "Growth Opportunity": "Growth Opportunity",
  "Use of Funds": "Use of Grant Funds",
  "Expected Impact": "Expected Business Impact & Measurable Outcomes",
  "Business Capacity": "Business Capacity & Financial Management",
  "Why This Grant": "Why This Grant, and Why Now?",
} as const;

export type GrantApplicationSection = keyof typeof grantApplicationRubric;

export function criterionForGrantSection<T extends { name: string }>(
  section: string,
  criteria: readonly T[],
): T | undefined {
  const name = grantApplicationRubric[section as GrantApplicationSection];
  return name ? criteria.find((criterion) => criterion.name === name) : undefined;
}

export type GrantScoreDraft = Record<string, number | null>;

export function grantScoreDraft(
  criteria: readonly { id: string }[],
  scores: readonly { criterion_id: string; points: number }[],
): GrantScoreDraft {
  const persisted = new Map(scores.map((score) => [score.criterion_id, score.points]));
  return Object.fromEntries(
    criteria.map((criterion) => [criterion.id, persisted.get(criterion.id) ?? null]),
  );
}

export function grantScoreEntries(criteria: readonly { id: string }[], draft: GrantScoreDraft) {
  return criteria.flatMap((criterion) => {
    const value = draft[criterion.id];
    return value == null ? [] : [{ criterionId: criterion.id, value }];
  });
}

export function validGrantScore(value: number | null, maximum: number): boolean {
  return value === null || (Number.isFinite(value) && value >= 0 && value <= maximum);
}

export function canScoreAssignedGrant(
  assignmentLifecycle: string | null | undefined,
  programAccessRole: string | null | undefined,
): boolean {
  return (
    assignmentLifecycle === "active" &&
    (programAccessRole === "reviewer" || programAccessRole === "admin")
  );
}

export function grantReviewSummary(
  criteria: readonly { id: string; name: string; maximum_points: number }[],
  draft: GrantScoreDraft,
) {
  const unscored = criteria.filter((criterion) => draft[criterion.id] == null);
  const invalid = criteria.filter(
    (criterion) => !validGrantScore(draft[criterion.id] ?? null, criterion.maximum_points),
  );
  const completedCriteria = criteria.length - unscored.length;
  return {
    completedCriteria,
    totalCriteria: criteria.length,
    unscoredCriteria: unscored.length,
    unscoredNames: unscored.map((criterion) => criterion.name),
    currentScore: criteria.reduce((sum, criterion) => sum + (draft[criterion.id] ?? 0), 0),
    maximumScore: criteria.reduce((sum, criterion) => sum + criterion.maximum_points, 0),
    completionPercent: criteria.length
      ? Math.round((completedCriteria / criteria.length) * 100)
      : 0,
    scoresValid: invalid.length === 0,
    complete: criteria.length > 0 && unscored.length === 0 && invalid.length === 0,
  };
}

export function grantReviewActionState({
  assigned,
  scoringAllowed,
  submitted,
  hasRubricVersion,
  summary,
}: {
  assigned: boolean;
  scoringAllowed: boolean;
  submitted: boolean;
  hasRubricVersion: boolean;
  summary: ReturnType<typeof grantReviewSummary>;
}) {
  const canSave =
    assigned && scoringAllowed && !submitted && hasRubricVersion && summary.totalCriteria > 0;
  return { canSave, canSubmit: canSave && summary.complete };
}
