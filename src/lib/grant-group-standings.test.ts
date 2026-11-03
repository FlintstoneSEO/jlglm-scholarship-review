import test from "node:test";
import assert from "node:assert/strict";
import { grantGroupStandings } from "./grant-group-standings.ts";
import type { GrantRankingRow } from "./grant-ranking-summary.ts";

test("group ranks restart, preserve ties and skip unranked applications", () => {
  const rows = [1,2,2,4,5,null,6].map((rank, i) => ({applicationId: String(i), rank}) as GrantRankingRow);
  const memberships = ["A","B","B","A","B","A"].map((group, i) => ({
    group_id: group, group_name: group, application_id: String(i) as string | null,
  }));
  memberships.push({group_id:"C", group_name:"Empty", application_id:null});
  const {groups, unassigned} = grantGroupStandings(rows,memberships);
  assert.deepEqual(groups.get("A")?.entries.map(entry=>entry.rank),[1,2]);
  assert.deepEqual(groups.get("B")?.entries.map(entry=>entry.rank),[1,1,3]);
  assert.deepEqual(groups.get("C")?.entries,[]);
  assert.deepEqual(unassigned,[rows[6]]);
});
