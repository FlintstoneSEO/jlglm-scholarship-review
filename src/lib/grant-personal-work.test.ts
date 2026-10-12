import assert from "node:assert/strict";
import test from "node:test";
import { personalGrantWork, type PersonalWorkSource } from "./grant-personal-work.ts";
const source = (): PersonalWorkSource => ({
  assignments: [
    { id: "own", application_id: "app", reviewer_id: "me", lifecycle: "active" },
    { id: "peer", application_id: "app", reviewer_id: "other", lifecycle: "active" },
  ],
  reviews: [],
  conflicts: [],
  declarations: [{ assignment_id: "own" }],
  eligibility: [{ application_id: "app", status: "eligible" }],
  overrides: [],
  rubricReady: true,
  rubricError: false,
  assignmentError: false,
  reviewError: false,
  conflictError: false,
  declarationError: false,
  eligibilityError: false,
  overrideError: false,
});
test("personal work never adopts a peer's completion or conflict", () => {
  const data = source();
  data.reviews.push({
    id: "private-peer",
    assignment_id: "peer",
    reviewer_id: "other",
    status: "completed",
  });
  data.conflicts.push({ assignment_id: "peer" });
  assert.equal(personalGrantWork(data, "app", "me").ready, true);
  assert.equal(personalGrantWork(data, "app", "me").status, "not_started");
  data.reviews.push({ id: "mine", assignment_id: "own", reviewer_id: "me", status: "completed" });
  assert.equal(personalGrantWork(data, "app", "me").ready, false);
  assert.equal(personalGrantWork(data, "app", "me").status, "completed");
});
test("holds and replacement history never appear ready", () => {
  const data = source();
  data.conflicts.push({ assignment_id: "own" });
  assert.match(personalGrantWork(data, "app", "me").label, /On hold/);
  data.assignments[0].lifecycle = "suspended";
  assert.equal(personalGrantWork(data, "app", "me").active, false);
  data.assignments.push({
    id: "replacement",
    application_id: "app",
    reviewer_id: "new",
    lifecycle: "active",
  });
  assert.equal(personalGrantWork(data, "app", "new").ready, false);
  data.declarations.push({ assignment_id: "replacement" });
  assert.equal(personalGrantWork(data, "app", "new").ready, true);
});
test("missing reads, declaration and eligibility fail closed", () => {
  for (const key of [
    "rubricError",
    "assignmentError",
    "reviewError",
    "conflictError",
    "declarationError",
    "eligibilityError",
    "overrideError",
  ] as const) {
    const data = source();
    data[key] = true;
    assert.equal(personalGrantWork(data, "app", "me").ready, false, key);
    assert.match(personalGrantWork(data, "app", "me").label, /unavailable/);
  }
  const data = source();
  data.declarations = [];
  assert.match(personalGrantWork(data, "app", "me").label, /conflict decision needed/);
  data.declarations = [{ assignment_id: "own" }];
  data.eligibility = [];
  assert.match(personalGrantWork(data, "app", "me").label, /eligibility/);
});
test("only latest ordered scoring exception permits blocked eligibility", () => {
  const data = source();
  data.eligibility[0].status = "ineligible";
  data.overrides = [
    { application_id: "app", scoring_allowed: true, event_number: 1, created_at: "later" },
  ];
  assert.equal(personalGrantWork(data, "app", "me").ready, true);
  data.overrides.push({
    application_id: "app",
    scoring_allowed: false,
    event_number: 2,
    created_at: "earlier",
  });
  assert.equal(personalGrantWork(data, "app", "me").ready, false);
});

test("no active rubric cannot be presented as ready work", () => {
  const data = source();
  data.rubricReady = false;
  assert.equal(personalGrantWork(data, "app", "me").ready, false);
  assert.match(personalGrantWork(data, "app", "me").label, /active rubric/);
});
