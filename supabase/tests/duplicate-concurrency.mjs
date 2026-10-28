// Native, multi-connection PostgreSQL races. Only disposable loopback databases.
// Usage: DUPLICATE_TEST_DATABASE_URL=... node .../duplicate-concurrency.mjs <pg module path>
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { initializeLocalDatabase } from "./local-database-fixture.mjs";

export async function runDuplicateConcurrency(connect) {
  const owner = await connect(),
    first = await connect(),
    second = await connect();
  try {
    await initializeLocalDatabase({ exec: (sql) => owner.query(sql) });
    const admin = "ac000000-0000-4000-8000-000000000001";
    const reviewer = "ac000000-0000-4000-8000-000000000002";
    await owner.query(
      `insert into auth.users(id,email) values($1,'race-admin@example.invalid'),($2,'race-reviewer@example.invalid')`,
      [admin, reviewer],
    );
    const program = (
      await owner.query("select id from public.programs where slug='business_growth_grant'")
    ).rows[0].id;
    await owner.query(
      "insert into public.user_program_access(user_id,program_id,access_role) values($1,$3,'admin'),($2,$3,'reviewer')",
      [admin, reviewer, program],
    );
    await owner.query("select set_config('request.jwt.claim.sub',$1,false)", [admin]);
    const version = (
      await owner.query("select public.create_rubric_version($1,null) as id", [program])
    ).rows[0].id;
    const criterion = (
      await owner.query(
        "insert into public.rubric_criteria(program_id,rubric_version_id,name,maximum_points,display_order) values($1,$2,'Synthetic race criterion',100,1) returning id",
        [program, version],
      )
    ).rows[0].id;
    await owner.query("select public.activate_rubric_version($1,$2)", [program, version]);
    const ids = [];
    const assignments = [];
    for (let i = 0; i < 3; i++) {
      const id = (
        await owner.query(
          "insert into public.portal_applications(program_id,external_submission_id,applicant_name) values($1,$2,'Fictional race applicant') returning id",
          [program, `synthetic-race-${i}`],
        )
      ).rows[0].id;
      ids.push(id);
      await owner.query(
        "select public.set_grant_requirement($1,key,'verified') from unnest(array['owner_eligibility','business_eligibility','lara_good_standing','required_documentation','profit_loss_2024','profit_loss_2025']) key",
        [id],
      );
      await owner.query("select public.confirm_grant_eligibility($1,'eligible')", [id]);
      const assignment = (
        await owner.query(
          "insert into public.reviewer_assignments(application_id,program_id,reviewer_id) values($1,$2,$3) returning id",
          [id, program, reviewer],
        )
      ).rows[0].id;
      assignments.push(assignment);
      await owner.query("select set_config('request.jwt.claim.sub',$1,false)", [reviewer]);
      await owner.query("select public.declare_grant_no_conflict($1)", [assignment]);
      await owner.query("select set_config('request.jwt.claim.sub',$1,false)", [admin]);
    }
    const begin = async (client, actor) => {
      await client.query("begin; set local role authenticated; set local lock_timeout='5s'");
      await client.query("select set_config('request.jwt.claim.sub',$1,true)", [actor]);
    };
    const impact = async (id) =>
      (await owner.query("select public.grant_duplicate_impact($1) as impact", [id])).rows[0]
        .impact;
    const mark = (client, id, expected) =>
      client.query(
        "select public.mark_grant_application_duplicate($1,$2,'Synthetic concurrency reason',$3)",
        [id, ids[2], expected],
      );
    const submit = (client, index) =>
      client.query(
        "select public.submit_business_grant_review($1,$2,null,0,$3,$4,'Synthetic race review','submit',$5,'grant_reviewer_certification_v1',true)",
        [
          ids[index],
          assignments[index],
          version,
          JSON.stringify([{ criterionId: criterion, value: 80 }]),
          `race-submit-${index}`,
        ],
      );
    const waitForLock = async (client) => {
      const pid = (await client.query("select pg_backend_pid() as pid")).rows[0].pid;
      return async () => {
        const deadline = Date.now() + 4000;
        while (Date.now() < deadline) {
          const result = await owner.query(
            "select wait_event_type from pg_stat_activity where pid=$1",
            [pid],
          );
          if (result.rows[0]?.wait_event_type === "Lock") return;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        throw new Error("Competing operation did not wait for the application lock");
      };
    };
    const secondBlocked = await waitForLock(second);

    // Submission commits first. Mark waits, then rejects stale confirmation.
    const before = await impact(ids[0]);
    await begin(first, reviewer);
    await submit(first, 0);
    await begin(second, admin);
    const marking = mark(second, ids[0], before).then(
      () => ({ ok: true }),
      (error) => ({ error }),
    );
    await secondBlocked();
    await first.query("commit");
    const stale = await marking;
    assert.match(stale.error?.message ?? "", /Assignments or reviews changed/);
    await second.query("rollback");
    const completed = (
      await owner.query(
        "select to_jsonb(r) as row from public.program_reviews r where application_id=$1",
        [ids[0]],
      )
    ).rows[0].row;
    await mark(owner, ids[0], await impact(ids[0]));
    assert.deepEqual(
      (
        await owner.query(
          "select to_jsonb(r) as row from public.program_reviews r where application_id=$1",
          [ids[0]],
        )
      ).rows[0].row,
      completed,
    );
    console.log(
      "PASS: submission-first race waits, rejects stale impact, then preserves committed review",
    );

    // Mark commits first. Submission waits, then rejects without creating a review.
    await begin(first, admin);
    await mark(first, ids[1], await impact(ids[1]));
    await begin(second, reviewer);
    const submitting = submit(second, 1).then(
      () => ({ ok: true }),
      (error) => ({ error }),
    );
    await secondBlocked();
    await first.query("commit");
    const excluded = await submitting;
    assert.match(excluded.error?.message ?? "", /duplicate_application/);
    await second.query("rollback");
    assert.equal(
      (
        await owner.query(
          "select count(*)::int as n from public.program_reviews where application_id=$1",
          [ids[1]],
        )
      ).rows[0].n,
      0,
    );
    console.log("PASS: marking-first race waits, rejects stale submission and creates no review");

    // Two identical admin requests serialize into one immutable event.
    await begin(first, admin);
    const replay1 = await mark(first, ids[1], before);
    await begin(second, admin);
    const repeat = mark(second, ids[1], before);
    await secondBlocked();
    await first.query("commit");
    assert.deepEqual((await repeat).rows, replay1.rows);
    await second.query("commit");
    assert.equal(
      (
        await owner.query(
          "select count(*)::int as n from public.application_duplicate_events where application_id=$1",
          [ids[1]],
        )
      ).rows[0].n,
      1,
    );
    console.log("PASS: simultaneous identical requests return one audit event");
  } finally {
    await Promise.allSettled([owner.end(), first.end(), second.end()]);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = new URL(process.env.DUPLICATE_TEST_DATABASE_URL ?? "");
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
  assert.match(url.pathname, /^\/duplicate_test_/);
  const { Client } = await import(pathToFileURL(process.argv[2]).href);
  await runDuplicateConcurrency(async () => {
    const client = new Client({ connectionString: url.href });
    await client.connect();
    return client;
  });
}
