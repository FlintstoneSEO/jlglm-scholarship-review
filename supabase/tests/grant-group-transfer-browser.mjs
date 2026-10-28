import assert from "node:assert/strict";
export async function validateTransfers({ page, fixture, ids, origin, out, AxeBuilder }) {
  await page.getByRole("heading", { name: "Fixture business 1", exact: true }).waitFor();
  const action = page.getByRole("button", { name: "Transfer to another group", exact: true });
  await action.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(await action.evaluate((el) => document.activeElement === el), true);
  fixture.transferGroupsError = true;
  await action.click();
  await dialog.getByRole("button", { name: "Retry groups" }).waitFor();
  fixture.transferGroupsError = false;
  fixture.noTransferGroups = true;
  fixture.transferDelay = true;
  await dialog.getByRole("button", { name: "Retry groups" }).click();
  await dialog.getByText("Loading saved groups…").waitFor();
  await dialog.getByText(/No eligible destination groups/).waitFor();
  fixture.noTransferGroups = false;
  fixture.transferDelay = false;
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await action.click();
  await dialog.getByLabel("Destination saved group").selectOption("destination");
  const reason = dialog.getByLabel("Reason (required, 10–4000 characters)");
  await reason.fill(" short ");
  assert.equal(
    await dialog.getByRole("button", { name: "Review transfer impact" }).isDisabled(),
    true,
  );
  await reason.fill("  Synthetic fresh evaluation reason  ");
  await dialog.getByRole("button", { name: "Review transfer impact" }).click();
  await dialog.getByRole("heading", { name: "Confirm group transfer" }).waitFor();
  await dialog.getByText("Earlier synthetic reviewer: completed").waitFor();
  await dialog.getByText(/Christopher Synthetic Destination Reviewer: fresh review/).waitFor();
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
      `Dialog overflow ${width}`,
    );
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `Page overflow ${width}`,
    );
    await dialog.screenshot({ path: `${out}/transfer-confirm-${width}.png` });
  }
  const axe = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  assert.deepEqual(
    axe.violations.map((v) => v.id),
    [],
  );
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("Tab");
    assert.equal(await dialog.evaluate((el) => el.contains(document.activeElement)), true);
  }
  fixture.transferError = true;
  await dialog.getByRole("button", { name: "Confirm transfer", exact: true }).click();
  await dialog.getByText(/Transfer preview is stale/).waitFor();
  await dialog.getByRole("button", { name: "Review transfer impact" }).click();
  fixture.transferError = false;
  fixture.transferDelay = true;
  fixture.transferUnknownOnce = true;
  await dialog.getByRole("button", { name: "Confirm transfer", exact: true }).click();
  assert.equal(await dialog.getByRole("button", { name: "Transferring…" }).isDisabled(), true);
  await dialog.getByRole("button", { name: "Retry same transfer", exact: true }).waitFor();
  await dialog.getByRole("button", { name: "Retry same transfer", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal(fixture.transferCalls.length, 3);
  assert.equal(fixture.transferCalls[1].p_request, fixture.transferCalls[2].p_request);
  assert.equal(fixture.transferCalls[1].p_reason, "Synthetic fresh evaluation reason");
  assert.notEqual(fixture.transferCalls[0].p_request, fixture.transferCalls[1].p_request);
  await page.getByText("Current group:", { exact: false }).waitFor();
  await page.getByText("Assignment & conflict history", { exact: false }).click();
  await page.getByRole("heading", { name: "Excluded transfer reviews" }).waitFor();
  await page.getByText(/Transferred to Destination evaluation group/).waitFor();
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `${out}/transfer-history-${width}.png`, fullPage: true });
  }
  fixture.admin = false;
  // Simulate the database's redacted response for an authorized ordinary reader.
  delete fixture.summaryOverride.history[0].reason;
  delete fixture.summaryOverride.history[0].actor_name;
  await page.goto(`${origin}/grants/${ids[0]}?scope=test`);
  await page.getByRole("heading", { name: "Fixture business 1", exact: true }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Transfer to another group", exact: true }).count(),
    0,
  );
  console.log(
    "PASS transfer dialog: group loading/error/retry/empty, validation, fresh impact, stale re-preview, explicit confirmation, pending prevention, history, keyboard focus, six widths and scoped WCAG axe; ordinary reviewer has no transfer action",
  );
}
