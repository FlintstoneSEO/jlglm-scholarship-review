// Synthetic evidence only. Never contacts hosted Supabase or uses real accounts.
import { chromium } from "../.temp/committee-test/node_modules/playwright/index.mjs";
import AxeBuilder from "../.temp/committee-test/node_modules/@axe-core/playwright/dist/index.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
const origin = "http://127.0.0.1:4174";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const user = { id: "ee000000-0000-4000-8000-000000000001", aud: "authenticated", role: "authenticated", email: "fixture@example.invalid", app_metadata: { provider: "email" }, user_metadata: {}, created_at: new Date().toISOString() };
const jwt = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url") + "." + Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now()/1000)+3600 })).toString("base64url") + ".synthetic";
let setup = true, failLogin = false, refreshes = 0;
await context.route("**/*", async route => {
  const url = new URL(route.request().url());
  if (!["127.0.0.1", "localhost"].includes(url.hostname)) return route.abort();
  if (url.port !== "54329") return route.continue();
  let body = [], status = 200;
  if (url.pathname === "/auth/v1/token") {
    if (url.searchParams.get("grant_type") === "refresh_token") refreshes++;
    status = failLogin ? 400 : 200;
    body = failLogin ? { message: "Invalid login credentials" } : { access_token: jwt, refresh_token: "synthetic", expires_in: 3600, token_type: "bearer", user };
  } else if (url.pathname.startsWith("/auth/")) body = user;
  else {
    assert.equal(route.request().method(), "GET", "No data writes permitted");
    const table = url.pathname.split("/").pop();
    if (table === "profiles") body = { account_setup_completed: setup };
    if (table === "user_roles") body = [{ role: "reviewer" }];
    if (table === "user_program_access") body = [{ id: "access", program_id: "program", access_role: "reviewer" }];
    if (table === "programs") body = [{ id: "program", slug: "scholarship", name: "Educational Scholarship" }];
  }
  return route.fulfill({ status, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(body) });
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const signIn = async () => {
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("synthetic-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
};
try {
  await page.goto(`${origin}/help?source=refresh#guide`);
  await page.waitForURL(/\/login\?next=/);
  assert.ok(new URL(page.url()).searchParams.get("next").includes("/help?source=refresh"));
  await page.getByLabel("Remember my email on this device").check();
  await signIn();
  await page.waitForURL(/\/help\?source=refresh/);
  await page.getByRole("heading", { name: /Help/ }).first().waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem("jlgl.rememberedEmail")), user.email);
  await page.reload();
  await page.getByRole("heading", { name: /Help/ }).first().waitFor();
  assert.ok(page.url().includes("/help?source=refresh#guide"));
  await page.goto(`${origin}/help?direct=1`);
  await page.getByRole("heading", { name: /Help/ }).first().waitFor();
  assert.ok(page.url().includes("/help?direct=1"));
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find(key => /^sb-.*-auth-token$/.test(key));
    const session = JSON.parse(localStorage.getItem(key));
    session.expires_at = Math.floor(Date.now() / 1000) - 60;
    localStorage.setItem(key, JSON.stringify(session));
  });
  await page.reload();
  await page.getByRole("heading", { name: /Help/ }).first().waitFor();
  assert.ok(refreshes > 0, "Expired session refreshes with the provider before protected entry");
  await page.goto(`${origin}/login?next=%2Fhelp`);
  await page.waitForURL(`${origin}/help`);
  await page.getByRole("heading", { name: /Help/ }).first().waitFor();
  await page.getByRole("button", { name: /Sign Out/i }).filter({ visible: true }).click();
  await page.waitForURL(/\/login/);
  assert.equal(await page.getByLabel("Email", { exact: true }).inputValue(), user.email);
  assert.equal(await page.getByLabel("Password", { exact: true }).inputValue(), "");
  await page.getByLabel("Remember my email on this device").uncheck();
  assert.equal(await page.evaluate(() => localStorage.getItem("jlgl.rememberedEmail")), null);
  await page.reload();
  assert.equal(await page.getByLabel("Email", { exact: true }).inputValue(), "");
  failLogin = true;
  await page.getByLabel("Remember my email on this device").check();
  await signIn();
  await page.getByText("Invalid login credentials").waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem("jlgl.rememberedEmail")), null);
  failLogin = false;
  await page.goto(`${origin}/login`);
  await page.getByRole("heading", { name: "Sign In" }).waitFor();
  await page.getByRole("status").filter({ hasText: "Invalid login credentials" }).waitFor({ state: "hidden" });
  fs.mkdirSync("supabase/.temp/login-reliability", { recursive: true });
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow at ${width}`);
    const label = page.getByText(/^Version 1\.0\.0 · Build/).filter({ visible: true });
    await label.waitFor();
    const box = await label.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= width);
    await page.screenshot({ path: `supabase/.temp/login-reliability/login-${width}.png`, fullPage: true });
  }
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  assert.equal(axe.violations.length, 0, JSON.stringify(axe.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) }))));
  setup = false;
  await signIn();
  await page.waitForURL(/\/accept-invite/);
  await page.goto(`${origin}/help`);
  await page.waitForURL(/\/accept-invite/);
  assert.deepEqual(errors, []);
  console.log("PASS: signed-out redirect, successful login, hard refresh, expired-token refresh, direct entry, signed-in login redirect, sign-out, remember/forget email, failed-login privacy, setup gate, six-width reflow and scoped axe.");
} finally { await browser.close(); }
