// Run via reviewer-usability-browser.mjs --admin-practice; provider writes stay in memory.
import assert from "node:assert/strict";
export async function validateAdminPractice({
  page,
  fixture,
  apps,
  assignments,
  ids,
  origin,
  out,
  AxeBuilder,
}) {
  const button = (name) => page.getByRole("button", { name, exact: true });
  async function blocked(name) {
    return (await button(name).count()) === 0 || (await button(name).isDisabled());
  }
  async function visit(url = page.url()) {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    // Full SSR loads have no browser session; authenticate only against intercepted APIs.
    if (new URL(page.url()).pathname === "/login") {
      await page.getByLabel("Email", { exact: true }).fill("fixture@example.invalid");
      await page.getByLabel("Password", { exact: true }).fill("SyntheticFixture123");
      await button("Sign In").click();
    }
    await page.locator("main h1").waitFor();
  }
  async function widths(label) {
    for (const width of [320, 375, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <= innerWidth &&
            document.querySelector("main").scrollWidth <=
              document.querySelector("main").clientWidth,
        ),
        `${label} overflow ${width}`,
      );
      await page.screenshot({ path: `${out}/${label}-${width}.png`, fullPage: true });
    }
  }
  await visit(`${origin}/assignments?tab=progress&attention=true`);
  await page.getByRole("group", { name: "Resolve report", exact: true }).waitFor();
  const record = button("Record resolution");
  assert.equal(await record.isDisabled(), true);
  await page.getByLabel("Decision", { exact: true }).selectOption("replaced");
  await page.getByLabel("Resolution reason (10–4000 characters)").fill("   short   ");
  assert.equal(await record.isDisabled(), true);
  await page
    .getByLabel("Resolution reason (10–4000 characters)")
    .fill("Synthetic confirmed relationship");
  assert.equal(await record.isDisabled(), true);
  await page
    .getByLabel("Replacement reviewer", { exact: true })
    .selectOption("replacement-fixture");
  fixture.resolutionError = true;
  await record.click();
  await page.getByText("Synthetic resolution rejected", { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel("Resolution reason (10–4000 characters)").inputValue(),
    "Synthetic confirmed relationship",
  );
  await widths("admin-conflict");
  fixture.resolutionError = false;
  await record.click();
  await page.getByText(/Resolution recorded. Replacement assigned/).waitFor();
  assert.equal(await record.isDisabled(), true);
  assert.equal(fixture.resolutionCalls.length, 2);
  assert.equal(fixture.resolutionCalls[1].p_replacement, "replacement-fixture");
  console.log(
    "PASS admin prerequisites, rejected-write retention, replacement feedback and duplicate prevention",
  );
  fixture.candidates = [];
  await visit();
  await page.getByLabel("Decision", { exact: true }).selectOption("replaced");
  await page.getByText(/No eligible replacement is available/).waitFor();
  assert.equal(await record.isDisabled(), true);
  fixture.candidateError = true;
  await visit();
  await page.getByLabel("Decision", { exact: true }).selectOption("replaced");
  await page.getByText(/Replacement eligibility is unavailable/).waitFor();
  assert.equal(await record.isDisabled(), true);
  // Clear does not require an available replacement list.
  await page.getByLabel("Decision", { exact: true }).selectOption("cleared");
  await page
    .getByLabel("Resolution reason (10–4000 characters)")
    .fill("Synthetic clear decision after investigation");
  await record.click();
  await page.getByText(/Resolution recorded. Reviewer must record no known conflict/).waitFor();
  assert.equal("p_replacement" in fixture.resolutionCalls.at(-1), false);
  fixture.candidateError = false;
  console.log("PASS empty/failed candidates and clear without replacement");
  await visit(`${origin}/testing`);
  await page.getByText("Group practice (optional)", { exact: true }).click();
  await page.getByText("Practice readiness checklist", { exact: true }).click();
  await page.locator("#grant-practice-controls select").selectOption("practice-fixture");
  assert.match(
    await page.getByRole("link", { name: "Assign practice reviewers" }).getAttribute("href"),
    /scope=test/,
  );
  await widths("admin-practice");
  page.once("dialog", (d) => d.dismiss());
  await button("Reset Practice Run").click();
  assert.equal(fixture.practiceCalls.length, 0);
  page.once("dialog", (d) => d.accept());
  await button("Reset Practice Run").click();
  await page
    .getByText("Practice work archived. A fresh round is ready.", { exact: true })
    .waitFor();
  assert.equal(fixture.practiceCalls[0].input.p_round, 1);
  page.once("dialog", (d) => d.accept());
  await button("End Practice Run").click();
  await page.getByText("Practice run ended and archived.", { exact: true }).waitFor();
  assert.equal(fixture.practiceCalls[1].input.p_round, 2);
  assert.equal(fixture.practiceCalls[1].input.p_end, true);
  assert.equal(await button("Reset Practice Run").count(), 0);
  console.log("PASS practice reset cancellation/current round and end; test assignment navigation");
  await page.getByText("Start a new practice run", { exact: true }).click();
  const start = button("Start Practice Run");
  assert.equal(await start.isDisabled(), true);
  const participants = page.locator("#grant-practice-controls input[type=checkbox]");
  await participants.nth(0).check();
  assert.equal(await start.isDisabled(), true);
  await participants.nth(1).check();
  await start.click();
  await page
    .getByText("Practice run created with 40 fictional applications.", { exact: true })
    .waitFor();
  assert.equal(fixture.practiceCalls.at(-1).input.p_participants.length, 2);
  // A role alone is insufficient to score. The participant's assignment must exist.
  const own = assignments.shift();
  await visit(`${origin}/grants/${ids[0]}?scope=test`);
  await page.getByText(/You need an active assignment/).waitFor();
  await page.getByRole("tab", { name: /^Rubric/ }).click();
  assert.equal(await blocked("Save draft"), true);
  assert.equal(await blocked("Submit review"), true);
  assert.match(
    await page
      .getByRole("link", { name: "Return to practice controls", exact: true })
      .getAttribute("href"),
    /testing/,
  );
  assignments.unshift(own);
  fixture.declared = false;
  await visit();
  await page.getByText(/Record your own conflict decision below before scoring/).waitFor();
  fixture.declared = true;
  fixture.rubric = false;
  await visit();
  await page.getByText(/activate a populated rubric before scoring/).waitFor();
  fixture.rubric = true;
  fixture.eligibility = "needs_clarification";
  await visit();
  await page.getByText(/Eligibility has not cleared scoring/).waitFor();
  fixture.exception = true;
  await visit();
  await page.getByText(/Ready to score. Read the application/).waitFor();
  fixture.documentError = true;
  await visit();
  await page
    .getByRole("heading", { name: "We could not load this application.", exact: true })
    .waitFor();
  assert.equal(await page.getByText(/Ready to score. Read the application/).count(), 0);
  fixture.documentError = false;
  await visit();
  await page.getByRole("tab", { name: /^Documents/ }).click();
  await page.getByRole("button", { name: /Fictional P&L/ }).click();
  await page.getByRole("heading", { name: "Practice supporting document", exact: true }).waitFor();
  await page.getByRole("heading", { name: "Sample 2024 profit and loss", exact: true }).waitFor();
  await page.getByRole("link", { name: "Return to application", exact: true }).click();
  await page.getByRole("tab", { name: /^Rubric/ }).click();
  const fields = page.locator("input[type=number]");
  assert.equal(await fields.count(), 7);
  for (let i = 0; i < 7; i++) await fields.nth(i).fill(String([15, 15, 15, 20, 15, 10, 10][i]));
  await button("Save draft").click();
  await page.getByText("Draft saved successfully.", { exact: true }).waitFor();
  assert.equal(await button("Submit review").isDisabled(), true);
  await page.getByRole("checkbox", { name: /^I confirm that I completed/ }).check();
  assert.equal(await button("Submit review").isEnabled(), true);
  await widths("practice-seven-criteria");
  const axe = await new AxeBuilder({ page })
    .include("main")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  assert.equal(axe.violations.length, 0, axe.violations.map((v) => v.id).join(", "));
  console.log(
    "PASS unassigned-admin/declaration/rubric/eligibility gates, exception, seven-criterion draft and certification; reflow/scoped axe",
  );
  // Reset/end must remove active assignments; database suites separately verify that effect.
  // Finish without dirty state, then simulate the archived assignment readback.
  await button("Submit review").click();
  await page.getByRole("region", { name: "Submission confirmation" }).waitFor();
  assignments[0].lifecycle = "suspended";
  fixture.hideReviews = true;
  apps[0].practice_round = 1;
  await visit(`${origin}/grants/${ids[0]}?scope=test`);
  await visit();
  await page.getByText(/You need an active assignment/).waitFor();
  await page.getByRole("tab", { name: /^Rubric/ }).click();
  assert.equal(await blocked("Save draft"), true);
  console.log("PASS archived-round suspended assignment cannot save");
}
