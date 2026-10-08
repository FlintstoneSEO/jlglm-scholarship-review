import test from "node:test";
import assert from "node:assert/strict";
import {
  allocationEntries,
  allocationSummary,
  poolEntries,
  groupSnapshots,
  validPairRoster,
} from "./grant-committee.ts";
test("frozen allocation covers 40 as 14/13/13 and accounts for fixed-capacity remainder", () => {
  const balanced = Array.from({ length: 40 }, (_, i) => ({
    applicationId: String(i),
    pair: (i % 3) + 1,
    reviewers: ["a", "b"],
  }));
  assert.deepEqual(allocationSummary(allocationEntries(balanced)), {
    pool: 40,
    covered: 40,
    unallocated: 0,
    pairs: [14, 13, 13],
  });
  const fixed = balanced.map((e, i) => (i === 39 ? { ...e, pair: null, reviewers: [] } : e));
  assert.deepEqual(allocationSummary(allocationEntries(fixed)), {
    pool: 40,
    covered: 39,
    unallocated: 1,
    pairs: [13, 13, 13],
  });
  assert.equal(new Set(allocationEntries(fixed).map((e) => e.applicationId)).size, 40);
});
test("roster requires six distinct confirmed program members", () => {
  const members = ["a", "b", "c", "d", "e", "f"];
  assert.equal(validPairRoster(members, members), true);
  assert.equal(validPairRoster(["a", "b", "c", "d", "e", "e"], members), false);
  assert.equal(validPairRoster(["a", "b", "c", "d", "e", "x"], members), false);
  assert.equal(validPairRoster(["a", "b", "c"], members), false);
});
test("malformed persisted preview fails visibly rather than appearing empty", () => {
  assert.throws(() => allocationEntries({}));
  assert.throws(() => allocationEntries([{ applicationId: "a", pair: 4, reviewers: [] }]));
  assert.throws(() => poolEntries([{ id: "a", name: "Applicant" }]));
  assert.deepEqual(
    poolEntries([
      {
        id: "a",
        name: "Applicant",
        eligibility: "not_reviewed",
        exclusion: "Eligibility not confirmed Eligible",
      },
    ])[0].exclusion,
    "Eligibility not confirmed Eligible",
  );
});

test("saved group audit snapshots retain ordered identities and fail closed on malformed data", () => {
  assert.deepEqual(groupSnapshots(null), []);
  const source = [1, 2, 3].map((i) => ({
    id: String(i),
    name: "Pair " + i,
    revision: 1,
    members: ["member" + i, "peer" + i],
  }));
  assert.deepEqual(groupSnapshots(source), source);
  assert.throws(() => groupSnapshots([]));
  assert.throws(() =>
    groupSnapshots(source.map((g, i) => (i === 0 ? { ...g, members: ["same", "same"] } : g))),
  );
  assert.throws(() => groupSnapshots(source.map((g) => ({ ...g, revision: 0 }))));
});
