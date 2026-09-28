import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  authRedirectUrl,
  isPublicAuthRoute,
  safeLoginNext,
  validateNewPassword,
} from "./auth-lifecycle.ts";

test("login redirect stays on the portal origin", () => {
  assert.equal(safeLoginNext("/grants?filter=open"), "/grants?filter=open");
  for (const value of ["//evil.example", "/\\evil.example", "https://evil.example", "grants", null])
    assert.equal(safeLoginNext(value), null);
});

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

test("login is invitation-only email/password authentication", async () => {
  const login = await readFile(new URL("../routes/login.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(
    login,
    /signInWithOAuth|Continue with Google|auth\.signUp|Create (?:an )?[Aa]ccount|Sign Up|mode === "signup"/,
  );
  assert.match(login, /supabase\.auth\.signInWithPassword/);
  assert.match(
    login,
    /Access to this portal is by invitation only\. Contact a Justice League administrator if/,
  );
  assert.match(login, /to="\/forgot-password"/);
});

test("public auth forms have a visible page-level heading on mobile", async () => {
  const login = await readFile(new URL("../routes/login.tsx", import.meta.url), "utf8");
  const shell = await readFile(new URL("../components/AuthPageShell.tsx", import.meta.url), "utf8");
  assert.match(login, /<h1 className="font-display text-2xl">Sign In<\/h1>/);
  assert.match(shell, /<h1 className="font-display text-2xl">\{title\}<\/h1>/);
  assert.doesNotMatch(login, /<h1 className="font-display text-4xl/);
  assert.doesNotMatch(shell, /<h1 className="font-display text-4xl/);
});

test("invite, recovery, and reset pages remain public and keep their auth operations", async () => {
  for (const file of ["accept-invite.tsx", "forgot-password.tsx", "reset-password.tsx"]) {
    const source = await readFile(new URL(`../routes/${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /beforeLoad|redirect\(/);
  }

  const passwordForm = await readFile(
    new URL("../components/PasswordSetupForm.tsx", import.meta.url),
    "utf8",
  );
  const forgotPassword = await readFile(
    new URL("../routes/forgot-password.tsx", import.meta.url),
    "utf8",
  );
  assert.match(passwordForm, /supabase\.auth\.updateUser\(\{ password \}\)/);
  assert.match(forgotPassword, /supabase\.auth\.resetPasswordForEmail/);
});

test("the normal portal layout still redirects users without a session", async () => {
  const source = await readFile(new URL("../routes/_app.tsx", import.meta.url), "utf8");
  assert.match(source, /if \(!data\.session\) throw redirect\(\{ to: "\/login" \}\)/);
});
