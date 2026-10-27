// Invoked by reviewer-usability-browser.mjs --assignment-summary; all provider calls intercepted.
import assert from "node:assert/strict";
export async function validateAssignmentSummary({
  page,
  fixture,
  assignments,
  ids,
  actor,
  origin,
  out,
  AxeBuilder,
}) {
  const own = assignments[0];
  const base = {
    assignment_id: own.id,
    reviewer_id: actor,
    reviewer_name: "Fixture reviewer",
    assigned_at: "2026-10-27T12:00:00Z",
    status: "not_started",
    replaces: "Original reviewer",
  };
  const event = { occurred_at: "2026-10-26T12:00:00Z", reviewer_name: "Original reviewer" };
  fixture.summaryOverride = {
    application_id: ids[0],
    assignments: [
      base,
      {
        ...base,
        assignment_id: "peer",
        reviewer_id: "peer",
        reviewer_name: "Peer reviewer",
        status: "submitted",
        replaces: null,
      },
    ],
    history: [
      { ...event, id: "1", kind: "assigned" },
      { ...event, id: "2", kind: "conflict_reported" },
      { ...event, id: "3", kind: "replaced", replacement_name: "Intermediate reviewer" },
      {
        ...event,
        id: "4",
        kind: "replaced",
        reviewer_name: "Intermediate reviewer",
        replacement_name: "Fixture reviewer",
      },
      { ...event, id: "5", kind: "cleared", reviewer_name: "Peer reviewer" },
    ],
  };
  async function revisit() {
    await page.goto(`${origin}/grants/${ids[0]}?scope=test`);
    await page.waitForLoadState("networkidle");
    if (new URL(page.url()).pathname === "/login") {
      await page.getByLabel("Email", { exact: true }).fill("fixture@example.invalid");
      await page.getByLabel("Password", { exact: true }).fill("SyntheticFixture123");
      await page.getByRole("button", { name: "Sign In", exact: true }).click();
    }
    await page.getByRole("heading", { name: "Fixture business 1", exact: true }).waitFor();
  }
  await revisit();
  const panel = page.getByRole("region", { name: "Reviewers & assignments" });
  await panel.getByText("Fixture reviewer (You)", { exact: true }).waitFor();
  await panel.getByText("Replacement for Original reviewer", { exact: true }).waitFor();
  await panel.getByText("Peer reviewer", { exact: true }).waitFor();
  await page.getByText("1 of 2 assigned reviews completed", { exact: true }).waitFor();
  assert.equal(await panel.getByRole("link", { name: "Manage assignments" }).count(), 0);
  await panel.locator("summary").click();
  await panel
    .getByText("Fixture reviewer replaced Intermediate reviewer", { exact: true })
    .waitFor();
  await panel.getByText("Conflict cleared for Peer reviewer", { exact: true }).waitFor();
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= innerWidth &&
          document.querySelector("main").scrollWidth <= document.querySelector("main").clientWidth,
      ),
      `Overflow at ${width}`,
    );
    await panel.screenshot({ path: `${out}/assignment-summary-${width}.png` });
  }
  const scan = await new AxeBuilder({ page })
    .include('[aria-labelledby="grant-assignments-heading"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  assert.equal(scan.violations.length, 0, JSON.stringify(scan.violations.map((v) => v.id)));
  // Native history disclosure supports keyboard activation.
  await panel.locator("summary").focus();
  await page.keyboard.press("Enter");
  assert.equal(await panel.locator("details").getAttribute("open"), null);
  await page.keyboard.press("Enter");
  assert.notEqual(await panel.locator("details").getAttribute("open"), null);
  console.log(
    "PASS current reviewers, independent progress, replacement chain, cleared conflict, six-width reflow, keyboard and scoped axe",
  );
  fixture.summaryError = true;
  await revisit();
  await panel
    .getByText("Reviewer assignments and history could not be loaded.", { exact: false })
    .waitFor({ timeout: 25000 });
  await page
    .getByText("Review progress unavailable. Retry assignments below.", { exact: true })
    .waitFor();
  assert.equal(
    await panel.getByText("No active reviewers are assigned to this application.").count(),
    0,
  );
  fixture.summaryError = false;
  await panel.getByRole("button", { name: "Retry assignments" }).click();
  await panel.getByText("Fixture reviewer (You)", { exact: true }).waitFor();
  console.log("PASS summary failure, unknown progress and retry recovery");
  fixture.admin = true;
  own.lifecycle = "suspended";
  fixture.reviewOverride = [
    {
      id: "historical",
      assignment_id: own.id,
      reviewer_id: actor,
      status: "completed",
      rubric_version_id: "old-rubric",
      version: 1,
    },
  ];
  fixture.summaryOverride.assignments = fixture.summaryOverride.assignments.slice(1);
  await revisit();
  await page
    .getByText(
      "You are viewing this application as an administrator. You are not currently assigned to review it.",
      { exact: false },
    )
    .waitFor();
  await page.getByText("Not assigned", { exact: true }).waitFor();
  const href = await panel.getByRole("link", { name: "Manage assignments" }).getAttribute("href");
  assert.ok(href.includes(ids[0]) && href.includes("scope=test"));
  assert.equal(await page.getByRole("button", { name: "Submit review", exact: true }).count(), 0);
  console.log(
    "PASS admin viewing copy and historical completed review excluded from current review",
  );
  fixture.summaryOverride.assignments = [];
  fixture.summaryOverride.history = [];
  await revisit();
  await panel
    .getByText("No active reviewers are assigned to this application.", { exact: true })
    .waitFor();
  await panel.locator("summary").click();
  await panel
    .getByText("No assignment or conflict history is recorded.", { exact: true })
    .waitFor();
  console.log("PASS explicit empty roster and history");
}
