import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  accountSetupDestination,
  authRedirectUrl,
  finishInviteSetup,
  isPublicAuthRoute,
  safeLoginNext,
  validateNewPassword,
} from "./auth-lifecycle.ts";

test("invite sessions remain outside the portal until explicit setup completion", () => {
  assert.equal(accountSetupDestination(false, null), "/login");
  assert.equal(accountSetupDestination(true, false), "/accept-invite");
  assert.equal(accountSetupDestination(true, null), "/accept-invite");
  assert.equal(accountSetupDestination(true, true), "/");
});

test("invite completion saves password first and retries only the profile step", async () => {
  const calls: string[] = [];
  let saved = false;
  const updatePassword = async () => {
    calls.push("password");
  };
  const failProfile = async () => {
    calls.push("profile-failed");
    throw new Error("profile unavailable");
  };
  await assert.rejects(
    finishInviteSetup("valid-password", saved, updatePassword, failProfile, () => {
      saved = true;
    }),
    /profile unavailable/,
  );
  assert.equal(saved, true);
  await finishInviteSetup(
    "valid-password",
    saved,
    updatePassword,
    async () => {
      calls.push("profile-completed");
    },
    () => {
      saved = true;
    },
  );
  assert.deepEqual(calls, ["password", "profile-failed", "profile-completed"]);
});

test("failed password update never marks invitation complete", async () => {
  let marked = false;
  await assert.rejects(
    finishInviteSetup(
      "valid-password",
      false,
      async () => {
        throw new Error("password rejected");
      },
      async () => {
        marked = true;
      },
      () => {},
    ),
    /password rejected/,
  );
  assert.equal(marked, false);
});

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
  assert.match(passwordForm, /supabase\.auth\.updateUser\(\{ password: value \}\)/);
  assert.match(forgotPassword, /supabase\.auth\.resetPasswordForEmail/);
});

test("the normal portal layout still redirects users without a session", async () => {
  const source = await readFile(new URL("../routes/_app.tsx", import.meta.url), "utf8");
  assert.match(source, /if \(!data\.session\) throw redirect\(\{ to: "\/login" \}\)/);
});

test("setup migration grandfathers old profiles and gates new completion on a password", async () => {
  const sql = await readFile(
    new URL(
      "../../supabase/migrations/20260928184638_account_setup_lifecycle.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(sql, /account_setup_completed boolean not null default true/);
  assert.match(sql, /account_setup_completed set default false/);
  assert.match(sql, /nullif\(encrypted_password, ''\) is not null/);
  assert.match(
    sql,
    /grant update \(account_setup_completed\) on public\.profiles to authenticated/,
  );
});
