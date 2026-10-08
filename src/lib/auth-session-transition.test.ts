import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldReloadAuthorization } from "./auth-session-transition.ts";

test("returning from an external tab keeps an existing user's workspace mounted", () => {
  assert.equal(shouldReloadAuthorization("SIGNED_IN", "admin-a", "admin-a"), false);
  assert.equal(shouldReloadAuthorization("TOKEN_REFRESHED", "admin-a", "admin-a"), false);
  assert.equal(shouldReloadAuthorization("USER_UPDATED", "admin-a", "admin-a"), false);
});

test("initial login, logout, and login again must load or clear authorization", () => {
  assert.equal(shouldReloadAuthorization("INITIAL_SESSION", null, "admin-a"), true);
  assert.equal(shouldReloadAuthorization("SIGNED_IN", null, "admin-a"), true);
  assert.equal(shouldReloadAuthorization("SIGNED_OUT", "admin-a", null), true);
  assert.equal(shouldReloadAuthorization("SIGNED_IN", null, "admin-a"), true);
});

test("an account change cannot retain the previous account's authorization", () => {
  for (const event of ["SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED"] as const) {
    assert.equal(shouldReloadAuthorization(event, "admin-a", "reviewer-b"), true);
    assert.equal(shouldReloadAuthorization(event, "admin-a", null), true);
    assert.equal(shouldReloadAuthorization(event, null, "reviewer-b"), true);
  }
});

test("password recovery still follows the existing authorization initialization path", () => {
  assert.equal(shouldReloadAuthorization("PASSWORD_RECOVERY", "admin-a", "admin-a"), true);
});
