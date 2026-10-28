// Browser contract tests; provider calls intercepted by reviewer-usability-browser.mjs.
import assert from "node:assert/strict";
export async function validateDuplicates({ page, fixture, apps, ids, origin, out, AxeBuilder }) {
  apps[1].practice_session_id = apps[0].practice_session_id;
  apps[1].practice_round = apps[0].practice_round;
  await page.getByRole("heading", { name: "Fixture business 1", exact: true }).waitFor();
  const action = page.getByRole("button", { name: "Mark as duplicate", exact: true });
  await action.focus();
  await page.keyboard.press("Enter");
  let dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(await action.evaluate((el) => el === document.activeElement), true);
  fixture.duplicateCandidatesError = true;
  await action.click();
  await dialog
    .getByLabel("Search retained application by business or applicant")
    .fill("Failure state");
  await dialog.getByRole("button", { name: "Retry", exact: true }).waitFor({ timeout: 25000 });
  fixture.duplicateCandidatesError = false;
  fixture.duplicateDelay = true;
  await dialog.getByRole("button", { name: "Retry", exact: true }).click();
  await dialog.getByText("Loading compatible applications…").waitFor();
  fixture.duplicateDelay = false;
  await dialog
    .getByLabel("Search retained application by business or applicant")
    .fill("No matching fictional name");
  await dialog.getByText("No compatible applications found.").waitFor();
  await dialog
    .getByLabel("Search retained application by business or applicant")
    .fill("Fixture applicant 2");
  await dialog
    .getByRole("radio", { name: "Fixture business 2 Applicant: Fixture applicant 2" })
    .check();
  assert.equal(
    await dialog.getByRole("button", { name: "Review impact", exact: true }).isDisabled(),
    true,
  );
  await dialog
    .getByLabel("Reason (required, 10–4000 characters)")
    .fill("Synthetic matching source submissions");
  await dialog.getByRole("button", { name: "Review impact", exact: true }).click();
  await dialog.getByRole("heading", { name: "Confirm duplicate exclusion" }).waitFor();
  await dialog
    .getByText("1 affected assignments: 1 completed reviews, 0 drafts, 0 not started.")
    .waitFor();
  await dialog.getByText(/Reviews and scores will not be transferred or combined/).waitFor();
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
      `Dialog overflow at ${width}`,
    );
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `Page overflow at ${width}`,
    );
    await dialog.screenshot({ path: `${out}/duplicate-confirmation-${width}.png` });
  }
  const scan = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  assert.equal(scan.violations.length, 0, JSON.stringify(scan.violations.map((v) => v.id)));
  // Tab and Shift+Tab stay within the dialog.
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press(i % 2 ? "Shift+Tab" : "Tab");
    assert.ok(await dialog.evaluate((el) => el.contains(document.activeElement)));
  }
  fixture.duplicateError = true;
  await dialog.getByRole("button", { name: "Confirm mark as duplicate", exact: true }).click();
  await dialog.getByRole("alert").filter({ hasText: "Assignments or reviews changed" }).waitFor();
  assert.equal(apps[0].duplicate_of, undefined);
  assert.equal(
    await dialog.getByLabel("Reason (required, 10–4000 characters)").inputValue(),
    "Synthetic matching source submissions",
  );
  fixture.duplicateError = false;
  await dialog.getByRole("button", { name: "Review impact", exact: true }).click();
  fixture.duplicateDelay = true;
  await dialog.getByRole("button", { name: "Confirm mark as duplicate", exact: true }).click();
  assert.equal(
    await dialog.getByRole("button", { name: "Marking…", exact: true }).isDisabled(),
    true,
  );
  await dialog.waitFor({ state: "hidden" });
  fixture.duplicateDelay = false;
  assert.equal(fixture.duplicateCalls.length, 2);
  assert.equal(fixture.duplicateCalls[1].p_retained, ids[1]);
  assert.equal(apps[1].duplicate_of, undefined);
  await page
    .getByRole("heading", { name: "Duplicate application — excluded review history", exact: true })
    .waitFor();
  assert.match(
    await page
      .getByRole("link", { name: "Open retained application", exact: true })
      .getAttribute("href"),
    new RegExp(ids[1]),
  );
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `History overflow ${width}`,
    );
    await page.screenshot({ path: `${out}/duplicate-history-${width}.png`, fullPage: true });
  }
  await page.goto(`${origin}/grants?scope=test`);
  await page
    .getByRole("heading", { name: "Eligibility screening & review", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Mark as duplicate", exact: true }).first().waitFor();
  assert.equal(await page.getByRole("link", { name: /Fixture business 1/ }).count(), 0);
  await page.getByLabel("Application designation").selectOption("excluded");
  await page.getByText("Duplicate — reviews excluded", { exact: true }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Mark as duplicate", exact: true }).count(),
    0,
  );
  console.log(
    "PASS duplicate search, validation, confirmation, error/retry, pending state, active/excluded management, six-width reflow, keyboard and scoped axe",
  );
  fixture.admin = false;
  await page.goto(`${origin}/grants/${ids[0]}?scope=test`);
  await page
    .getByRole("heading", { name: "Duplicate application — excluded review history", exact: true })
    .waitFor();
  assert.equal(
    await page.getByRole("link", { name: "Open retained application", exact: true }).count(),
    0,
  );
  assert.equal(
    await page.getByRole("button", { name: "Mark as duplicate", exact: true }).count(),
    0,
  );
  for (const button of await page
    .getByRole("button", { name: /^(Save draft|Submit review)$/ })
    .all())
    assert.equal(await button.isDisabled(), true);
  console.log(
    "PASS reviewer duplicate history explains exclusion, disables review writes and offers no retained application link",
  );
}
