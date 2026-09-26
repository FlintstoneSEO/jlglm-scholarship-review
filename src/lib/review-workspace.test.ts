import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const workspace = read("../components/review/ReviewWorkspace.tsx");
const rubric = read("../components/review/ReviewRubric.tsx");
const documents = read("../components/review/SupportingDocuments.tsx");
const actions = read("../components/review/ReviewActions.tsx");
const scholarship = read("../routes/_app.applicants.$id.tsx");
const grant = read("../routes/_app.grants.$id.tsx");

test("workspace owns typed visible sections, active tabs, read states, progress, and return navigation", () => {
  for (const expected of [
    "ReviewWorkspaceSection",
    'role="tablist"',
    'role="tabpanel"',
    'props.state === "loading"',
    'props.state === "partial_error"',
    'props.state === "unavailable"',
    "<ReviewProgress",
    "props.queuePath",
  ])
    assert.match(workspace, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("Scholarship keeps fixed rubric semantics and program-specific notes/contact", () => {
  assert.match(scholarship, /<ReviewWorkspace/);
  assert.match(scholarship, /REVIEWERS_PER_APPLICANT/);
  assert.match(scholarship, /MAX_REVIEWER_SCORE/);
  assert.match(scholarship, /id: "notes"/);
  assert.match(scholarship, /id: "contact"/);
  assert.match(scholarship, /writing_score: writing/);
  assert.match(scholarship, /rhetoric_score: rhetoric/);
});

test("Grant keeps dynamic criteria, native writes, comments, and document provenance", () => {
  assert.match(grant, /<ReviewWorkspace/);
  assert.match(grant, /criteria\.map/);
  assert.match(grant, /program_reviews/);
  assert.match(grant, /review_scores/);
  assert.match(grant, /reviewer_comments/);
  assert.match(grant, /"external" : "private_storage"/);
});

test("shared rubric supports arbitrary maxima, missing scores, validation and labels", () => {
  assert.match(rubric, /maximum: number/);
  assert.match(rubric, /score: number \| null/);
  assert.match(rubric, /aria-invalid/);
  assert.match(rubric, /htmlFor=/);
});

test("documents and actions expose safe states without reopened behavior", () => {
  for (const source of ["external", "private_storage", "scholarship_original", "discussion_copy"])
    assert.doesNotMatch(documents, new RegExp(`if.*${source}`));
  assert.match(documents, /Loading documents/);
  assert.match(documents, /currently unavailable/);
  assert.match(actions, /Saving…/);
  assert.match(actions, /Submitting…/);
  assert.doesNotMatch(actions, /reopen/i);
});
