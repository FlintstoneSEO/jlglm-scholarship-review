import { chromium } from "../.temp/committee-test/node_modules/playwright/index.mjs";
import fs from "node:fs";
import AxeBuilder from "../.temp/committee-test/node_modules/@axe-core/playwright/dist/index.mjs";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const actor = "cc000000-0000-4000-8000-000000000001",
  program = "22222222-2222-4222-8222-222222222222";
const ids = Array.from(
  { length: 6 },
  (_, i) => "cc000000-0000-4000-8000-" + String(i + 2).padStart(12, "0"),
);
const user = {
  id: actor,
  aud: "authenticated",
  role: "authenticated",
  email: "synthetic-admin@example.invalid",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: new Date().toISOString(),
};
const token =
  Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url") +
  "." +
  Buffer.from(JSON.stringify({ sub: actor, exp: Math.floor(Date.now() / 1000) + 3600 })).toString(
    "base64url",
  ) +
  ".synthetic";
await context.addInitScript(
  ({ user, token }) => {
    localStorage.setItem("jlgl.selectedProgram", "business_growth_grant");
  },
  { user, token },
);
const profiles = ids.map((id, i) => ({
  id,
  full_name: "Synthetic Committee Reviewer " + (i + 1),
  email: "reviewer" + (i + 1) + "@example.invalid",
  account_setup_completed: true,
}));
const pool = Array.from({ length: 40 }, (_, i) => ({
  id: "cc000000-0000-4000-9000-" + String(i + 1).padStart(12, "0"),
  name: "Synthetic application " + (i + 1),
  eligibility: "eligible",
  exclusion: null,
}));
let held = false;
let previews = [
  {
    id: "cc000000-0000-4000-7000-000000000001",
    program_id: program,
    actor_id: actor,
    created_at: new Date().toISOString(),
    roster: ids,
    group_snapshot: null,
    capacity_mode: "balanced",
    capacity: null,
    snapshot: pool,
    allocation: pool.map((p, i) => ({
      applicationId: p.id,
      pair: (i % 3) + 1,
      reviewers: ids.slice((i % 3) * 2, (i % 3) * 2 + 2),
    })),
    superseded_at: null,
    applied_at: null,
    applied_by: null,
  },
];
let groups = [];
let groupMembers = [];
const calls = [];
let staleApply = true;
let individualAssignments = [];
let individualReviews = [];
await context.route("**/*", async (route) => {
  const url = new URL(route.request().url());
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    console.log("BLOCKED EXTERNAL", url.hostname, url.pathname);
    await route.abort();
    return;
  }
  if (url.port !== "54329") {
    await route.continue();
    return;
  }
  calls.push(url.pathname);
  let body = [];
  const table = url.pathname.split("/").pop();
  if (url.pathname.includes("/auth/v1/token"))
    body = {
      access_token: token,
      refresh_token: "synthetic",
      expires_in: 3600,
      token_type: "bearer",
      user,
    };
  else if (url.pathname.startsWith("/auth/")) body = user;
  else if (table === "profiles")
    body =
      url.searchParams.get("select") === "account_setup_completed"
        ? [{ account_setup_completed: true }]
        : profiles;
  else if (table === "grant_reviewer_groups") body = groups;
  else if (table === "grant_reviewer_group_members") body = groupMembers;
  else if (table === "save_grant_reviewer_group") {
    const args = route.request().postDataJSON();
    const id =
      args.p_group ?? "cc000000-0000-4000-2000-" + String(groups.length + 1).padStart(12, "0");
    const old = groups.find((g) => g.id === id);
    groups = groups
      .filter((g) => g.id !== id)
      .concat({ id, program_id: program, name: args.p_name, revision: (old?.revision ?? 0) + 1 });
    groupMembers = groupMembers
      .filter((m) => m.group_id !== id)
      .concat(args.p_members.map((user_id) => ({ group_id: id, user_id })));
    body = id;
  } else if (table === "user_roles") body = [{ role: "admin" }];
  else if (table === "user_program_access")
    body = url.searchParams.has("user_id")
      ? [{ id: "access", program_id: program, access_role: "admin" }]
      : ids.map((id) => ({ user_id: id, access_role: "reviewer" }));
  else if (table === "programs")
    body = [
      {
        id: program,
        slug: "business_growth_grant",
        name: "Business Growth Grant",
        description: null,
        active: true,
      },
    ];
  else if (table === "portal_applications")
    body = pool.map((p) => ({
      id: p.id,
      applicant_name: p.name,
      applicant_email: null,
      review_status: "not_started",
      program_id: program,
      completed_review_count: 0,
    }));
  else if (table === "business_grant_application_details")
    body = pool
      .filter(
        (p) =>
          !url.searchParams.has("application_id") ||
          url.searchParams.get("application_id") === "eq." + p.id,
      )
      .map((p) => ({
        application_id: p.id,
        business_name: "Synthetic Business",
        raw_response: {},
        eligibility_answers: {},
        descendant_eligibility: null,
        lara_status: null,
      }));
  else if (table === "application_eligibility_reviews")
    body = [{ id: "eligibility", application_id: pool[0].id, status: "eligible" }];
  else if (table === "rubric_versions")
    body = [{ id: "cc000000-0000-4000-6000-000000000001", program_id: program, active: true }];
  else if (table === "rubric_criteria")
    body = [
      {
        id: "cc000000-0000-4000-6000-000000000002",
        program_id: program,
        rubric_version_id: "cc000000-0000-4000-6000-000000000001",
        name: "Synthetic criterion",
        maximum_points: 100,
        display_order: 1,
        active: true,
      },
    ];
  else if (table === "reviewer_assignments" && url.searchParams.has("application_id"))
    body = [
      {
        id: "cc000000-0000-4000-5000-000000000001",
        application_id: pool[0].id,
        program_id: program,
        reviewer_id: actor,
        lifecycle: "active",
      },
    ];
  else if (table === "report_grant_conflict") {
    held = true;
    body = "cc000000-0000-4000-3000-000000000001";
  } else if (table === "preview_grant_group_allocation") {
    const args = route.request().postDataJSON();
    args.p_roster = args.p_groups.flatMap((id) =>
      groupMembers
        .filter((m) => m.group_id === id)
        .map((m) => m.user_id)
        .sort(),
    );
    const prior = previews[0];
    prior.superseded_at = new Date().toISOString();
    const next = {
      ...prior,
      id: "cc000000-0000-4000-7000-" + String(previews.length + 1).padStart(12, "0"),
      roster: args.p_roster,
      group_snapshot: args.p_groups.map((id) => ({
        ...groups.find((g) => g.id === id),
        members: groupMembers
          .filter((m) => m.group_id === id)
          .map((m) => m.user_id)
          .sort(),
      })),
      capacity_mode: args.p_mode,
      capacity: args.p_capacity ?? null,
      superseded_at: null,
      applied_at: null,
      created_at: new Date().toISOString(),
      allocation: pool.map((p, i) => ({
        applicationId: p.id,
        pair: args.p_mode === "fixed" && i >= args.p_capacity * 3 ? null : (i % 3) + 1,
        reviewers:
          args.p_mode === "fixed" && i >= args.p_capacity * 3
            ? []
            : args.p_roster.slice((i % 3) * 2, (i % 3) * 2 + 2),
      })),
    };
    previews.unshift(next);
    body = next.id;
  } else if (table === "apply_grant_pair_allocation") {
    if (staleApply) {
      staleApply = false;
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify({ message: "Stale preview: fixture eligibility changed" }),
      });
      return;
    }
    const record = previews.find((p) => p.id === route.request().postDataJSON().p_preview);
    record.applied_at = new Date().toISOString();
    record.applied_by = actor;
    individualAssignments = record.allocation.flatMap((e, i) =>
      e.reviewers.map((reviewer_id, j) => ({
        id: "cc000000-0000-4000-5000-" + String(i * 2 + j + 1).padStart(12, "0"),
        application_id: e.applicationId,
        program_id: program,
        reviewer_id,
        lifecycle: "active",
        assigned_at: new Date().toISOString(),
      })),
    );
    individualReviews = [
      { id: "synthetic-review", assignment_id: individualAssignments[0].id, status: "completed" },
    ];
    body = { id: record.id, replayed: false };
  } else if (table === "reviewer_assignments") body = individualAssignments;
  else if (table === "program_reviews") body = individualReviews;
  else if (table === "grant_allocation_previews") body = previews;
  else if (table === "grant_conflict_reports" && url.searchParams.has("reviewer_id"))
    body = held ? [{ id: "cc000000-0000-4000-3000-000000000001" }] : [];
  else if (table === "grant_conflict_reports")
    body = [
      {
        id: "conflict",
        reviewer_id: ids[0],
        application_id: pool[0].id,
        reason: "Synthetic unresolved relationship disclosure",
        reported_at: new Date().toISOString(),
        resolved_at: null,
      },
    ];
  if (Array.isArray(body) && route.request().headers()["accept"]?.includes("vnd.pgrst.object"))
    body = body[0] ?? null;
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "*",
    },
    body: JSON.stringify(body),
  });
});
const page = await context.newPage();
page.on("console", (m) => {
  if (m.type() === "error") console.log("BROWSER ERROR", m.text());
});
page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
await page.goto("http://127.0.0.1:4173/assignments");
await page.waitForLoadState("networkidle");
await page.getByLabel("Email", { exact: true }).fill("synthetic-admin@example.invalid");
await page.getByLabel("Password", { exact: true }).fill("SyntheticFixture123");
await page.getByRole("button", { name: "Sign In", exact: true }).click();
await page.waitForTimeout(1500);
await page.getByRole("link", { name: "Reviewer Assignments", exact: false }).first().click();
await page
  .getByRole("heading", { name: "Grant paired allocation", exact: true })
  .waitFor({ timeout: 20000 });
fs.mkdirSync("supabase/.temp/committee-browser", { recursive: true });
for (const width of [320, 375, 390, 768, 1024, 1440]) {
  await page.setViewportSize({ width, height: 900 });
  await page.screenshot({
    path: "supabase/.temp/committee-browser/assignments-" + width + ".png",
    fullPage: true,
  });
  await page.screenshot({
    path: "supabase/.temp/committee-browser/assignments-viewport-" + width + ".png",
  });
  const overflow = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  if (overflow.scroll > width) throw Error("Overflow " + JSON.stringify(overflow));
  console.log("PASS assignments reflow", width, JSON.stringify(overflow));
}
const allocationAxe = await new AxeBuilder({ page })
  .include("#grant-committee-allocation")
  .analyze();
if (allocationAxe.violations.length)
  throw Error(
    "Allocation axe: " +
      JSON.stringify(
        allocationAxe.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      ),
  );
console.log("PASS allocation scoped axe scan");
const reshuffle = page.getByRole("button", {
  name: "Explicitly reshuffle / replace preview",
  exact: true,
});
if (!(await reshuffle.isDisabled())) throw Error("Unconfirmed roster enabled preview");
for (let pair = 0; pair < 3; pair++) {
  await page
    .getByRole("textbox", { name: "Group name", exact: true })
    .fill("Synthetic pair " + (pair + 1));
  const manager = page.locator("#grant-reviewer-groups");
  await manager
    .getByRole("checkbox")
    .nth(pair * 2)
    .check();
  await manager
    .getByRole("checkbox")
    .nth(pair * 2 + 1)
    .check();
  await manager.getByRole("button", { name: "Save group", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector('#grant-reviewer-groups input[maxlength="80"]').value === "",
  );
}
for (let pair = 0; pair < 3; pair++) {
  await page
    .getByRole("combobox", { name: "Pair " + (pair + 1) + " saved group", exact: true })
    .selectOption(groups[pair].id);
}
console.log("PASS create groups from existing accounts and select saved pairs");
for (const width of [320, 375, 390, 768, 1024, 1440]) {
  await page.setViewportSize({ width, height: 900 });
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.querySelector("main").scrollTop = 0;
  });
  const overflow = await page.evaluate(() => ({
    body: document.documentElement.scrollWidth,
    main: document.querySelector("main").scrollWidth,
    mainWidth: document.querySelector("main").clientWidth,
  }));
  if (overflow.body > width || overflow.main > overflow.mainWidth)
    throw Error("Populated group overflow " + JSON.stringify(overflow));
  await page.screenshot({
    path: "supabase/.temp/committee-browser/groups-panel-" + width + ".png",
  });
  await page.screenshot({
    path: "supabase/.temp/committee-browser/groups-" + width + ".png",
    fullPage: true,
  });
  await page.locator("#grant-reviewer-groups form").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "supabase/.temp/committee-browser/groups-form-" + width + ".png" });
}
const groupsAxe = await new AxeBuilder({ page }).include("#grant-reviewer-groups").analyze();
if (groupsAxe.violations.length) throw Error("Groups axe " + JSON.stringify(groupsAxe.violations));
console.log("PASS populated groups reflow at all six widths and scoped axe");
await page.getByRole("checkbox", { name: /I confirmed all six/ }).check();
if (!(await reshuffle.isDisabled())) throw Error("Implicit capacity enabled preview");
await page.getByRole("combobox", { name: "Capacity choice", exact: true }).selectOption("fixed");
await reshuffle.focus();
await page.keyboard.press("Enter");
await page.getByText("UNALLOCATED: fixed capacity", { exact: false }).waitFor();
await page.getByRole("button", { name: "Edit group Synthetic pair 1", exact: true }).click();
await page
  .getByRole("textbox", { name: "Group name", exact: true })
  .fill("Synthetic pair 1 updated");
await page.getByRole("button", { name: "Save group", exact: true }).click();
await page.getByRole("alert").filter({ hasText: "Stale preview: a saved group changed" }).waitFor();
if (
  !(await page
    .getByRole("button", { name: "Apply frozen paired allocation", exact: true })
    .isDisabled())
)
  throw Error("Changed group preview can Apply");
if (await page.getByRole("checkbox", { name: /I confirmed all six/ }).isChecked())
  throw Error("Group edit retained obsolete identity confirmation");
await page.getByRole("checkbox", { name: /I confirmed all six/ }).check();
await reshuffle.click();
await page.getByRole("status").filter({ hasText: "Frozen preview created" }).waitFor();
console.log("PASS edited group invalidates preview and identity confirmation");
await page.getByRole("checkbox", { name: /I reviewed this frozen roster/ }).check();
await page.getByRole("button", { name: "Apply frozen paired allocation", exact: true }).click();
await page.getByRole("alert").filter({ hasText: "Stale preview:" }).waitFor();
if (individualAssignments.length) throw Error("Stale mock apply mutated assignments");
await reshuffle.click();
await page.getByRole("status").filter({ hasText: "Frozen preview created" }).waitFor();
await page.getByRole("checkbox", { name: /I reviewed this frozen roster/ }).check();
await page.getByRole("button", { name: "Apply frozen paired allocation", exact: true }).click();
await page.getByText("1/2 independent active reviews completed.", { exact: false }).waitFor();
if (individualAssignments.length !== 78) throw Error("Fixed allocation coverage mismatch");
console.log(
  "PASS keyboard preview, explicit capacity, fixed leftovers, stale error, apply and 1/2 progress",
);
await page.setViewportSize({ width: 320, height: 900 });
if ((await page.evaluate(() => document.documentElement.scrollWidth)) > 320)
  throw Error("Applied assignment records overflow");
await page.screenshot({ path: "supabase/.temp/committee-browser/applied-320.png", fullPage: true });
console.log("PASS applied individual assignment records reflow 320");
await page.setViewportSize({ width: 1440, height: 900 });
const allocationRequestsBefore = calls.filter((c) =>
  c.includes("preview_grant_group_allocation"),
).length;
await page.getByRole("link", { name: "Applications", exact: true }).first().click();
await page.getByRole("link").filter({ hasText: "Synthetic application 1" }).first().click();
await page.getByRole("heading", { name: "Conflict disclosure" }).waitFor();
for (const width of [320, 375, 390, 768, 1024, 1440]) {
  await page.setViewportSize({ width, height: 900 });
  await page.screenshot({
    path: "supabase/.temp/committee-browser/workspace-" + width + ".png",
    fullPage: true,
  });
  await page.screenshot({
    path: "supabase/.temp/committee-browser/workspace-viewport-" + width + ".png",
  });
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth);
  if (scroll > width) throw Error("Workspace overflow " + width + " " + scroll);
  console.log("PASS workspace reflow", width);
}
await page
  .getByLabel("Conflict reason (10-4000 characters)")
  .fill("Synthetic conflict reason for browser test");
await page.getByRole("button", { name: "Report a conflict", exact: true }).click();
await page
  .getByText("Your competitive review is on hold. An unresolved conflict report is recorded.")
  .waitFor();
console.log("PASS synthetic conflict report/hold state");
const conflictAxe = await new AxeBuilder({ page }).include("#grant-conflict-disclosure").analyze();
if (conflictAxe.violations.length)
  throw Error("Conflict axe: " + JSON.stringify(conflictAxe.violations.map((v) => v.id)));
console.log("PASS conflict scoped axe scan");
await page.getByRole("link", { name: "Reviewer Assignments", exact: true }).first().click();
await page.getByRole("heading", { name: "Grant paired allocation", exact: true }).waitFor();
if (
  calls.filter((c) => c.includes("preview_grant_group_allocation")).length !==
  allocationRequestsBefore
)
  throw Error("Reopening reshuffled");
console.log("PASS reopening does not call randomization");
await browser.close();
