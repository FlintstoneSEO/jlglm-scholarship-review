import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  parseAssignmentSearch,
  parseTestingSearch,
  practiceApplicationName,
  practiceProgress,
  saveReviewerAssignment,
} from "./testing-workflow.ts";
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const assignments = [
  { id: "a1", application_id: "test1", reviewer_id: "r1", lifecycle: "active" },
  { id: "a2", application_id: "test1", reviewer_id: "r2", lifecycle: "suspended" },
];
test("assignment scope defaults to real and requires deliberate test selection", () => {
  for (const scope of [undefined, "all", "fixture", 1])
    assert.equal(parseAssignmentSearch({ scope }).scope, "real");
  assert.deepEqual(
    parseAssignmentSearch({ scope: "test", application: "test1", program: "scholarship" }),
    { scope: "test", application: "test1", program: "scholarship" },
  );
  assert.equal(parseAssignmentSearch({ application: { id: "malformed" } }).application, undefined);
});
test("guide can resume a selected application and reviewer without storing review data", () => {
  assert.deepEqual(
    parseTestingSearch({ guide: "true", application: "test1", reviewer: "r1", score: 99 }),
    { guide: true, application: "test1", reviewer: "r1" },
  );
  assert.equal(parseTestingSearch({ guide: "false" }).guide, false);
});
test("fictional labels preserve meaningful names and normalize generated labels", () => {
  assert.equal(practiceApplicationName("TEST - Sample Student", "scholarship"), "Jordan Williams");
  assert.equal(
    practiceApplicationName(
      "TEST - Sample Applicant",
      "business_growth_grant",
      "TEST - Sample Business",
    ),
    "Capital City Repair",
  );
  assert.equal(
    practiceApplicationName(
      "Grant Practice Run Test Application",
      "business_growth_grant",
      "Capital City Catering",
    ),
    "Capital City Catering",
  );
  assert.equal(
    practiceApplicationName(
      "PRACTICE Applicant 12",
      "business_growth_grant",
      "PRACTICE Business 12",
    ),
    "Riverfront Catering 3",
  );
});
test("Grant completion uses the selected active assignment and native submitted total", () => {
  const result = practiceProgress("business_growth_grant", "test1", null, assignments, [
    {
      id: "other",
      assignment_id: "other",
      reviewer_id: "r1",
      status: "completed",
      total_score: 100,
    },
    { id: "draft", assignment_id: "a1", reviewer_id: "r1", status: "in_progress", total_score: 42 },
    {
      id: "suspended",
      assignment_id: "a2",
      reviewer_id: "r2",
      status: "completed",
      total_score: 100,
    },
  ]);
  assert.equal(result[0].started, true);
  assert.equal(result[0].completed, false);
  assert.equal(result[0].score, null);
  assert.equal(result[1].completed, false);
  assert.equal(result[1].label, "Inactive assignment");
  const done = practiceProgress("business_growth_grant", "test1", null, assignments, [
    { id: "review", assignment_id: "a1", reviewer_id: "r1", status: "completed", total_score: 42 },
  ]);
  assert.equal(done[0].score, 42);
  assert.equal(done[0].completed, true);
});
test("Scholarship completion comes from legacy reviewer identity and Writing plus Rhetoric", () => {
  const result = practiceProgress("scholarship", "test1", "legacy1", assignments, [
    {
      id: "other",
      applicant_id: "legacy2",
      reviewer_id: "r1",
      is_complete: true,
      writing_score: 9,
      rhetoric_score: 9,
    },
    {
      id: "mine",
      applicant_id: "legacy1",
      reviewer_id: "r1",
      is_complete: true,
      writing_score: 7,
      rhetoric_score: 8,
      total_score: 100,
    },
  ]);
  assert.equal(result[0].completed, true);
  assert.equal(result[0].score, 15);
  assert.equal(result[1].started, false);
});
test("reset projection has no started/completed work and preserves inactive history", () => {
  const result = practiceProgress("business_growth_grant", "test1", null, assignments, []);
  assert.equal(result[0].label, "Not Started");
  assert.equal(result[0].score, null);
  assert.equal(result[1].label, "Inactive assignment");
  assert.equal(result.length, 2);
});
test("both assignment entry points preserve normal table fields and propagate failures", async () => {
  const input = {
    application_id: "real-app",
    program_id: "program",
    reviewer_id: "reviewer",
    assigned_by: "admin",
  };
  const calls: unknown[] = [];
  await saveReviewerAssignment(input, async (row) => {
    calls.push(row);
    return { error: null };
  });
  assert.deepEqual(calls, [input]);
  await assert.rejects(
    saveReviewerAssignment(input, async () => ({ error: { code: "23505", message: "duplicate" } })),
    /already has an assignment/,
  );
  await assert.rejects(
    saveReviewerAssignment(input, async () => ({
      error: { code: "42501", message: "Access denied" },
    })),
    /Access denied/,
  );
});
test("assignments cannot create practices and Testing deep links carry application and program", () => {
  const page = read("../routes/_app.assignments.tsx");
  const testing = read("../routes/_app.testing.tsx");
  assert.doesNotMatch(
    page,
    /GrantPracticeSessions|start_grant_practice|create_test_application|Start.*Practice|Create.*Practice/,
  );
  assert.match(page, /parseAssignmentSearch/);
  assert.match(page, /assignReviewer\(/);
  assert.match(page, /assignments\s*\.filter\(\(a\) => a\.application_id === applicationId\)/);
  assert.match(testing, /scope: "test", application: a\.id, program: program\.slug/);
  assert.match(testing, /hash="testing"/);
});
test("guided layer uses real assignments, own-account queues, and observed native progress", () => {
  const guide = read("../components/review/GuidedTesting.tsx");
  const loader = read("./use-testing-applications.ts");
  assert.match(guide, /assignReviewer\(/);
  assert.match(guide, /reviewerId === userId/);
  assert.match(guide, /selected reviewer must sign in/i);
  assert.match(guide, /Step \{step\} of 5/);
  assert.match(guide, /heading\.current\?\.focus/);
  assert.match(guide, /result\?\.completed/);
  assert.match(loader, /eq\("is_test", true\)/);
  assert.match(loader, /from\("reviews"\)/);
  assert.match(loader, /from\("program_reviews"\)/);
  assert.doesNotMatch(guide, /signInWith|service_role|GuidedTestReview|FakeReviewEngine/);
});
test("test operations retain server admin checks and real reporting exclusion", () => {
  const sql = read("../../supabase/migrations/20261006145039_test_applications.sql");
  assert.match(sql, /private\.current_user_has_program_role\(p_program,array\['admin'\]/);
  assert.match(sql, /not a\.is_test or auth\.uid\(\) is null/);
  assert.match(sql, /where not is_test/);
  assert.match(sql, /private\.clear_test_reviews\(p_application\)/);
  assert.match(sql, /Remove uploaded discussion\/supporting files/);
});
test("both guides include Testing and current help keeps drafts separate from submission", () => {
  for (const program of ["Scholarship", "BusinessGrowthGrant"]) {
    const guide = read(`../components/help/${program}HelpGuide.tsx`);
    assert.match(guide, /id: "testing"/);
    assert.match(guide, /HelpSection id="testing"/);
    assert.match(guide, /TestingHelpContent/);
  }
  const help = read("../components/help/TestingHelpContent.tsx");
  assert.match(help, /saved draft is not a submitted review/);
  assert.match(help, /Inactive assignments stay inactive/);
});
