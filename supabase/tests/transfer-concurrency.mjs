// Native, multi-connection PostgreSQL races. Only disposable loopback databases.
// Usage: TRANSFER_TEST_DATABASE_URL=... node .../transfer-concurrency.mjs <pg module path>
import assert from "node:assert/strict";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { initializeLocalDatabase } from "./local-database-fixture.mjs";

export async function runTransferConcurrency(connect) {
  const owner = await connect(),
    first = await connect(),
    second = await connect();
  try {
    assert.equal(
      (await owner.query("show server_encoding")).rows[0].server_encoding,
      "UTF8",
      "Create the disposable test database with UTF8 encoding",
    );
    await initializeLocalDatabase({ exec: (sql) => owner.query(sql) });
    await owner.query(fs.readFileSync("supabase/tests/grant_group_transfer.sql", "utf8"));
    console.log("PASS: complete transfer SQL suite on native PostgreSQL");
    const admin = "ac000000-0000-4000-8000-000000000001";
    const reviewer = "ac000000-0000-4000-8000-000000000002";
    await owner.query(
      `insert into auth.users(id,email) values($1,'race-admin@example.invalid'),($2,'race-reviewer@example.invalid')`,
      [admin, reviewer],
    );
    const peer = "ac000000-0000-4000-8000-000000000003";
    const destinations = [
      "ac000000-0000-4000-8000-000000000004",
      "ac000000-0000-4000-8000-000000000005",
    ];
    for (const id of [peer, ...destinations])
      await owner.query("insert into auth.users(id,email) values($1,$2)", [
        id,
        `synthetic-${id}@example.invalid`,
      ]);
    await owner.query("update public.profiles set account_setup_completed=true");
    const program = (
      await owner.query("select id from public.programs where slug='business_growth_grant'")
    ).rows[0].id;
    await owner.query(
      "insert into public.user_program_access(user_id,program_id,access_role) values($1,$3,'admin'),($2,$3,'reviewer')",
      [admin, reviewer, program],
    );
    for (const id of [peer, ...destinations])
      await owner.query(
        "insert into public.user_program_access(user_id,program_id,access_role) values($1,$2,'reviewer')",
        [id, program],
      );
    await owner.query("select set_config('request.jwt.claim.sub',$1,false)", [admin]);
    const destination = (
      await owner.query(
        "select public.save_grant_reviewer_group($1,'Synthetic destination',$2::uuid[]) as id",
        [program, destinations],
      )
    ).rows[0].id;
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
      await owner.query(
        "insert into public.reviewer_assignments(application_id,program_id,reviewer_id) values($1,$2,$3)",
        [id, program, peer],
      );
      await owner.query("select set_config('request.jwt.claim.sub',$1,false)", [reviewer]);
      await owner.query("select public.declare_grant_no_conflict($1)", [assignment]);
      await owner.query("select set_config('request.jwt.claim.sub',$1,false)", [admin]);
    }
    const begin = async (client, actor) => {
      await client.query("begin; set local role authenticated; set local lock_timeout='5s'");
      await client.query("select set_config('request.jwt.claim.sub',$1,true)", [actor]);
    };
    const impact = async (id) =>
      (await owner.query("select public.grant_transfer_impact($1,$2) as impact", [id, destination]))
        .rows[0].impact;
    const mark = (client, id, expected) =>
      client.query(
        "select public.transfer_grant_application($1,$2,'Synthetic concurrency reason',$3,$4)",
        [
          id,
          destination,
          expected,
          `ac000000-0000-4000-9000-${String(ids.indexOf(id) + 1).padStart(12, "0")}`,
        ],
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

    // Submission commits first. Transfer waits, then rejects stale confirmation.
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
    assert.match(stale.error?.message ?? "", /preview is stale/);
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

    // Transfer commits first. Submission waits, then rejects without creating a review.
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
    assert.match(excluded.error?.message ?? "", /assignment_transferred|active assignment/);
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
    console.log("PASS: transfer-first race waits, rejects stale submission and creates no review");

    // Two identical admin requests serialize into one immutable event.
    await begin(first, admin);
    const replayImpact = await impact(ids[2]);
    const replay1 = await mark(first, ids[2], replayImpact);
    await begin(second, admin);
    const repeat = mark(second, ids[2], replayImpact);
    await secondBlocked();
    await first.query("commit");
    assert.deepEqual((await repeat).rows, replay1.rows);
    await second.query("commit");
    assert.equal(
      (
        await owner.query(
          "select count(*)::int as n from public.grant_group_transfer_events where application_id=$1",
          [ids[2]],
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
  const url = new URL(process.env.TRANSFER_TEST_DATABASE_URL ?? "");
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
  assert.match(url.pathname, /^\/transfer_test_/);
  const { Client } = await import(pathToFileURL(process.argv[2]).href);
  await runTransferConcurrency(async () => {
    const client = new Client({ connectionString: url.href });
    await client.connect();
    return client;
  });
}
