export const distributionTabs = ["groups", "allocation", "progress"] as const;
export type DistributionTab = (typeof distributionTabs)[number];
export function groupOptionUnavailable(
  group: { id: string; members: string[] },
  selected: string[],
  slot: number,
  eligibleIds: string[],
) {
  return (
    group.members.length !== 2 ||
    new Set(group.members).size !== 2 ||
    group.members.some((id) => !eligibleIds.includes(id)) ||
    selected.some((id, index) => index !== slot && id === group.id)
  );
}
export function distributionTab(value: unknown): DistributionTab {
  return distributionTabs.includes(value as DistributionTab)
    ? (value as DistributionTab)
    : "groups";
}
export function groupReadiness(
  groups: { id: string; name: string; members: string[] }[],
  eligibleIds: string[],
) {
  const eligible = new Set(eligibleIds);
  const issues = groups.flatMap((g) => {
    const valid = g.members.filter((id) => eligible.has(id));
    return valid.length !== 2 || g.members.length !== 2
      ? [`${g.name} needs exactly two eligible reviewers (${valid.length} currently eligible).`]
      : [];
  });
  if (new Set(groups.map((g) => g.id)).size !== groups.length)
    issues.push("Choose each reviewer group only once.");
  const members = groups.flatMap((g) => g.members);
  const duplicate = new Set(members).size !== members.length;
  if (duplicate)
    issues.push(
      "A reviewer appears in more than one group. Select three groups with no shared reviewers.",
    );
  if (groups.length !== 3) issues.push("Select three complete reviewer groups for allocation.");
  return {
    ready: issues.length === 0,
    issues,
    reviewers: new Set(members.filter((id) => eligible.has(id))).size,
  };
}
