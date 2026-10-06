import assert from "node:assert/strict";
import test from "node:test";
import {
  productionApplications,
  testApplications,
  matchesApplicationScope,
} from "./application-scope.ts";
test("explicit test marker isolates even extreme fictional scores from production aggregates", () => {
  const rows = [
    { id: "A", score: 20, is_test: false },
    { id: "B", score: 40, is_test: false },
    { id: "C", score: 100000, is_test: true },
  ];
  const real = productionApplications(rows);
  assert.equal(real.length, 2);
  assert.equal(real.reduce((sum, a) => sum + a.score, 0) / real.length, 30);
  assert.deepEqual(
    testApplications(rows).map((a) => a.id),
    ["C"],
  );
  assert.equal(matchesApplicationScope(true, "real"), false);
  assert.equal(matchesApplicationScope(false, "test"), false);
  assert.equal(matchesApplicationScope(true, "all"), true);
});
