// Presentation and state continuity against the existing isolated, in-memory fixture.
import assert from "node:assert/strict";
import fs from "node:fs";

export async function validateConceptB({ page, ids, out, AxeBuilder }) {
  await page.getByRole("heading", { name: "Fixture business 1", exact: true }).waitFor();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("tab", { name: "Application", exact: true }).click();
  await page.locator(".evidence-evaluation").waitFor();
  const score = page
    .locator(".evidence-evaluation")
    .getByLabel("Business Narrative & Value Proposition score", { exact: true });
  await score.fill("12");
  await page.getByLabel("Reviewer comments", { exact: true }).fill("Concept B continuity fixture");
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    if (width < 1200) await page.getByRole("tab", { name: "Rubric", exact: true }).click();
    else await page.getByRole("tab", { name: "Application", exact: true }).click();
    assert.equal(
      await page.getByLabel("Reviewer comments", { exact: true }).inputValue(),
      "Concept B continuity fixture",
    );
    const fullRubric = page.locator("#review-section-rubric");
    assert.equal(
      await fullRubric
        .getByLabel("Business Narrative & Value Proposition score", { exact: true })
        .inputValue(),
      "12",
    );
    await capture(`workspace-${width}`);
  }
  await page
    .getByRole("button", { name: "Save draft", exact: true })
    .filter({ visible: true })
    .click();
  await page.getByText("Draft saved successfully.", { exact: true }).waitFor();
  await page.getByText("Draft saved.", { exact: true }).waitFor({ state: "hidden" });
  console.log("PASS split-to-tab resize preserves score/comments; explicit draft save");
  await page.locator(".evidence-panels").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await page.evaluate(() =>
    document.querySelectorAll(".evidence-reading, .evidence-evaluation").forEach((el) => {
      el.scrollTop = 0;
    }),
  );
  await page.screenshot({ path: `${out}/evidence-and-evaluation-1440.png`, fullPage: true });
  const workspaceScan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  assert.equal(
    workspaceScan.violations.length,
    0,
    workspaceScan.violations.map((v) => v.id).join(", "),
  );
  async function capture(label) {
    await page.evaluate(() => {
      document.querySelector("main").scrollTop = 0;
      window.scrollTo(0, 0);
      document.querySelectorAll(".evidence-reading, .evidence-evaluation").forEach((el) => {
        el.scrollTop = 0;
      });
    });
    assert.ok(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= innerWidth &&
          document.querySelector("main").scrollWidth <= document.querySelector("main").clientWidth,
      ),
      `${label} overflow`,
    );
    await page.screenshot({ path: `${out}/${label}.png`, fullPage: true });
  }
  const reports = [];
  for (const [label, path, heading] of [
    ["dashboard", "/", "Review dashboard"],
    ["applications", "/grants", "Eligibility screening & review"],
    ["rankings", "/grant-rankings", "Business Growth Grant rankings"],
    ["rubric-management", "/grant-rubric", "Business Growth Grant rubric"],
    ["import", "/grant-import", "Import Business Growth Grants"],
    ["testing", "/testing", "Testing"],
    ["distribution", "/assignments", "Review Distribution"],
    ["users", "/users", "Users & Program Access"],
    ["help", "/help", "Help & Guide"],
  ]) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    // Navigate through the actual shell without dropping the synthetic browser session.
    await page
      .locator(`.grant-masthead a[href="${path}"], .grant-admin-nav a[href="${path}"]`)
      .first()
      .click();
    await page.getByRole("heading", { level: 1, name: heading, exact: true }).waitFor();
    await page.waitForLoadState("networkidle");
    for (const width of [320, 375, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await capture(`${label}-${width}`);
    }
    const scan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    reports.push({ label, violations: scan.violations });
    fs.writeFileSync(`${out}/axe-routes.json`, JSON.stringify(reports, null, 2));
    assert.equal(
      scan.violations.length,
      0,
      `${label}: ${scan.violations.map((v) => v.id).join(", ")}`,
    );
    console.log(`PASS ${label}: six widths and automated accessibility scan`);
  }
}
