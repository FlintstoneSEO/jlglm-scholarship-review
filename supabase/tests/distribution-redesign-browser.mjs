// Isolated browser contract tests. All records and writes are synthetic and in memory.
import assert from "node:assert/strict";
import { chromium } from "../.temp/committee-test/node_modules/playwright/index.mjs";
import fs from "node:fs";
import AxeBuilder from "../.temp/committee-test/node_modules/@axe-core/playwright/dist/index.mjs";
const browser = await chromium.launch({ headless: true });
const origin = process.env.DISTRIBUTION_PREVIEW_ORIGIN || "http://127.0.0.1:4176";
assert.equal(new URL(origin).hostname, "127.0.0.1");
const out = "supabase/.temp/distribution-redesign";
fs.mkdirSync(out, { recursive: true });
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
const pool = Array.from({ length: 7 }, (_, i) => ({
  id: "cc000000-0000-4000-9000-" + String(i + 1).padStart(12, "0"),
  name: "Synthetic application " + (i + 1),
  eligibility: "eligible",
  exclusion: null,
}));
pool[5].eligibility = "pending";
pool[5].exclusion = "Eligibility screening incomplete";
pool[6].exclusion = "Existing assignment history";
let resolutions = [];
let previews = [];
let groups = [];
let groupMembers = [];
const calls = [];
let staleApply = true;
let individualAssignments = [
  {
    id: "existing-assignment",
    application_id: pool[6].id,
    program_id: program,
    reviewer_id: ids[0],
    lifecycle: "active",
  },
];
let individualReviews = [
  { id: "existing-review", assignment_id: "existing-assignment", status: "completed" },
];
const initialAssignments = structuredClone(individualAssignments);
const initialReviews = structuredClone(individualReviews);
const errors = [];
const mutationCalls = [];
const permittedWrites = new Set([
  "save_grant_reviewer_group",
  "preview_grant_group_allocation",
  "apply_grant_pair_allocation",
  "resolve_grant_conflict",
]);
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
  const operation = url.pathname.split("/").pop();
  if (
    !["GET", "HEAD", "OPTIONS"].includes(route.request().method()) &&
    !url.pathname.startsWith("/auth/") &&
    !["grant_distribution_pool_summary", "grant_conflict_replacement_candidates"].includes(
      operation,
    )
  ) {
    assert.ok(permittedWrites.has(operation), "Unexpected write: " + operation);
    mutationCalls.push({ operation, input: route.request().postDataJSON() });
  }
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
  else if (table === "grant_distribution_pool_summary")
    body = [
      { total_applications: 7, eligible_applications: individualAssignments.length > 1 ? 0 : 5 },
    ];
  else if (table === "grant_conflict_replacement_candidates")
    body = profiles.slice(2).map((p) => ({ ...p, active_applications: 0 }));
  else if (table === "grant_conflict_resolutions") body = resolutions;
  else if (table === "resolve_grant_conflict") {
    const args = route.request().postDataJSON();
    const replacementId = "cc000000-0000-4000-5000-999999999999";
    resolutions.push({
      report_id: args.p_report,
      decision: args.p_decision,
      reason: args.p_reason,
      resolved_by: actor,
      resolved_at: new Date().toISOString(),
      replacement_assignment_id: replacementId,
    });
    const original = individualAssignments.find(
      (a) => a.application_id === pool[0].id && a.reviewer_id === ids[0],
    );
    if (original) original.lifecycle = "suspended";
    individualAssignments.push({
      id: replacementId,
      application_id: pool[0].id,
      reviewer_id: args.p_replacement,
      program_id: program,
      lifecycle: "active",
    });
    body = replacementId;
  } else if (table === "profiles")
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
      is_test: false,
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
        business_name: p.name,
        raw_response: {},
        eligibility_answers: {},
        descendant_eligibility: null,
        lara_status: null,
      }));
  else if (table === "preview_grant_group_allocation") {
    const args = route.request().postDataJSON();
    args.p_roster = args.p_groups.flatMap((id) =>
      groupMembers
        .filter((m) => m.group_id === id)
        .map((m) => m.user_id)
        .sort(),
    );
    const prior = previews[0] ?? { program_id: program, actor_id: actor, snapshot: pool };
    if (previews[0] && !previews[0].applied_at)
      previews[0].superseded_at = new Date().toISOString();
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
      allocation: pool
        .filter((p) => !p.exclusion)
        .map((p, i) => ({
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
    individualAssignments = [
      ...individualAssignments,
      ...record.allocation.flatMap((e, i) =>
        e.reviewers.map((reviewer_id, j) => ({
          id: "cc000000-0000-4000-5000-" + String(i * 2 + j + 1).padStart(12, "0"),
          application_id: e.applicationId,
          program_id: program,
          reviewer_id,
          lifecycle: "active",
          assigned_at: new Date().toISOString(),
        })),
      ),
    ];
    individualReviews = [
      ...individualReviews,
      { id: "synthetic-review", assignment_id: individualAssignments[0].id, status: "completed" },
    ];
    body = { id: record.id, replayed: false };
  } else if (table === "reviewer_assignments") body = individualAssignments;
  else if (table === "program_reviews") body = individualReviews;
  else if (table === "grant_allocation_previews") body = previews;
  else if (table === "grant_conflict_reports")
    body =
      individualAssignments.length > 1
        ? [
            {
              id: "conflict",
              reviewer_id: ids[0],
              application_id: pool[0].id,
              reason: "Synthetic unresolved relationship disclosure",
              reported_at: new Date().toISOString(),
              assignment_id: individualAssignments.find(
                (a) => a.application_id === pool[0].id && a.reviewer_id === ids[0],
              )?.id,
              resolved_at: resolutions.length ? resolutions[0].resolved_at : null,
            },
          ]
        : [];
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
page.setDefaultTimeout(12000);
page.on("pageerror", (e) => errors.push(e.message));
const button = (name) => page.getByRole("button", { name, exact: true });
const tab = (name) => page.getByRole("tab", { name, exact: true });
const expectVisible = async (locator) => locator.waitFor({ state: "visible" });
async function widths(label, selector = "main") {
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => {
      document.querySelector("main").scrollTop = 0;
      window.scrollTo(0, 0);
    });
    const sizes = await page.evaluate(() => ({
      body: document.documentElement.scrollWidth,
      width: innerWidth,
      main: document.querySelector("main").scrollWidth,
      available: document.querySelector("main").clientWidth,
    }));
    assert.ok(
      sizes.body <= sizes.width && sizes.main <= sizes.available,
      label + " overflow " + JSON.stringify(sizes),
    );
    await page.screenshot({ path: `${out}/${label}-${width}.png` });
    if (width === 320 || width === 1440) {
      const result = await new AxeBuilder({ page })
        .include(selector)
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      fs.writeFileSync(
        `${out}/${label}-axe-${width}.json`,
        JSON.stringify(result.violations, null, 2),
      );
      assert.equal(
        result.violations.length,
        0,
        label +
          " axe " +
          JSON.stringify(
            result.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
          ),
      );
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  if (label === "conflict-replacement") {
    await page.getByRole("group", { name: "Resolve report", exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/conflict-replacement-controls-390.png` });
  }
  console.log("PASS six-width reflow, screenshots and 320/1440 scoped axe:", label);
}
async function chooseGroups() {
  await tab("Random Allocation").click();
  await button("1. Choose groups").click();
  for (let i = 0; i < 3; i++)
    await page
      .getByRole("combobox", { name: `Pair ${i + 1} saved group`, exact: true })
      .selectOption(groups[i].id);
  await page.getByRole("checkbox", { name: /I confirmed the six/ }).check();
}
async function preview() {
  const count = previews.length;
  await page
    .getByRole("button", { name: /^(Preview Random Allocation|Create a new allocation preview)$/ })
    .click();
  await expectVisible(
    page.getByRole("heading", { name: "Preview - not yet assigned", exact: true }),
  );
  assert.equal(previews.length, count + 1);
}
try {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + "/assignments?scope=real&tab=groups", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("SyntheticFixture123");
  await button("Sign In").click();
  await expectVisible(page.getByRole("heading", { name: "Review Distribution", exact: true }));
  for (let i = 0; i < 3; i++) {
    await button("Add group").click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Group name", { exact: true }).fill(`Fixture pair ${i + 1}`);
    await dialog
      .getByRole("checkbox")
      .nth(i * 2)
      .check();
    await dialog
      .getByRole("checkbox")
      .nth(i * 2 + 1)
      .check();
    if (i === 0) await widths("group-editor", "[role=dialog]");
    await dialog.getByRole("button", { name: "Save group", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    assert.equal(groups.length, i + 1);
  }
  await widths("groups");
  await button("Edit group Fixture pair 1").click();
  await page
    .getByRole("dialog")
    .getByLabel("Group name", { exact: true })
    .fill("Fixture pair 1 renamed");
  await button("Save group").click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(groups[2].name, "Fixture pair 1 renamed");
  groups.sort((a, b) => a.id.localeCompare(b.id));
  assert.equal(groups[0].revision, 2);
  assert.deepEqual(individualAssignments, initialAssignments);
  console.log("PASS group create/edit with revisions and no assignment changes");
  await chooseGroups();
  assert.notEqual(
    await page
      .getByRole("combobox", { name: "Pair 2 saved group", exact: true })
      .locator(`option[value="${groups[0].id}"]`)
      .getAttribute("disabled"),
    null,
  );
  await widths("allocation-choose");
  await preview();
  assert.equal(previews[0].allocation.length, 5);
  assert.deepEqual(
    [1, 2, 3].map((pair) => previews[0].allocation.filter((e) => e.pair === pair).length),
    [2, 2, 1],
  );
  assert.equal(
    previews[0].allocation.some((e) => [pool[5].id, pool[6].id].includes(e.applicationId)),
    false,
  );
  assert.deepEqual(individualAssignments, initialAssignments);
  await widths("allocation-review");
  await button("Continue to confirmation").click();
  assert.equal(await button("Confirm & assign applications").isDisabled(), true);
  await widths("allocation-confirm");
  // Editing a group invalidates the proposed roster, without applying anything.
  await tab("Reviewer Groups").click();
  await button("Edit group Fixture pair 1 renamed").click();
  await page
    .getByRole("dialog")
    .getByLabel("Group name", { exact: true })
    .fill("Fixture pair 1 final");
  await button("Save group").click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  groups.sort((a, b) => a.id.localeCompare(b.id));
  await tab("Random Allocation").click();
  await expectVisible(
    page.getByRole("alert").filter({ hasText: "Stale preview: a saved group changed" }),
  );
  assert.equal(await button("Confirm & assign applications").isDisabled(), true);
  await chooseGroups();
  await preview();
  await button("Continue to confirmation").click();
  await page.getByRole("checkbox", { name: /I reviewed this reviewer roster/ }).check();
  await button("Confirm & assign applications").click();
  await expectVisible(
    page.getByRole("alert").filter({ hasText: "Stale preview: fixture eligibility changed" }),
  );
  assert.deepEqual(individualAssignments, initialAssignments);
  await chooseGroups();
  // Fixed capacity leaves two eligible applications visibly unassigned.
  await page.getByText("Advanced: fixed capacity", { exact: true }).click();
  await page
    .getByRole("radio", { name: "Limit the number of applications per group", exact: true })
    .check();
  await page.getByLabel("Applications per group", { exact: true }).fill("1");
  await preview();
  assert.equal(previews[0].allocation.filter((e) => e.pair === null).length, 2);
  await chooseGroups();
  await page.getByRole("radio", { name: /Balanced Distribution/ }).check();
  await preview();
  await button("Continue to confirmation").click();
  await page.getByRole("checkbox", { name: /I reviewed this reviewer roster/ }).check();
  await button("Confirm & assign applications").click();
  await expectVisible(page.getByRole("heading", { name: "Overall review progress", exact: true }));
  assert.equal(individualAssignments.length, 11);
  assert.deepEqual(individualAssignments[0], initialAssignments[0]);
  assert.deepEqual(individualReviews[0], initialReviews[0]);
  assert.equal(
    individualAssignments.some((a) => a.application_id === pool[5].id),
    false,
  );
  console.log(
    "PASS odd balanced count, fixed leftovers, exclusions, explicit confirmation, stale rejection and assignment/review preservation",
  );
  await widths("progress");
  await button("Needs attention").click();
  await button("Resolve conflict").click();
  await expectVisible(page.getByRole("group", { name: "Resolve report", exact: true }));
  await widths("conflicts");
  await page.getByLabel("Decision", { exact: true }).selectOption("replaced");
  await page
    .getByLabel(/^Resolution reason/)
    .fill("Fixture conflict reassignment approved after review.");
  assert.equal(await button("Record resolution").isDisabled(), true);
  await page.getByLabel("Replacement reviewer", { exact: true }).selectOption(ids[2]);
  await widths("conflict-replacement");
  await tab("Review Progress").click();
  await tab("Conflicts (1)").click();
  assert.equal(
    await page.getByLabel(/^Resolution reason/).inputValue(),
    "Fixture conflict reassignment approved after review.",
  );
  const original = structuredClone(
    individualAssignments.find((a) => a.application_id === pool[0].id && a.reviewer_id === ids[0]),
  );
  const partner = structuredClone(
    individualAssignments.find((a) => a.application_id === pool[0].id && a.reviewer_id === ids[1]),
  );
  const reviewSnapshot = structuredClone(individualReviews);
  await button("Record resolution").click();
  await expectVisible(page.getByText("No unresolved reports.", { exact: true }));
  assert.equal(individualAssignments.find((a) => a.id === original.id).lifecycle, "suspended");
  assert.deepEqual(
    individualAssignments.find((a) => a.id === partner.id),
    partner,
  );
  assert.deepEqual(individualReviews, reviewSnapshot);
  assert.equal(
    individualAssignments.filter((a) => a.application_id === pool[0].id && a.lifecycle === "active")
      .length,
    2,
  );
  assert.equal(mutationCalls.filter((c) => c.operation === "resolve_grant_conflict").length, 1);
  await page.getByText("Resolved conflict history", { exact: true }).click();
  await expectVisible(page.getByText(/Original review retained as excluded history/));
  await tab("Review Progress").click();
  await button("All").click();
  await page
    .getByRole("searchbox", { name: "Search applications or reviewers", exact: true })
    .fill("Synthetic application 1");
  await button("View review details for Synthetic application 1").click();
  await expectVisible(page.getByText(/Replacement for Synthetic Committee Reviewer 1/));
  await button("Close review details").click();
  assert.equal(
    await button("View review details for Synthetic application 1").evaluate(
      (el) => el === document.activeElement,
    ),
    true,
  );
  const previewCalls = mutationCalls.filter(
    (c) => c.operation === "preview_grant_group_allocation",
  ).length;
  await tab("Random Allocation").click();
  await button("2. Review assignments").click();
  await expectVisible(page.getByRole("heading", { name: "Finalized allocation", exact: true }));
  assert.equal(await button("3. Confirm").isDisabled(), true);
  assert.equal(
    mutationCalls.filter((c) => c.operation === "preview_grant_group_allocation").length,
    previewCalls,
  );
  // A second applied batch contributes to the same groups without repeating them.
  const applied = previews.find((p) => p.applied_at);
  const extra = pool[5];
  previews.unshift({
    ...applied,
    id: "extra-applied",
    created_at: "2026-10-25T12:00:00Z",
    applied_at: "2026-10-25T12:00:00Z",
    snapshot: [extra],
    allocation: [{ applicationId: extra.id, pair: 1, reviewers: ids.slice(0, 2) }],
  });
  individualAssignments.push(
    ...ids.slice(0, 2).map((reviewer_id, i) => ({
      id: "extra-" + i,
      application_id: extra.id,
      program_id: program,
      reviewer_id,
      lifecycle: "active",
    })),
  );
  await page.goto(origin + "/assignments?scope=real&tab=progress", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await expectVisible(page.getByRole("heading", { name: "Overall review progress", exact: true }));
  assert.equal(await page.locator(".review-workload-table tbody tr").count(), 3);
  assert.equal(await page.locator(".review-overview-count strong").innerText(), "0 / 12");
  const initialTotal = await page.locator(".review-overview").innerText();
  const row = page
    .locator(".review-workload-table tbody tr")
    .filter({ hasText: "Fixture pair 1 final" });
  assert.equal(
    await row.locator("th small").innerText(),
    "Synthetic Committee Reviewer 1 / Synthetic Committee Reviewer 2",
  );
  await row.getByRole("button", { name: /^View applications/ }).click();
  assert.equal(await page.locator(".review-application-list > li").count(), 3);
  assert.equal(
    await page
      .locator("#application-progress-heading")
      .evaluate((el) => el === document.activeElement),
    true,
  );
  assert.equal(await page.locator(".review-overview").innerText(), initialTotal);
  await button("Clear filters").click();
  await page
    .getByRole("searchbox", { name: "Search applications or reviewers", exact: true })
    .fill("no matching fixture");
  await expectVisible(page.getByText(/No applications match these filters/));
  await button("Clear filters").click();
  await row.getByRole("button", { name: /^View reviewers/ }).click();
  await expectVisible(page.getByRole("dialog"));
  assert.equal(await page.getByRole("dialog").locator("li").count(), 2);
  assert.equal(
    await page
      .getByRole("dialog")
      .getByText("Synthetic Committee Reviewer 3", { exact: true })
      .count(),
    0,
  );
  await expectVisible(
    page.getByRole("dialog").getByText(/1 reassigned: 0 completed · 1 outstanding/),
  );
  await page.screenshot({ path: out + "/original-group-reviewers.png", animations: "disabled" });
  await button("Close reviewer details").click();
  assert.equal(
    await row
      .getByRole("button", { name: /^View reviewers/ })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await widths("combined-progress", ".review-monitor");
  await page.setViewportSize({ width: 1086, height: 812 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: out + "/combined-progress-1086.png", fullPage: true });
  console.log(
    "PASS combined batches, stable groups, overall totals, explicit details, focus return and filters",
  );
  for (const width of [320, 375, 390, 768, 1024, 1086, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator(".review-filter-toolbar").scrollIntoViewIfNeeded();
    await page.screenshot({ path: out + "/progress-filters-" + width + ".png" });
  }
  // No applied workload is a real empty state, not 100% completion.
  previews = [];
  await page.goto(origin + "/assignments?scope=real&tab=progress", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await expectVisible(page.getByText("No allocated reviews yet", { exact: false }));
  assert.equal(await page.locator(".review-workload-table").count(), 0);
  console.log("PASS empty allocated workload and filter surface screenshots");
  assert.equal(errors.length, 0, errors.join("\n"));
  fs.writeFileSync(
    `${out}/evidence.json`,
    JSON.stringify(
      {
        mutationCalls,
        assignments: individualAssignments,
        reviews: individualReviews,
        resolutions,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS reassignment preserves partner and reviews, updated progress, retained draft, resolved history, and finalized reopen without reshuffle",
  );
} catch (e) {
  await page.screenshot({ path: `${out}/failure.png`, fullPage: true });
  console.error(await page.locator("body").innerText());
  throw e;
} finally {
  await browser.close();
}
