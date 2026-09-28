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
