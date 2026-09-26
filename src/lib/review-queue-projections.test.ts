import assert from "node:assert/strict";
import test from "node:test";
import { projectAssignmentProgress, projectGrantQueue, projectScholarshipQueue } from "./review-queue-projections.ts";
import { mobileAdminDestinations } from "./navigation-policy.ts";
import { capabilityProjection, capabilityAllows, type ReadSource } from "./review-domain.ts";
const src = <T>(data: T | null, state: ReadSource<T>["state"] = data === null ? "empty" : "ready"): ReadSource<T> => ({ data, state });
const scholarshipApplicant = { id: "a1", application_id: "p1", first_name: "Ada", last_name: "Lovelace", email: "ada@test", graduation_high_school: "Lansing High", college_attending: "MSU", preliminary_screening_status: "eligible_for_review", review_status: "in_progress", total_score: 12, has_essay: true, has_transcript: false, applicant_signature_status: true };
const fiveAssignments = Array.from({length: 5}, (_, i) => ({id: `as${i}`, application_id: "p1", reviewer_id: `r${i}`}));
test("scholarship queue uses fixed five for no review, draft and submitted review progress", () => {
  let result = projectScholarshipQueue({ applicants: src([scholarshipApplicant]), reviews: src([]), assignments: src(fiveAssignments) });
  assert.deepEqual(result.items[0].progress.denominator, {kind: "fixed", value: 5});
  assert.equal(result.items[0].progress.completedReviews, 0);
  result = projectScholarshipQueue({ applicants: src([scholarshipApplicant]), reviews: src([{id:"d", applicant_id:"a1", reviewer_id:"r0", is_complete:false}]), assignments: src(fiveAssignments) });
  assert.equal(result.items[0].progress.startedReviews, 1);
  result = projectScholarshipQueue({ applicants: src([{...scholarshipApplicant, review_status:"reviewed"}]), reviews: src([{id:"c", applicant_id:"a1", reviewer_id:"r0", is_complete:true}]), assignments: src(fiveAssignments) });
  assert.equal(result.items[0].status.value, "submitted");
  assert.deepEqual(result.items[0].metadata.missingDocuments, ["Transcript"]);
});
test("scholarship queue reports duplicate and assignment mismatch without raw ids", () => {
  const reviews = [{id:"1", applicant_id:"a1", reviewer_id:"secret", is_complete:true},{id:"2", applicant_id:"a1", reviewer_id:"secret", is_complete:true}];
  const item = projectScholarshipQueue({applicants:src([scholarshipApplicant]), reviews:src(reviews), assignments:src([])}).items[0];
  assert.equal(item.progress.anomalies.length, 2); assert.ok(item.progress.anomalies.every(a => !a.includes("secret")));
});
const grant = { id:"g1", applicant_name:"Grace", applicant_email:null, review_status:"not_started", completed_review_count:0, average_score:0 };
const detail = { application_id:"g1", business_name:"Compiler Co", business_age_range:"1-2", lara_status:"Active", business_operating_model:"Online" };
test("grant queue supports zero, assigned, draft and submitted assignment-relative progress", () => {
  let item = projectGrantQueue({applications:src([grant]),details:src([detail]),assignments:src([]),reviews:src([])}).items[0]; assert.equal(item.progress.denominator.value,0);
  const assignments=[{id:"as",application_id:"g1",reviewer_id:"r"}];
  item=projectGrantQueue({applications:src([grant]),details:src([detail]),assignments:src(assignments),reviews:src([])}).items[0]; assert.equal(item.progress.remainingReviews,1);
  item=projectGrantQueue({applications:src([{...grant,review_status:"in_progress"}]),details:src([detail]),assignments:src(assignments),reviews:src([{id:"rv",application_id:"g1",reviewer_id:"r",status:"in_progress"}])}).items[0]; assert.equal(item.progress.startedReviews,1);
  item=projectGrantQueue({applications:src([{...grant,review_status:"completed",completed_review_count:1,average_score:8}]),details:src([detail]),assignments:src(assignments),reviews:src([{id:"rv",application_id:"g1",reviewer_id:"r",status:"completed"}])}).items[0]; assert.equal(item.status.value,"submitted"); assert.equal(item.metadata.averageScore,8);
});
test("grant secondary failure is partial_error and unknown capability is never allowed", () => {
  const result=projectGrantQueue({applications:src([grant]),details:src(null,"error"),assignments:src([]),reviews:src([])}); assert.equal(result.state,"partial_error"); assert.equal(result.items[0].metadata.businessName,null);
  assert.equal(capabilityAllows(capabilityProjection(true).canManageAssignments),false);
});
test("queue projections distinguish loading, empty, error and unavailable", () => {
  const run=(state: ReadSource<never[]>["state"])=>projectScholarshipQueue({applicants:src(null,state),reviews:src([],"ready"),assignments:src([],"ready")}).state;
  assert.equal(run("loading"),"loading"); assert.equal(run("error"),"partial_error"); assert.equal(run("unavailable"),"unavailable");
  assert.equal(projectScholarshipQueue({applicants:src([]),reviews:src([]),assignments:src([])}).state,"empty");
});
test("assignments use legacy Scholarship completion and native Grant completion", () => {
  const assignment={id:"as",application_id:"p1",reviewer_id:"r1"};
  assert.equal(projectAssignmentProgress("scholarship",assignment,[],[{id:"legacy",applicant_id:"a1",reviewer_id:"r1",is_complete:true}],"a1").completedReviews,1);
  assert.equal(projectAssignmentProgress("business_growth_grant",assignment,[{id:"as",application_id:"p1",reviewer_id:"r1",status:"completed"}],[]).completedReviews,1);
});
test("mobile admin links use established administrator predicate", () => {
  assert.deepEqual(mobileAdminDestinations(true,true).map(item=>item.to),["/assignments","/users"]);
  assert.deepEqual(mobileAdminDestinations(false,true),[]);
});
