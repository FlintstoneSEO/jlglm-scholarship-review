import fs from "node:fs";
import assert from "node:assert/strict";
import { chromium } from "../.temp/committee-test/node_modules/playwright/index.mjs";
import AxeBuilder from "../.temp/committee-test/node_modules/@axe-core/playwright/dist/index.mjs";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(15000);
const out = "supabase/.temp/selection-evidence";
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
  ".synthetic";
await context.addInitScript(() =>
  localStorage.setItem("jlgl.selectedProgram", "business_growth_grant"),
);
let saved = null,
  failFinalize = true,
  role = "admin";
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
  else if (name === "production_applications")
    body = ids.map((id, i) => ({
      id,
      applicant_name: "Synthetic Applicant " + (i + 1),
      program_id: program,
      is_test: false,
    }));
  else if (name === "business_grant_application_details")
    body = ids.map((application_id, i) => ({
      application_id,
      business_name: [
        "Synthetic Salon",
        "Synthetic Popcorn",
        "Synthetic Early Learning Center",
        "Synthetic Fourth Business",
      ][i],
    }));
  else if (name === "grant_selection_decisions") body = saved;
  else if (name === "grant_selection_groups")
    body = ids.map((application_id, i) => ({
      application_id,
      group_name: "Group " + (i + 1),
      reviewers: ["Synthetic Reviewer A", "Synthetic Reviewer B"],
    }));
  else if (name === "save_grant_selection") {
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
try {
  await page.goto("http://127.0.0.1:4176/login");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("Synthetic-only-password1!");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes("login"));
  await page.goto("http://127.0.0.1:4176/grant-rankings");
  await page.getByRole("tab", { name: "Finalists & recipients" }).click();
  await page.getByText(/Group 1.*Synthetic Reviewer A.*Synthetic Reviewer B/).waitFor();
  const checks = page.getByRole("checkbox");
  await checks.nth(0).check();
  await checks.nth(1).check();
  await checks.nth(2).check();
  assert.equal(await checks.nth(3).isDisabled(), true);
  await page.getByRole("button", { name: "Save three finalists" }).click();
  await page.getByRole("button", { name: "Finalize two recipients" }).waitFor();
  await capture("finalists");
  await page.getByRole("tab", { name: "Rankings", exact: true }).click();
  await page.getByRole("tab", { name: "Finalists & recipients" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Finalize two recipients" }).waitFor();
  const recipients = page.getByRole("group", { name: "Grant recipients" }).getByRole("checkbox");
  await recipients.nth(0).check();
  await recipients.nth(1).check();
  assert.equal(await recipients.nth(2).isDisabled(), true);
  await page.getByRole("button", { name: "Finalize two recipients" }).click();
  await page.getByRole("button", { name: "Confirm two recipients" }).click();
  await page.getByRole("dialog").getByRole("alert").waitFor();
  assert.match(await page.getByRole("dialog").innerText(), /Selections changed/);
  await page.getByRole("button", { name: "Confirm two recipients" }).click();
  await page.getByText(/Two recipients finalized/).waitFor();
  await capture("finalized");
  await page.getByRole("tab", { name: "Rankings", exact: true }).click();
  await page.getByText(/3 interview finalists/).waitFor();
  await capture("rankings");
  await page.reload();
  await page.getByRole("tab", { name: "Finalists & recipients" }).click();
  await page.getByText(/Two recipients finalized/).waitFor();
  assert.equal(await page.getByRole("button", { name: "Save three finalists" }).count(), 0);
  role = "reviewer";
  await page.reload();
  await page.getByText("Business Growth Grant administrator access is required.").waitFor();
  assert.equal(await page.getByRole("tab", { name: "Finalists & recipients" }).count(), 0);
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    `${out}/result.json`,
    JSON.stringify(
      { calls, errors, widths: [320, 375, 390, 768, 1024, 1440], axe: "passed" },
      null,
      2,
    ),
  );
  console.log(
    "PASS browser: save, counts, group labels, confirmation error/retry, finalization, ranking labels, reload, six widths and axe",
  );
} catch (e) {
  await page.screenshot({ path: `${out}/failure.png`, fullPage: true });
  console.error(await page.locator("body").innerText());
  throw e;
} finally {
  await browser.close();
}
