import type { GrantRankingRow } from "./grant-ranking-summary.ts";

type Membership = { group_id: string; group_name: string; application_id: string | null };

export function grantGroupStandings(overall: GrantRankingRow[], memberships: Membership[]) {
  const groups = new Map<
    string,
    { name: string; entries: { row: GrantRankingRow; rank: number }[] }
  >();
  const owners = new Map<string, string>();
  for (const m of memberships) {
    if (!groups.has(m.group_id)) groups.set(m.group_id, { name: m.group_name, entries: [] });
    if (m.application_id) owners.set(m.application_id, m.group_id);
  }
  const unassigned: GrantRankingRow[] = [];
  // The overall engine supplies ordered, validated rows and exact-score ties.
  for (const row of overall) {
    if (row.rank === null) continue;
    const group = groups.get(owners.get(row.applicationId) ?? "");
    if (!group) {
      unassigned.push(row);
      continue;
    }
    const previous = group.entries.at(-1);
    const rank =
      previous && previous.row.rank === row.rank ? previous.rank : group.entries.length + 1;
    group.entries.push({ row, rank });
  }
  return { groups, unassigned };
}
