import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { authRedirectUrl, isPublicAuthRoute, validateNewPassword } from "./auth-lifecycle.ts";

test("invitation requests use the configured accept-invite redirect target", async () => {
  assert.equal(
    authRedirectUrl("https://portal.example.org/", "/accept-invite"),
    "https://portal.example.org/accept-invite",
  );
  const source = await readFile(new URL("./invite-user.server.ts", import.meta.url), "utf8");
  assert.match(source, /redirectTo: authRedirectUrl\(appUrl, "\/accept-invite"\)/);
});

test("invite and recovery passwords require matching values with at least 8 characters", () => {
  assert.equal(validateNewPassword("short", "short"), "Password must be at least 8 characters.");
  assert.equal(validateNewPassword("long-enough", "different"), "Passwords do not match.");
  assert.equal(validateNewPassword("long-enough", "long-enough"), null);
});

test("all authentication lifecycle routes are public, while portal routes are not", () => {
  for (const route of ["/login", "/accept-invite", "/forgot-password", "/reset-password"])
    assert.equal(isPublicAuthRoute(route), true);
  assert.equal(isPublicAuthRoute("/grants"), false);
});

test("login no longer exposes signup and forgot-password is unguarded", async () => {
  const login = await readFile(new URL("../routes/login.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(login, /auth\.signUp|Create an account|mode === "signup"/);
  assert.match(login, /to="\/forgot-password"/);

  for (const file of ["accept-invite.tsx", "forgot-password.tsx", "reset-password.tsx"]) {
    const source = await readFile(new URL(`../routes/${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /beforeLoad|redirect\(/);
  }
});

test("the normal portal layout still redirects users without a session", async () => {
  const source = await readFile(new URL("../routes/_app.tsx", import.meta.url), "utf8");
  assert.match(source, /if \(!data\.session\) throw redirect\(\{ to: "\/login" \}\)/);
});
