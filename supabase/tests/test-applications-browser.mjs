// UI evidence only: all provider APIs are synthetic; SQL suite verifies actual DB behavior.
import { chromium } from "../.temp/committee-test/node_modules/playwright/index.mjs";
import AxeBuilder from "../.temp/committee-test/node_modules/@axe-core/playwright/dist/index.mjs";
import fs from "node:fs";
import assert from "node:assert/strict";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
await context.addInitScript(() =>
  localStorage.setItem("jlgl.selectedProgram", "business_growth_grant"),
);
const actor = "ee000000-0000-4000-8000-000000000001",
  gp = "22222222-2222-4222-8222-222222222222",
  sp = "11111111-1111-4111-8111-111111111111";
const user = {
  id: actor,
  aud: "authenticated",
  role: "authenticated",
  email: "fictional-admin@example.invalid",
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
let apps = [],
  resetCalls = 0,
  deleteCalls = 0;
const programs = [
  {
    id: gp,
    slug: "business_growth_grant",
    name: "Business Growth Grant",
    description: null,
    active: true,
  },
  { id: sp, slug: "scholarship", name: "Educational Scholarship", description: null, active: true },
];
await context.route("**/*", async (route) => {
  const url = new URL(route.request().url());
  if (url.hostname === "127.0.0.1" && url.port === "5182") {
    await route.continue();
    return;
  }
  if (!url.pathname.includes("/rest/v1/") && !url.pathname.includes("/auth/v1/")) {
    await route.abort();
    return;
  }
  const table = url.pathname.split("/").pop();
  let body = [];
  if (url.pathname.includes("/auth/v1/token"))
    body = {
      access_token: token,
      refresh_token: "synthetic",
      expires_in: 3600,
      token_type: "bearer",
      user,
    };
  else if (url.pathname.includes("/auth/v1/")) body = user;
  else if (table === "profiles")
    body = [
      {
        id: actor,
        account_setup_completed: true,
        full_name: "Fictional Administrator",
        email: user.email,
      },
    ];
  else if (table === "user_roles") body = [{ role: "admin" }];
  else if (table === "user_program_access")
    body = programs.map((p) => ({
      id: "access-" + p.id,
      user_id: actor,
      program_id: p.id,
      access_role: "admin",
    }));
  else if (table === "programs") body = programs;
  else if (table === "create_test_application") {
    const { p_program } = route.request().postDataJSON();
    const id = "ee000000-0000-4000-9000-" + String(apps.length + 1).padStart(12, "0");
    apps.push({
      id,
      program_id: p_program,
      is_test: true,
      applicant_name: p_program === sp ? "TEST - Sample Student" : "TEST - Sample Applicant",
      applicant_email: "sample@example.invalid",
      review_status: "not_started",
      practice_session_id: null,
      completed_review_count: 0,
      average_score: 0,
      created_at: new Date().toISOString(),
    });
    body = {
      applicationId: id,
      applicantId: p_program === sp ? "ee000000-0000-4000-7000-000000000001" : null,
      applicantName: p_program === sp ? "TEST - Sample Student" : "TEST - Sample Applicant",
      status: "Pending screening",
      assignedReviewers: 0,
    };
  } else if (table === "reset_test_application") {
    resetCalls++;
    body = null;
  } else if (table === "delete_test_application") {
    const { p_application } = route.request().postDataJSON();
    apps = apps.filter((a) => a.id !== p_application);
    deleteCalls++;
    body = null;
  } else if (table === "portal_applications")
    body = apps.filter(
      (a) =>
        !url.searchParams.get("program_id") ||
        a.program_id === url.searchParams.get("program_id").slice(3),
    );
  else if (table === "applicants")
    body = apps
      .filter((a) => a.program_id === sp)
      .map((a) => ({ id: "ee000000-0000-4000-7000-000000000001", application_id: a.id }));
  if (route.request().headers().accept?.includes("vnd.pgrst.object"))
    body = Array.isArray(body) ? (body[0] ?? null) : body;
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
fs.mkdirSync("supabase/.temp/testing-browser", { recursive: true });
try {
  await page.goto("http://127.0.0.1:5182/login");
  await page.waitForFunction(() =>
    Object.keys(document.querySelector("form") ?? {}).some((k) => k.startsWith("__reactProps")),
  );
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("Synthetic-only-password-123");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await page.waitForURL("http://127.0.0.1:5182/", { timeout: 30000 });
  await page.getByRole("link", { name: "Testing", exact: true }).click();
  await page.getByRole("heading", { name: "Test Applications", exact: true }).waitFor();
  await page.getByRole("button", { name: "Create Test Application", exact: true }).click();
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(async () =>
      Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))),
    );
    await page.screenshot({
      path: `supabase/.temp/testing-browser/create-${width}.png`,
      fullPage: true,
    });
    assert.equal(
      await page.evaluate(
        () =>
          document.querySelector("main").scrollWidth > document.querySelector("main").clientWidth,
      ),
      false,
      `create overflow ${width}`,
    );
  }
  await page.getByRole("button", { name: "Generate and Create", exact: true }).click();
  await page.getByRole("heading", { name: "Test application created", exact: true }).waitFor();
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(async () =>
      Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))),
    );
    await page.screenshot({
      path: `supabase/.temp/testing-browser/confirmation-${width}.png`,
      fullPage: true,
    });
    assert.equal(
      await page.evaluate(
        () =>
          document.querySelector("main").scrollWidth > document.querySelector("main").clientWidth,
      ),
      false,
      `confirmation overflow ${width}`,
    );
  }
  await page.getByRole("button", { name: "Create without assignment", exact: true }).click();
  await page.getByRole("button", { name: "Reset Test Review", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(resetCalls, 0);
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(async () =>
      Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))),
    );
    await page.screenshot({
      path: `supabase/.temp/testing-browser/testing-${width}.png`,
      fullPage: true,
    });
    const overflow = await page.evaluate(() => ({
      body: document.body.scrollWidth > innerWidth,
      main:
        document.querySelector("main")?.scrollWidth > document.querySelector("main")?.clientWidth,
    }));
    assert.equal(overflow.body, false, `body overflow ${width}`);
    assert.equal(overflow.main, false, `main overflow ${width}`);
    await page.getByRole("button", { name: "Reset Test Review", exact: true }).click();
    await page.evaluate(async () =>
      Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))),
    );
    await page.screenshot({
      path: `supabase/.temp/testing-browser/reset-${width}.png`,
      fullPage: true,
    });
    assert.equal(
      await dialog.evaluate((e) => e.scrollWidth > e.clientWidth),
      false,
      `dialog overflow ${width}`,
    );
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  }
  const results = await new AxeBuilder({ page })
    .include("main")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  assert.deepEqual(results.violations, []);
  await page.getByRole("button", { name: "Reset Test Review", exact: true }).click();
  await dialog.getByRole("button", { name: "Reset Test Review", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal(resetCalls, 1);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(deleteCalls, 0);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await dialog.getByRole("button", { name: "Delete Test Application", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal(deleteCalls, 1);
  await page.getByRole("combobox", { name: "Program", exact: true }).click();
  await page.getByRole("option", { name: "Educational Scholarship", exact: true }).click();
  await page.getByRole("button", { name: "Create Test Application", exact: true }).click();
  await page.getByRole("button", { name: "Generate and Create", exact: true }).click();
  await page.getByRole("heading", { name: "Test application created", exact: true }).waitFor();
  assert.ok(
    (
      await page
        .getByRole("link", { name: "Open Test Application", exact: true })
        .getAttribute("href")
    ).includes("/applicants/"),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: synthetic create/confirmation/reset/delete for both programs, cancellation, 6 responsive widths and scoped axe",
  );
} catch (error) {
  console.error(
    "UI FAILURE",
    page.url(),
    errors,
    (await page.locator("body").innerText()).slice(0, 3500),
  );
  await page.screenshot({ path: "supabase/.temp/testing-browser/failure.png", fullPage: true });
  throw error;
} finally {
  await browser.close();
}
