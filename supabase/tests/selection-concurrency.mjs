import { pathToFileURL } from "node:url";
const { default: EmbeddedPostgres } = await import(
  process.argv[2] ? pathToFileURL(process.argv[2]).href : "embedded-postgres"
);
import assert from "node:assert/strict";
import fs from "node:fs";
import { initializeLocalDatabase } from "./local-database-fixture.mjs";
const cluster = new EmbeddedPostgres({
  databaseDir: process.cwd() + "/supabase/.temp/selection-native-" + Date.now(),
  user: "postgres",
  password: "local-fixture-only",
  port: 55442,
  persistent: false,
  onLog: () => {},
  onError: () => {},
  initdbFlags: ["--encoding=UTF8"],
  postgresFlags: ["-h", "127.0.0.1"],
});
let clients = [];
try {
  await cluster.initialise();
  await cluster.start();
  for (let i = 0; i < 3; i++) {
    const c = cluster.getPgClient();
    await c.connect();
    clients.push(c);
  }
  const [owner, a, b] = clients;
  await initializeLocalDatabase({ exec: (sql) => owner.query(sql) });
  for (const f of [
    "grant_selections.sql",
    "grant_selection_workflow.sql",
    "grant_group_transfer.sql",
  ]) {
    await owner.query(fs.readFileSync("supabase/tests/" + f, "utf8"));
    console.log("PASS native SQL " + f);
  }
  const actor = "ae000000-0000-4000-8000-000000000001";
  await owner.query("insert into auth.users(id,email) values($1,'race@example.invalid')", [actor]);
  const p = (await owner.query("select id from public.programs where slug='business_growth_grant'"))
    .rows[0].id;
  await owner.query(
    "insert into public.user_program_access(user_id,program_id,access_role) values($1,$2,'admin')",
    [actor, p],
  );
  const ids = [1, 2, 3, 4].map((i) => "ae000000-0000-4000-9000-" + String(i).padStart(12, "0"));
  for (const id of ids)
    await owner.query(
      "insert into public.portal_applications(id,program_id,external_submission_id,applicant_name) values($1::uuid,$2,$1::text,'Synthetic race')",
      [id, p],
    );
  for (const c of [a, b]) {
    await c.query("begin");
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claim.sub',$1,true)", [actor]);
  }
  await a.query("select public.save_grant_selection($1,$2,'{}',0)", [p, ids.slice(0, 3)]);
  const pid = (await b.query("select pg_backend_pid() as pid")).rows[0].pid;
  let done = false;
  const pending = b
    .query("select public.save_grant_selection($1,$2,'{}',0)", [p, ids.slice(1)])
    .then(
      () => ({ ok: true }),
      (e) => ({ error: e.message }),
    )
    .finally(() => (done = true));
  let blocked = false;
  for (let i = 0; i < 100; i++) {
    const q = await owner.query("select wait_event_type from pg_stat_activity where pid=$1", [pid]);
    if (q.rows[0]?.wait_event_type === "Lock") {
      blocked = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 20));
  }
  assert.equal(blocked, true);
  assert.equal(done, false);
  await a.query("commit");
  const outcome = await pending;
  assert.match(outcome.error, /Selections changed/);
  await b.query("rollback");
  assert.equal(
    (
      await owner.query(
        "select count(*)::int as n from public.grant_selection_history where program_id=$1",
        [p],
      )
    ).rows[0].n,
    1,
  );
  console.log(
    "PASS native concurrency: second administrator waits on real lock, then stale write is rejected; one audit event",
  );
} finally {
  await Promise.allSettled(clients.map((c) => c.end()));
  await cluster.stop();
}
