// Synthetic browser evidence only. All non-loopback requests and unexpected writes are blocked.
// Start the app with VITE_SUPABASE_URL=http://127.0.0.1:54329 and a synthetic key.
import { chromium } from "../.temp/committee-test/node_modules/playwright/index.mjs";
import AxeBuilder from "../.temp/committee-test/node_modules/@axe-core/playwright/dist/index.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
const origin = process.env.USABILITY_PREVIEW_ORIGIN || "http://127.0.0.1:4174";
assert.equal(new URL(origin).hostname, "127.0.0.1");
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, args: ["--no-sandbox"] }
    : {}),
});
const context = await browser.newContext();
const actor = "ee000000-0000-4000-8000-000000000001";
const program = "22222222-2222-4222-8222-222222222222";
const scholarship = "11111111-1111-4111-8111-111111111111";
const ids = [1, 2, 3].map((i) => `ee000000-0000-4000-9000-00000000000${i}`);
const user = {
  id: actor,
  aud: "authenticated",
  role: "authenticated",
  email: "fixture@example.invalid",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: new Date().toISOString(),
};
const token =
  Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url") +
  "." +
  Buffer.from(JSON.stringify({ sub: actor, exp: Math.floor(Date.now() / 1000) + 3600 })).toString(
    "base64url",
  ) +
  ".synthetic";
const apps = ids.map((id, i) => ({
  id,
  program_id: program,
  applicant_name: `Fixture applicant ${i + 1}`,
  applicant_email: null,
  is_test: true,
  review_status: "not_started",
  completed_review_count: 0,
  average_score: 0,
  submitted_at: "2026-10-12T12:00:00Z",
}));
const assignments = ids.map((id, i) => ({
  id: `assignment-${i}`,
  application_id: id,
  reviewer_id: actor,
  program_id: program,
  lifecycle: "active",
}));
const transferMode = process.argv.includes("--transfers");
const duplicateMode = process.argv.includes("--duplicates");
const assignmentMode = process.argv.includes("--assignment-summary");
const conceptMode = process.argv.includes("--concept-b");
const adminMode =
  process.argv.includes("--admin-practice") || conceptMode || duplicateMode || transferMode;
const fixture = {
  admin: adminMode,
  candidates: [
    { id: "replacement-fixture", full_name: "Fixture replacement", active_applications: 0 },
  ],
  candidateError: false,
  resolutionError: false,
  resolutionCalls: [],
  practiceCalls: [],
  sessions: [
    {
      id: "practice-fixture",
      program_id: program,
      name: "Fixture practice",
      round: 1,
      ended_at: null,
    },
  ],
  eligibility: "eligible",
  exception: false,
  rubric: true,
  declared: true,
  documentError: false,
};
if (adminMode) {
  apps[0].practice_session_id = "practice-fixture";
  apps[0].practice_round = 1;
  // Distribution has a real-scoped synthetic conflict; all other records remain test fixtures.
  apps[2].is_test = false;
}
let reviews = [],
  scores = [],
  scholarshipReviews = [],
  failSave = false,
  delaySave = false;
await context.addInitScript(() =>
  localStorage.setItem("jlgl.selectedProgram", "business_growth_grant"),
);
await context.route("**/*", async (route) => {
  const url = new URL(route.request().url());
  if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
    console.log("BLOCKED HOST", url.hostname);
    return route.abort();
  }
  if (url.port !== "54329") return route.continue();
  const requestedTable = url.pathname.split("/").pop();
  const table = requestedTable.startsWith("active_") ? requestedTable.slice(7) : requestedTable;
  let body = [],
    status = 200;
  if (url.pathname.includes("/auth/v1/token"))
    body = {
      access_token: token,
      refresh_token: "synthetic",
      expires_in: 3600,
      token_type: "bearer",
      user,
    };
  else if (url.pathname.startsWith("/auth/")) body = user;
  else if (transferMode && table === "grant_transfer_groups") {
    if (fixture.transferDelay) await new Promise((r) => setTimeout(r, 700));
    status = fixture.transferGroupsError ? 400 : 200;
    body = fixture.transferGroupsError
      ? { message: "Synthetic groups unavailable" }
      : fixture.noTransferGroups
        ? []
        : [
            { id: "destination", name: "Destination evaluation group", unavailable_reason: null },
            {
              id: "invalid",
              name: "Earlier group",
              unavailable_reason: "A reviewer has an historical assignment. Choose a fresh group.",
            },
          ];
  } else if (transferMode && table === "grant_transfer_impact") {
    body = {
      application_id: ids[0],
      current_group: { id: "original", name: "Original evaluation group" },
      group: {
        id: "destination",
        name: "Destination evaluation group",
        revision: 1,
        members: [
          { id: "fresh-a", name: "Alexandra Synthetic Destination Reviewer" },
          { id: "fresh-b", name: "Christopher Synthetic Destination Reviewer" },
        ],
      },
      assignments: [
        {
          id: "old-a",
          reviewer_id: actor,
          reviewer_name: "Earlier synthetic reviewer",
          lifecycle: "active",
          review_status: "completed",
          transferred_at: null,
        },
        {
          id: "old-b",
          reviewer_id: "other",
          reviewer_name: "Synthetic conflict replacement",
          lifecycle: "active",
          review_status: "in_progress",
          transferred_at: null,
        },
      ],
      completed_review_count: 1,
      average_score: 80,
    };
  } else if (transferMode && table === "transfer_grant_application") {
    fixture.transferCalls ??= [];
    const input = route.request().postDataJSON();
    fixture.transferCalls.push(input);
    if (fixture.transferDelay) await new Promise((r) => setTimeout(r, 700));
    const unknown = fixture.transferUnknownOnce;
    fixture.transferUnknownOnce = false;
    status = fixture.transferError ? 400 : unknown ? 500 : 200;
    body = unknown
      ? { message: "Synthetic uncertain outcome" }
      : fixture.transferError
        ? {
            code: "P0001",
            message: "Transfer preview is stale. Refresh and review the impact again.",
          }
        : input.p_request;
    if (!fixture.transferError)
      fixture.summaryOverride = {
        application_id: ids[0],
        current_group: { id: "destination", name: "Destination evaluation group" },
        assignments: [
          {
            assignment_id: "fresh-a",
            reviewer_id: "fresh-a",
            reviewer_name: "Alexandra Synthetic Destination Reviewer",
            assigned_at: "2026-10-28T12:00:00Z",
            replaces: null,
            status: "not_started",
          },
          {
            assignment_id: "fresh-b",
            reviewer_id: "fresh-b",
            reviewer_name: "Christopher Synthetic Destination Reviewer",
            assigned_at: "2026-10-28T12:00:00Z",
            replaces: null,
            status: "not_started",
          },
        ],
        excluded_transfer_reviews: [
          {
            reviewer_name: "Earlier synthetic reviewer",
            review_status: "completed",
            transferred_at: "2026-10-28T12:00:00Z",
          },
        ],
        history: [
          {
            id: "transfer:event",
            kind: "transferred",
            occurred_at: "2026-10-28T12:00:00Z",
            reviewer_name: "Previous group",
            replacement_name: "Destination evaluation group",
            ...(fixture.admin
              ? { reason: input.p_reason, actor_name: "Synthetic administrator" }
              : {}),
          },
        ],
      };
  } else if (duplicateMode && table === "grant_duplicate_candidates") {
    if (fixture.duplicateDelay) await new Promise((r) => setTimeout(r, 700));
    status = fixture.duplicateCandidatesError ? 400 : 200;
    const query = route.request().postDataJSON().p_search.toLowerCase();
    body = fixture.duplicateCandidatesError
      ? { message: "Synthetic search failure" }
      : apps
          .slice(1)
          .filter((a) => !a.duplicate_of)
          .map((a, i) => ({
            id: a.id,
            applicant_name: a.applicant_name,
            business_name: "Fixture business " + (i + 2),
          }))
          .filter((a) =>
            [a.applicant_name, a.business_name].some((n) => n.toLowerCase().includes(query)),
          );
  } else if (duplicateMode && table === "grant_duplicate_impact") {
    body = {
      application_id: ids[0],
      assignments: [
        {
          id: "assignment-0",
          reviewer_name: "Fictional reviewer",
          lifecycle: "active",
          review_status: "completed",
          review_version: 1,
        },
      ],
    };
  } else if (duplicateMode && table === "mark_grant_application_duplicate") {
    if (fixture.duplicateDelay) await new Promise((r) => setTimeout(r, 700));
    const input = route.request().postDataJSON();
    fixture.duplicateCalls ??= [];
    fixture.duplicateCalls.push(input);
    status = fixture.duplicateError ? 400 : 200;
    body = fixture.duplicateError
      ? { message: "Assignments or reviews changed. Refresh and review the confirmation again." }
      : "synthetic-duplicate-event";
    if (!fixture.duplicateError) apps[0].duplicate_of = input.p_retained;
  } else if (table === "grant_application_assignment_summary") {
    const applicationId = route.request().postDataJSON().p_application;
    status = fixture.summaryError ? 400 : 200;
    body = fixture.summaryError
      ? { message: "Synthetic summary unavailable" }
      : (fixture.summaryOverride ?? {
          application_id: applicationId,
          assignments: assignments
            .filter((a) => a.application_id === applicationId && a.lifecycle === "active")
            .map((a) => ({
              assignment_id: a.id,
              reviewer_id: a.reviewer_id,
              reviewer_name: "Fixture reviewer",
              assigned_at: "2026-10-27T12:00:00Z",
              replaces: null,
              status:
                reviews.find((r) => r.assignment_id === a.id)?.status === "completed"
                  ? "submitted"
                  : reviews.some((r) => r.assignment_id === a.id)
                    ? "draft"
                    : "not_started",
            })),
          history: [],
        });
  } else if (conceptMode && table === "admin_list_user_access") {
    body = [
      {
        user_id: actor,
        email: user.email,
        full_name: "Fixture administrator",
        account_setup_completed: true,
        global_role: "admin",
        program_id: program,
        program_name: "Business Growth Grant",
        access_role: "admin",
      },
    ];
  } else if (adminMode && table === "grant_conflict_replacement_candidates") {
    body = fixture.candidateError
      ? { message: "Synthetic candidates unavailable" }
      : fixture.candidates;
    status = fixture.candidateError ? 400 : 200;
  } else if (adminMode && table === "resolve_grant_conflict") {
    fixture.resolutionCalls.push(route.request().postDataJSON());
    body = fixture.resolutionError
      ? { message: "Synthetic resolution rejected" }
      : "replacement-assignment";
    status = fixture.resolutionError ? 400 : 200;
  } else if (adminMode && ["start_grant_practice", "reset_grant_practice"].includes(table)) {
    const input = route.request().postDataJSON();
    fixture.practiceCalls.push({ table, input });
    if (table === "start_grant_practice") {
      fixture.sessions = [
        {
          ...fixture.sessions[0],
          program_id: program,
          id: "new-practice",
          name: input.p_name,
          round: 1,
          ended_at: null,
        },
      ];
      body = "new-practice";
    } else {
      fixture.sessions = input.p_end
        ? []
        : fixture.sessions.map((s) => ({ ...s, round: s.round + 1 }));
      body = null;
    }
  } else if (adminMode && table === "grant_distribution_pool_summary") {
    body = [];
  } else if (table === "submit_business_grant_review") {
    if (delaySave) await new Promise((resolve) => setTimeout(resolve, 700));
    const input = route.request().postDataJSON();
    if (failSave) {
      status = 400;
      body = { message: "Synthetic write rejected" };
    } else {
      const review = {
        id: "fixture-review",
        application_id: ids[0],
        assignment_id: assignments[0].id,
        reviewer_id: actor,
        version: (reviews[0]?.version ?? 0) + 1,
        status: input.p_intent === "submit" ? "completed" : "in_progress",
        reviewer_comments: input.p_comments,
        rubric_version_id: "rubric-fixture",
      };
      reviews = [review];
      scores = input.p_criteria.map((c) => ({
        review_id: review.id,
        criterion_id: c.criterionId,
        points: c.value,
      }));
      body = {
        reviewId: review.id,
        savedAt: new Date().toISOString(),
        version: review.version,
        status: input.p_intent === "submit" ? "submitted" : "in_progress",
      };
    }
  } else if (table === "submit_scholarship_review") {
    const input = route.request().postDataJSON();
    if (failSave) {
      status = 400;
      body = { message: "Synthetic write rejected" };
    } else {
      scholarshipReviews = [
        {
          id: "scholarship-review",
          applicant_id: ids[0],
          reviewer_id: actor,
          writing_score: input.p_writing_score,
          rhetoric_score: input.p_rhetoric_score,
          reviewer_notes: input.p_comments,
          version: 1,
          is_complete: input.p_intent === "submit",
        },
      ];
      body = {
        reviewId: "scholarship-review",
        version: 1,
        savedAt: new Date().toISOString(),
        status: input.p_intent === "submit" ? "submitted" : "in_progress",
      };
    }
  } else if (
    route.request().method() !== "GET" &&
    route.request().method() !== "HEAD" &&
    route.request().method() !== "OPTIONS"
  )
    return route.abort();
  else if (table === "profiles")
    body = [
      {
        id: actor,
        account_setup_completed: true,
        full_name: "Fixture reviewer",
        email: user.email,
      },
      ...(adminMode
        ? [
            {
              id: "replacement-fixture",
              full_name: "Fixture replacement",
              email: "replacement@example.invalid",
            },
          ]
        : []),
    ];
  else if (table === "user_roles") body = [{ role: fixture.admin ? "admin" : "reviewer" }];
  else if (table === "user_program_access")
    body = [
      {
        id: "access",
        user_id: actor,
        program_id: program,
        access_role: fixture.admin ? "admin" : "reviewer",
      },
      ...(adminMode
        ? [
            {
              id: "replacement-access",
              user_id: "replacement-fixture",
              program_id: program,
              access_role: "reviewer",
            },
          ]
        : []),
      {
        id: "scholarship-access",
        user_id: actor,
        program_id: scholarship,
        access_role: "reviewer",
      },
    ];
  else if (table === "programs")
    body = [
      { id: program, slug: "business_growth_grant", name: "Business Growth Grant", active: true },
      { id: scholarship, slug: "scholarship", name: "Educational Scholarship", active: true },
    ];
  else if (table === "applicants")
    body = [
      {
        id: ids[0],
        application_id: ids[0],
        first_name: "Fixture",
        last_name: "Student",
        email: null,
        preliminary_screening_status: "eligible_for_review",
        review_status: "not_started",
        application_status: "complete",
        has_essay: true,
        has_transcript: true,
        is_test: true,
      },
    ];
  else if (table === "reviews") body = scholarshipReviews;
  else if (table === "portal_applications") body = apps;
  else if (conceptMode && table === "production_applications")
    body = apps.filter((app) => !app.is_test);
  else if (table === "business_grant_application_details")
    body = ids.map((id, i) => ({
      application_id: id,
      business_name: `Fixture business ${i + 1}`,
      ...(conceptMode
        ? {
            business_description:
              "Fictional application for design validation. This local repair business serves households and small businesses. The owner describes the services, customers and operating history here.",
            growth_opportunity:
              "Fictional response: expand workshop capacity to serve more customers and reduce turnaround time.",
            proposed_use_of_funds:
              "Fictional response: purchase diagnostic equipment and expand the work area.",
            measurable_impact: "Fictional response: track completed repairs and turnaround time.",
          }
        : {}),
      raw_response: {},
    }));
  else if (table === "reviewer_assignments") body = assignments;
  else if (table === "program_reviews")
    body = fixture.hideReviews ? [] : (fixture.reviewOverride ?? reviews);
  else if (table === "review_scores") body = scores;
  else if (table === "grant_practice_sessions") body = fixture.sessions;
  else if (adminMode && table === "application_documents") {
    status = fixture.documentError ? 400 : 200;
    body = fixture.documentError
      ? { message: "Synthetic document read rejected" }
      : [
          {
            id: "fixture-document",
            application_id: ids[0],
            label: "Fictional P&L",
            file_name: "Fictional P&L",
            external_url: `/practice-document?kind=profit_loss_2024&applicationId=${ids[0]}`,
            document_type: "profit_loss_2024",
          },
        ];
  } else if (table === "rubric_versions")
    body = fixture.rubric
      ? [
          {
            id: "rubric-fixture",
            version: 1,
            name: "Fixture rubric",
            active: true,
            retired_at: null,
          },
        ]
      : [];
  else if (table === "rubric_criteria")
    body = adminMode
      ? fixture.rubric
        ? [
            ["Business Narrative & Value Proposition", 15],
            ["Financial Performance & Business Health", 15],
            ["Growth Opportunity", 15],
            ["Use of Grant Funds", 20],
            ["Expected Business Impact & Measurable Outcomes", 15],
            ["Business Capacity & Financial Management", 10],
            ["Why This Grant, and Why Now?", 10],
          ].map(([name, maximum_points], i) => ({
            id: `criterion-${i}`,
            name,
            maximum_points,
            rubric_version_id: "rubric-fixture",
            active: true,
            display_order: i + 1,
          }))
        : []
      : [
          {
            id: "criterion-fixture",
            rubric_version_id: "rubric-fixture",
            name: "Business Narrative & Value Proposition",
            maximum_points: 100,
            active: true,
            display_order: 1,
          },
        ];
  else if (table === "application_eligibility_reviews")
    body = ids.map((id, i) => ({
      id: `eligibility-${i}`,
      application_id: id,
      status: fixture.eligibility,
    }));
  else if (table === "eligibility_scoring_overrides")
    body = fixture.exception ? [{ scoring_allowed: true, event_number: 1 }] : [];
  else if (table === "grant_conflict_declarations")
    body = fixture.declared ? assignments.map((a) => ({ assignment_id: a.id })) : [];
  else if (table === "grant_conflict_reports")
    body = [
      {
        id: "hold",
        program_id: program,
        assignment_id: "assignment-2",
        application_id: ids[2],
        reviewer_id: actor,
        resolved_at: null,
        reported_at: "2026-10-12T12:00:00Z",
        reason: "Synthetic conflict reason",
      },
    ];
  if (duplicateMode && Array.isArray(body)) {
    if (requestedTable === "active_portal_applications") body = body.filter((a) => !a.duplicate_of);
    if (
      requestedTable === "portal_applications" &&
      url.searchParams.get("duplicate_of") === "not.is.null"
    )
      body = body.filter((a) => !!a.duplicate_of);
    if (requestedTable === "active_reviewer_assignments")
      body = body.filter((a) => !apps.find((app) => app.id === a.application_id)?.duplicate_of);
    if (requestedTable === "active_program_reviews")
      body = body.filter((r) => !apps.find((app) => app.id === r.application_id)?.duplicate_of);
  }
  for (const field of ["id", "application_id"]) {
    const filter = url.searchParams.get(field);
    if (Array.isArray(body) && filter?.startsWith("eq."))
      body = body.filter((row) => row[field] === filter.slice(3));
  }
  if (table === "user_program_access" && url.searchParams.get("program_id")?.startsWith("eq."))
    body = body.filter((row) => row.program_id === url.searchParams.get("program_id").slice(3));
  if (table === "user_program_access" && url.searchParams.get("user_id")?.startsWith("eq."))
    body = body.filter((row) => row.user_id === url.searchParams.get("user_id").slice(3));
  if (Array.isArray(body) && url.searchParams.has("is_test"))
    body = body.filter((row) => row.is_test === (url.searchParams.get("is_test") === "eq.true"));
  if (Array.isArray(body) && route.request().headers().accept?.includes("vnd.pgrst.object"))
    body = body[0] ?? null;
  await route.fulfill({
    status,
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
page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.log("BROWSER ERROR", m.text());
});
page.setDefaultTimeout(12000);
const out = conceptMode ? "supabase/.temp/concept-b" : "supabase/.temp/reviewer-usability";
fs.mkdirSync(out, { recursive: true });
try {
  await page.goto(`${origin}/grants/${ids[0]}?scope=test`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("SyntheticFixture123");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  if (transferMode) {
    const { validateTransfers } = await import("./grant-group-transfer-browser.mjs");
    await validateTransfers({ page, fixture, apps, ids, origin, out, AxeBuilder });
  } else if (duplicateMode) {
    const { validateDuplicates } = await import("./application-duplicates-browser.mjs");
    await validateDuplicates({ page, fixture, apps, ids, origin, out, AxeBuilder });
  } else if (assignmentMode) {
    const { validateAssignmentSummary } = await import("./grant-assignment-summary-browser.mjs");
    await validateAssignmentSummary({
      page,
      fixture,
      assignments,
      ids,
      actor,
      origin,
      out,
      AxeBuilder,
    });
  } else if (conceptMode) {
    const { validateConceptB } = await import("./concept-b-browser.mjs");
    await validateConceptB({ page, origin, ids, out, AxeBuilder });
  } else if (adminMode) {
    await page.getByRole("heading", { name: "Fixture business 1", exact: true }).waitFor();
    const { validateAdminPractice } = await import("./reviewer-admin-practice-browser.mjs");
    await validateAdminPractice({ page, fixture, apps, assignments, ids, origin, out, AxeBuilder });
  } else {
    await page.getByRole("tab", { name: /^Rubric/ }).click();
    await page
      .getByLabel("Business Narrative & Value Proposition score", { exact: true })
      .fill("70");
    await page.getByLabel("Reviewer comments", { exact: true }).fill("Private fixture comments");
    await page.getByRole("tab", { name: /^Overview/ }).click();
    await page.getByRole("tab", { name: /^Rubric/ }).click();
    assert.equal(
      await page.getByLabel("Reviewer comments", { exact: true }).inputValue(),
      "Private fixture comments",
    );
    page.once("dialog", (d) => d.dismiss());
    await page.getByRole("link", { name: "Return to my applications", exact: true }).click();
    assert.match(page.url(), new RegExp(ids[0]));
    page.once("dialog", (d) => d.dismiss());
    await page.getByRole("button", { name: "Sign out", exact: true }).first().click();
    assert.match(page.url(), new RegExp(ids[0]));
    page.once("dialog", (d) => d.dismiss());
    await page.reload().catch(() => {});
    assert.equal(
      await page.getByLabel("Reviewer comments", { exact: true }).inputValue(),
      "Private fixture comments",
    );
    console.log("PASS dirty route/signout/reload guards and retained tab input");
    failSave = true;
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page.getByText(/Save failed. Your changes remain here/).waitFor();
    assert.equal(
      await page.getByLabel("Reviewer comments", { exact: true }).inputValue(),
      "Private fixture comments",
    );
    failSave = false;
    delaySave = true;
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("link", { name: "Return to my applications", exact: true }).click();
    assert.match(page.url(), new RegExp(ids[0]));
    await page.getByText("Draft saved successfully.", { exact: true }).waitFor();
    console.log("PASS failed-save retention, pending departure and successful explicit draft save");
    for (const width of [320, 375, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(() => ({
        body: document.documentElement.scrollWidth,
        width: innerWidth,
        main: document.querySelector("main").scrollWidth,
        available: document.querySelector("main").clientWidth,
      }));
      assert.ok(
        overflow.body <= overflow.width && overflow.main <= overflow.available,
        JSON.stringify({ width, overflow }),
      );
      await page.screenshot({ path: `${out}/rubric-${width}.png`, fullPage: true });
    }
    const axe = await new AxeBuilder({ page })
      .include("main")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    fs.writeFileSync(`${out}/axe.json`, JSON.stringify(axe.violations, null, 2));
    assert.equal(axe.violations.length, 0, axe.violations.map((v) => v.id).join(", "));
    console.log("PASS grant rubric six-width reflow and scoped axe");
    await page.getByRole("checkbox", { name: /^I confirm that I completed/ }).check();
    await page.getByRole("button", { name: "Submit review", exact: true }).click();
    await page.getByRole("region", { name: "Submission confirmation" }).waitFor();
    await page.getByRole("link", { name: "Next application to review", exact: true }).waitFor();
    assert.match(
      await page
        .getByRole("link", { name: "Next application to review", exact: true })
        .getAttribute("href"),
      new RegExp(ids[1]),
    );
    await page.getByRole("link", { name: "Next application to review", exact: true }).click();
    await page.getByRole("heading", { name: "Fixture business 2", exact: true }).waitFor();
    assert.equal(
      await page.getByText("Review submitted successfully.", { exact: true }).count(),
      0,
    );
    await page
      .getByRole("link", { name: "Return to my applications", exact: true })
      .first()
      .click();
    await page.getByText("On hold — conflict reported", { exact: true }).waitFor();
    await page
      .getByText("Application review coverage unavailable", { exact: true })
      .first()
      .waitFor();
    await page.screenshot({ path: `${out}/applications.png`, fullPage: true });
    console.log("PASS submission confirmation, safe next-work and personal queue holds");
    async function screenWidths(label) {
      for (const width of [320, 375, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        assert.ok(
          await page.evaluate(
            () =>
              document.documentElement.scrollWidth <= innerWidth &&
              document.querySelector("main").scrollWidth <=
                document.querySelector("main").clientWidth,
          ),
          label + " overflow " + width,
        );
        await page.screenshot({ path: `${out}/${label}-${width}.png`, fullPage: true });
      }
    }
    await screenWidths("applications");
    await page.getByRole("link", { name: "Dashboard", exact: true }).first().click();
    await page.getByRole("heading", { name: "Review dashboard", exact: true }).waitFor();
    await page.getByText("On hold — conflict reported", { exact: true }).waitFor();
    await screenWidths("dashboard");
    await page.getByRole("link", { name: "Help & Guide", exact: true }).first().click();
    await page.getByRole("heading", { name: "Start your review", exact: true }).waitFor();
    assert.equal(
      await page.getByRole("heading", { name: "Review Distribution", exact: true }).count(),
      0,
    );
    await screenWidths("help");
    console.log(
      "PASS dashboard/Applications hold consistency, reviewer-first help, six-width reflow",
    );
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("combobox", { name: "Current program", exact: true }).first().click();
    await page.getByRole("option", { name: "Educational Scholarship", exact: true }).click();
    await page.getByRole("link", { name: "Applicants", exact: true }).first().click();
    await page.locator(`a[href='/applicants/${ids[0]}']`).first().click();
    await page.getByRole("tab", { name: /^Rubric/ }).click();
    const scoring = page.locator("[role='tabpanel']:visible");
    await scoring.locator("textarea").fill("Unsaved scholarship fixture comments");
    await page.getByRole("tab", { name: /^Overview/ }).click();
    await page.getByRole("tab", { name: /^Rubric/ }).click();
    assert.equal(
      await scoring.locator("textarea").inputValue(),
      "Unsaved scholarship fixture comments",
    );
    page.once("dialog", (d) => d.dismiss());
    await page.getByRole("link", { name: "Return to my applications", exact: true }).click();
    assert.match(page.url(), new RegExp(ids[0]));
    failSave = true;
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page.getByText(/Save failed. Your changes remain here/).waitFor();
    failSave = false;
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page.getByText("Draft saved successfully.", { exact: true }).waitFor();
    console.log(
      "PASS Scholarship tab retention, departure guard, failure retention and explicit draft save",
    );
  }
} catch (error) {
  await page.screenshot({ path: `${out}/failure.png`, fullPage: true });
  console.log("FIXTURE STATE", page.url(), await page.locator("body").innerText());
  throw error;
} finally {
  await browser.close();
}
