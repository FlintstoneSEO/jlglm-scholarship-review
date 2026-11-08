import assert from "node:assert/strict";
import { PGlite } from "../.temp/committee-test/node_modules/@electric-sql/pglite/dist/index.js";
import { initializeLocalDatabase } from "./local-database-fixture.mjs";
const db = new PGlite();
await initializeLocalDatabase(db);
const actor = (i) => `ae000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
const app = (i) => `ae000000-0000-4000-9000-${String(i).padStart(12, "0")}`;
const grant = (await db.query("select id from public.programs where slug='business_growth_grant'"))
  .rows[0].id;
const scholarship = (await db.query("select id from public.programs where slug='scholarship'"))
  .rows[0].id;
const query = (sql, args = []) => db.query(sql, args);
const as = async (i) => {
  await db.exec("reset role");
  await query("select set_config('request.jwt.claim.sub',$1,false)", [actor(i)]);
  await db.exec("set role authenticated");
};
const state = async (i = 1) =>
  (await query("select public.application_email_workspace($1) as s", [app(i)])).rows[0].s;
const reserve = async (
  i = 1,
  kind = "decision",
  fingerprint = null,
  subject = "Application Decision",
  body = "Dear Owner, thank you for applying.",
) =>
  query(
    "select public.reserve_application_email(gen_random_uuid(),$1,$2,$3,$4,$5,true,true) as id",
    [app(i), fingerprint ?? (await state(i)).fingerprint, kind, subject, body],
  );
try {
  for (let i = 1; i <= 4; i++)
    await query("insert into auth.users(id,email) values($1,$2)", [
      actor(i),
      `actor${i}@example.invalid`,
    ]);
  for (const [i, role, p] of [
    [1, "admin", grant],
    [2, "reviewer", grant],
    [3, "viewer", grant],
    [4, "admin", scholarship],
  ])
    await query(
      "insert into public.user_program_access(user_id,program_id,access_role) values($1,$2,$3)",
      [actor(i), p, role],
    );
  for (let i = 1; i <= 8; i++)
    await query(
      "insert into public.portal_applications(id,program_id,applicant_name,applicant_email,external_submission_id,is_test) values($1::uuid,$2,$3,$4,$1::uuid::text,$5)",
      [app(i), grant, `Synthetic Owner ${i}`, `owner${i}@example.invalid`, i === 6],
    );
  await query("update public.portal_applications set status='withdrawn' where id=$1", [app(7)]);
  await query("update public.portal_applications set applicant_email=null where id=$1", [app(8)]);
  for (const i of [2, 3, 4]) {
    await as(i);
    await assert.rejects(state(), /administrator access/);
  }
  await as(1);
  const markSent = async (i, fingerprint) =>
    query("select public.record_grant_decision_email_sent($1,$2)", [
      app(i),
      fingerprint ?? (await state(i)).fingerprint,
    ]);
  assert.equal((await state()).reviewComplete, false);
  await assert.rejects(markSent(1), /Record a grant decision/);
  await assert.rejects(reserve(), /Complete all required reviews/);
  await assert.rejects(reserve(1, "recipient"), /finalized recipient/);
  await assert.rejects(state(6), /active real/);
  await assert.rejects(state(7), /active real/);
  for (const i of [1, 8])
    await query("select public.record_application_non_selection($1,$2,true,$3)", [
      app(i),
      (await state(i)).fingerprint,
      "Committee explicitly recorded non-selection.",
    ]);
  await assert.rejects(markSent(1, "stale"), /changed/);
  await markSent(1);
  await markSent(1);
  const sentRows = (await query("select * from public.grant_decision_email_sent")).rows;
  assert.equal(sentRows.length, 1);
  assert.equal(sentRows[0].recorded_by, actor(1));
  assert.equal(sentRows[0].decision_id, (await state()).decisionId);
  for (const i of [2, 3, 4]) {
    await as(i);
    assert.equal((await query("select * from public.grant_decision_email_sent")).rows.length, 0);
    await assert.rejects(markSent(1, "test"), /administrator access/);
  }
  await as(1);
  await assert.rejects(reserve(8), /valid applicant email/);
  await assert.rejects(reserve(1, "decision", "stale"), /changed/);
  await assert.rejects(reserve(1, "decision", null, "Denial"), /wording/);
  await assert.rejects(reserve(1, "decision", null, "Decision", "{{name}}"), /placeholders/);
  await assert.rejects(reserve(1, "decision", null, "Decision\r\nBcc: x@y.org"), /invalid lengths/);
  const id = (await reserve()).rows[0].id;
  await assert.rejects(reserve(), /duplicate key/);
  await assert.rejects(
    query("select public.record_application_non_selection($1,$2,false,$3)", [
      app(1),
      (await state()).fingerprint,
      "A change while sending must fail.",
    ]),
    /reserved or has been sent/,
  );
  await db.exec("reset role");
  await assert.rejects(
    query("update public.portal_applications set applicant_email=$1 where id=$2", [
      "changed@example.invalid",
      app(1),
    ]),
    /email is pending/,
  );
  await as(1);
  await query("select public.save_grant_selection($1,$2,$3,0)", [
    grant,
    [app(1), app(2), app(3)],
    [],
  ]);
  await assert.rejects(
    query("select public.save_grant_selection($1,$2,$3,1)", [
      grant,
      [app(1), app(2), app(3)],
      [app(1), app(2)],
    ]),
    /Not selected decision/,
  );
  await query("select public.save_grant_selection($1,$2,$3,1)", [
    grant,
    [app(1), app(2), app(3)],
    [app(2), app(3)],
  ]);
  await assert.rejects(reserve(2), /Complete all required reviews/);
  await markSent(2);
  assert.equal(
    (
      await query(
        "select decision_id from public.grant_decision_email_sent where application_id=$1",
        [app(2)],
      )
    ).rows[0].decision_id,
    null,
  );
  await reserve(2, "recipient");
  await assert.rejects(
    query("select public.reconcile_application_email($1,false,$2)", [
      id,
      "Verified rejection in provider records.",
    ]),
    /five minutes/,
  );
  await db.exec("reset role");
  await query(
    "update public.application_emails set updated_at=now()-interval '10 minutes',status='unknown' where id=$1",
    [id],
  );
  await as(1);
  await query("select public.reconcile_application_email($1,false,$2)", [
    id,
    "Verified explicit provider rejection for this message reference.",
  ]);
  await reserve();
  await as(2);
  assert.equal((await query("select * from public.application_emails")).rows.length, 0);
  assert.equal((await query("select * from public.application_decision_events")).rows.length, 0);
  await assert.rejects(
    query("select public.reconcile_application_email($1,false,$2)", [
      id,
      "Reviewer cannot authorize retry.",
    ]),
    /administrator access/,
  );
  await db.exec("reset role");
  // Seed historical review rows only; normal review submission is covered by existing DB suites.
  for (const reviewer of [actor(1), actor(2)])
    await query(
      "insert into public.reviewer_assignments(application_id,program_id,reviewer_id) values($1,$2,$3)",
      [app(5), grant, reviewer],
    );
  await query(
    "insert into public.reviewer_assignments(application_id,program_id,reviewer_id) values($1,$2,$3)",
    [app(4), grant, actor(2)],
  );
  const assignment = (
    await query("select id from public.reviewer_assignments where application_id=$1", [app(4)])
  ).rows[0].id;
  await db.exec("alter table public.program_reviews disable trigger user");
  await query(
    "insert into public.program_reviews(assignment_id,application_id,program_id,reviewer_id,status) values($1,$2,$3,$4,'completed')",
    [assignment, app(4), grant, actor(2)],
  );
  await query(
    "insert into public.program_reviews(assignment_id,application_id,program_id,reviewer_id,status) select id,application_id,program_id,reviewer_id,'completed' from public.reviewer_assignments where application_id=$1 and reviewer_id=$2",
    [app(5), actor(2)],
  );
  await db.exec("alter table public.program_reviews enable trigger user");
  await as(1);
  assert.equal((await state(5)).reviewComplete, false);
  assert.equal((await state(5)).completed, 1);
  await assert.rejects(reserve(5), /Complete all required reviews/);
  await db.exec("reset role");
  await query(
    "update public.reviewer_assignments set lifecycle='suspended' where application_id=$1 and reviewer_id=$2",
    [app(5), actor(1)],
  );
  await as(1);
  assert.equal((await state(5)).assigned, 1);
  assert.equal((await state(5)).reviewComplete, true);
  await as(1);
  assert.equal((await state(4)).reviewComplete, true);
  await reserve(4);
  await db.exec("reset role");
  await assert.rejects(
    query("update public.reviewer_assignments set due_at=now() where id=$1", [assignment]),
    /email is pending/,
  );
  const privileges = await query(
    "select has_table_privilege('authenticated','public.application_emails','UPDATE') as edit, has_function_privilege('anon','public.reserve_application_email(uuid,uuid,text,text,text,text,boolean,boolean)','EXECUTE') as anon",
  );
  assert.deepEqual(privileges.rows[0], { edit: false, anon: false });
  console.log(
    "PASS: all migrations; email role isolation, decisions, zero/complete reviews, winner exclusion, stale previews, content validation, unique sends, pending guards, reconciliation, RLS",
  );
} finally {
  await db.close();
}
