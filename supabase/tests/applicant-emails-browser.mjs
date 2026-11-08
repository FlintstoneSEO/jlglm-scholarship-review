import fs from "node:fs";
import assert from "node:assert/strict";
import { chromium } from "../.temp/committee-test/node_modules/playwright/index.mjs";
import AxeBuilder from "../.temp/committee-test/node_modules/@axe-core/playwright/dist/index.mjs";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(15000);
const out = "supabase/.temp/email-evidence";
fs.mkdirSync(out, { recursive: true });
const program = "22222222-2222-4222-8222-222222222222",
  actor = "ad000000-0000-4000-8000-000000000001";
const ids = [1, 2, 3, 4].map((i) => "ad000000-0000-4000-9000-" + String(i).padStart(12, "0"));
const user = {
  id: actor,
  aud: "authenticated",
  role: "authenticated",
  email: "selection@example.invalid",
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
  "." +
  Buffer.from("synthetic-signature").toString("base64url");
await context.addInitScript(() =>
  localStorage.setItem("jlgl.selectedProgram", "business_growth_grant"),
);
let saved = {
    program_id: program,
    finalist_ids: ids.slice(0, 3),
    recipient_ids: ids.slice(0, 2),
    revision: 2,
    finalized_at: new Date().toISOString(),
    updated_by: actor,
    updated_at: new Date().toISOString(),
  },
  failFinalize = true,
  role = "admin";
let explicitlyNotSelected = false;
let sentRecord = null;
let trackingAvailable = true;
function emailState(id = ids[3]) {
  return {
    applicationId: id,
    programId: program,
    name: "Synthetic Applicant " + (ids.indexOf(id) + 1),
    email: "owner@example.invalid",
    businessName: "Synthetic Fourth Business",
    assigned: 2,
    completed: 1,
    reviewComplete: false,
    recipient: ids.slice(0, 2).includes(id),
    finalized: true,
    notSelected: id === ids[3] && explicitlyNotSelected,
    decisionId: id === ids[3] && explicitlyNotSelected ? "decision-id" : null,
    decisionReason:
      id === ids[3] && explicitlyNotSelected ? "Committee recorded non-selection." : null,
    fingerprint: id === ids[3] && explicitlyNotSelected ? "b".repeat(32) : "a".repeat(32),
    history: [],
  };
}
const calls = [],
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await context.route("**/*", async (route) => {
  const url = new URL(route.request().url());
  if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
    await route.abort();
    return;
  }
  if (url.port !== "54329") {
    await route.continue();
    return;
  }
  let body = [];
  const name = url.pathname.split("/").pop();
  let status = 200;
  if (url.pathname.includes("/auth/v1/token"))
    body = {
      access_token: token,
      refresh_token: "synthetic",
      expires_in: 3600,
      token_type: "bearer",
      user,
    };
  else if (url.pathname.startsWith("/auth/")) body = user;
  else if (name === "profiles")
    body = [{ id: actor, full_name: "Synthetic Administrator", account_setup_completed: true }];
  else if (name === "user_roles") body = [{ role }];
  else if (name === "user_program_access") body = [{ program_id: program, access_role: role }];
  else if (name === "programs")
    body = [
      { id: program, slug: "business_growth_grant", name: "Business Growth Grant", active: true },
    ];
  else if (
    ["production_applications", "active_portal_applications", "portal_applications"].includes(name)
  )
    body = ids
      .map((id, i) => ({
        id,
        applicant_name: "Synthetic Applicant " + (i + 1),
        applicant_email: "owner@example.invalid",
        program_id: program,
        is_test: false,
        duplicate_of: null,
        status: "submitted",
        review_status: "not_started",
        completed_review_count: 0,
        average_score: 0,
      }))
      .filter(
        (row) => !url.searchParams.has("id") || url.searchParams.get("id") === "eq." + row.id,
      );
  else if (name === "business_grant_application_details")
    body = ids
      .map((application_id, i) => ({
        application_id,
        business_name: [
          "Synthetic Salon",
          "Synthetic Popcorn",
          "Synthetic Early Learning Center",
          "Synthetic Fourth Business",
        ][i],
        raw_response: {},
      }))
      .filter(
        (row) =>
          !url.searchParams.get("application_id")?.startsWith("eq.") ||
          url.searchParams.get("application_id") === "eq." + row.application_id,
      );
  else if (name === "application_decision_events")
    body = explicitlyNotSelected
      ? [{ id: "decision-id", application_id: ids[3], not_selected: true }]
      : [];
  else if (name === "grant_decision_email_sent") {
    body =
      sentRecord &&
      (!url.searchParams.has("application_id") ||
        url.searchParams.get("application_id") === "eq." + sentRecord.application_id)
        ? [sentRecord]
        : [];
    if (url.searchParams.has("application_id")) body = body[0] ?? null;
    if (!trackingAvailable) {
      status = 404;
      body = { code: "PGRST205", message: "Decision email tracking table is missing" };
    }
  } else if (name === "record_grant_decision_email_sent") {
    const args = route.request().postDataJSON();
    assert.equal(args.p_application, ids[3]);
    sentRecord = {
      application_id: ids[3],
      decision_id: "decision-id",
      recorded_at: new Date().toISOString(),
      recorded_by: actor,
      recorded_by_name: "Synthetic Administrator",
    };
    body = null;
  } else if (name === "grant_selection_decisions") body = saved;
  else if (name === "grant_selection_groups")
    body = ids.map((application_id, i) => ({
      application_id,
      group_name: "Group " + (i + 1),
      reviewers: ["Synthetic Reviewer A", "Synthetic Reviewer B"],
    }));
  else if (name === "application_email_workspace")
    body = emailState(route.request().postDataJSON().p_application);
  else if (name === "record_application_non_selection") {
    explicitlyNotSelected = route.request().postDataJSON().p_not_selected;
    body = null;
  } else if (name === "save_grant_selection") {
    const args = route.request().postDataJSON();
    calls.push(args);
    if (args.p_recipients.length && failFinalize) {
      failFinalize = false;
      status = 409;
      body = { message: "Selections changed. Reload before saving." };
    } else {
      assert.equal(args.p_finalists.length, 3);
      assert.equal(new Set(args.p_finalists).size, 3);
      assert.equal(args.p_revision, saved?.revision ?? 0);
      assert.ok([0, 2].includes(args.p_recipients.length));
      saved = {
        program_id: program,
        finalist_ids: args.p_finalists,
        recipient_ids: args.p_recipients,
        revision: (saved?.revision ?? 0) + 1,
        finalized_at: args.p_recipients.length ? new Date().toISOString() : null,
        updated_by: actor,
        updated_at: new Date().toISOString(),
      };
      body = null;
    }
  }
  if (Array.isArray(body) && route.request().headers().accept?.includes("vnd.pgrst.object"))
    body = body[0] ?? null;
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" },
    body: JSON.stringify(body),
  });
});
async function capture(label) {
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    if ((await page.getByRole("dialog").count()) === 0)
      await page
        .getByRole("heading", { name: "Decision & email", exact: true })
        .scrollIntoViewIfNeeded();
    const sizes = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    assert.ok(sizes.scroll <= sizes.width, JSON.stringify(sizes));
    await page.screenshot({ path: `${out}/${label}-${width}.png`, fullPage: true });
  }
  const axe = await new AxeBuilder({ page })
    .include("main")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  assert.deepEqual(
    axe.violations.map((x) => ({ id: x.id, targets: x.nodes.map((n) => n.target) })),
    [],
  );
}

const { createServer } = await import("node:http");
const stub = createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  res.setHeader("Content-Type", "application/json");
  if (req.url.startsWith("/auth/")) res.end(JSON.stringify(user));
  else if (req.url.includes("application_email_workspace"))
    res.end(JSON.stringify(emailState(JSON.parse(raw).p_application)));
  else {
    res.statusCode = 404;
    res.end("{}");
  }
});
await new Promise((resolve) => stub.listen(54329, "127.0.0.1", resolve));
try {
  await page.goto("http://127.0.0.1:4176/login");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("Synthetic-only-password1!");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes("login"));
  await page.goto("http://127.0.0.1:4176/grants");
  const filter = page.getByLabel("Decision", { exact: true });
  await filter.selectOption("pending");
  await page.waitForURL((url) => url.searchParams.get("decision") === "pending");
  const pendingBusiness = page.getByText("Synthetic Fourth Business", { exact: true }).first();
  await pendingBusiness.waitFor();
  await page.getByText("Synthetic Salon", { exact: true }).first().waitFor({ state: "hidden" });
  const row = page.locator("li").filter({ hasText: "Synthetic Fourth Business" });
  await row.getByRole("link", { name: /Review eligibility|View application/ }).click();
  await page
    .getByText("Mark the application Not selected to prepare its decision email.")
    .waitFor();
  await capture("incomplete");
  await page.getByText("Mark not selected", { exact: true }).click();
  await page
    .getByLabel("Decision reason (10–2,000 characters)")
    .fill("Committee recorded non-selection.");
  await page.getByRole("button", { name: "Record Not selected decision", exact: true }).click();
  const prepare = page.getByRole("button", { name: "Prepare application decision email" });
  await prepare.and(page.locator("button:enabled")).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("dialog").waitFor();
  const draftLink = page.getByRole("link", { name: "Open in Gmail", exact: true });
  const draft = new URL(await draftLink.getAttribute("href"));
  assert.equal(draft.origin, "https://mail.google.com");
  assert.equal(draft.pathname, "/mail/");
  assert.equal(draft.searchParams.get("view"), "cm");
  assert.equal(draft.searchParams.get("to"), "owner@example.invalid");
  assert.match(draft.searchParams.get("su"), /Application Decision/);
  assert.match(draft.searchParams.get("body"), /^Dear Synthetic Applicant 4,/);
  assert.deepEqual([...draft.searchParams.keys()], ["view", "fs", "to", "su", "body"]);
  assert.equal(await draftLink.getAttribute("target"), "_blank");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download original letter", exact: true }).click();
  const sourceDownload = await downloaded;
  assert.equal(sourceDownload.suggestedFilename(), "Application Decision Letter.docx");
  await sourceDownload.saveAs(out + "/source-letter.docx");
  assert.deepEqual(
    fs.readFileSync(out + "/source-letter.docx"),
    Buffer.from(fs.readFileSync("src/lib/letter-sources/decision.base64", "utf8"), "base64"),
  );
  await capture("preview");
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await page.getByRole("button", { name: "Mark decision email sent", exact: true }).click();
  await page.getByRole("button", { name: "Confirm email sent", exact: true }).click();
  await page.getByText("Decision email sent", { exact: true }).waitFor();
  assert.equal(await prepare.count(), 0);
  await page.goto("http://127.0.0.1:4176/grants?decisionEmail=sent");
  await pendingBusiness.waitFor();
  await page.getByText("Email sent", { exact: true }).waitFor();
  assert.equal(await page.getByText("Synthetic Salon", { exact: true }).count(), 0);
  await page.screenshot({ path: out + "/sent-filter.png" });
  await page.goto("http://127.0.0.1:4176/grants?decision=not_selected");
  await pendingBusiness.waitFor();
  assert.equal(await page.getByText("Synthetic Salon", { exact: true }).count(), 0);
  await filter.selectOption("recipient");
  await page.waitForURL((url) => url.searchParams.get("decision") === "recipient");
  await page.getByText("Synthetic Salon", { exact: true }).first().waitFor();
  await pendingBusiness.waitFor({ state: "hidden" });
  await page
    .locator("li")
    .filter({ hasText: "Synthetic Salon" })
    .getByRole("link", { name: /Review eligibility|View application/ })
    .click();
  await page.getByRole("button", { name: "Prepare congratulations email" }).click();
  const congratulations = new URL(await draftLink.getAttribute("href"));
  assert.match(congratulations.searchParams.get("body"), /congratulations on being selected/);
  await page.keyboard.press("Escape");
  trackingAvailable = false;
  await page.reload();
  await page.getByText("Sent tracking isn’t set up yet.", { exact: true }).waitFor();
  assert.equal(
    await page.getByText("Email status could not be loaded.", { exact: false }).count(),
    0,
  );
  assert.equal(await page.getByRole("button", { name: "Mark decision email sent" }).count(), 0);
  await page.getByRole("button", { name: "Prepare congratulations email" }).click();
  assert.equal(new URL(await draftLink.getAttribute("href")).origin, "https://mail.google.com");
  await page.keyboard.press("Escape");
  role = "reviewer";
  await page.goto("http://127.0.0.1:4176/grants?decision=recipient");
  await page.getByLabel("Search applications").waitFor();
  assert.equal(await filter.count(), 0);
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    out + "/result.json",
    JSON.stringify(
      { widths: [320, 375, 390, 768, 1024, 1440], axe: "passed", externalSends: 0, errors },
      null,
      2,
    ),
  );
  console.log(
    "PASS: decisions, personalized drafts, sent confirmation and filter, keyboard, six widths, axe and reviewer exclusion",
  );
} catch (e) {
  await page.screenshot({ path: out + "/failure.png", fullPage: true });
  console.error(await page.locator("body").innerText());
  throw e;
} finally {
  await browser.close();
  await new Promise((resolve) => stub.close(resolve));
}
