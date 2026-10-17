import assert from "node:assert/strict";
import { test } from "node:test";
import { readEmailLink, emailCodeToken, confirmEmailLink } from "./email-link-confirmation.ts";

test("prefetching a fragment never redeems a token, explicit confirmation does", async () => {
  let calls = 0;
  const token = readEmailLink("#token_hash=abc123&type=recovery", "recovery");
  assert.deepEqual(token, { token_hash: "abc123", type: "recovery" });
  for (let request = 0; request < 3; request++)
    readEmailLink("#token_hash=abc123&type=recovery", "recovery");
  assert.equal(calls, 0);
  await confirmEmailLink(token!, async (value) => {
    calls++;
    assert.deepEqual(value, token);
    return { data: { session: { user: { id: "reviewer" } } }, error: null };
  });
  assert.equal(calls, 1);
});

test("wrong route/type, malformed hash, and untrusted redirects cannot change verification", () => {
  for (const hash of [
    "#token_hash=abc&type=invite",
    "#token_hash=abc&type=signup",
    "#token_hash=abc&type=anything",
    "#token_hash=&type=recovery",
    "#token_hash=bad%20hash&type=recovery",
  ])
    assert.throws(() => readEmailLink(hash, "recovery"));
  assert.throws(() => readEmailLink("#token_hash=abc&type=recovery", "invite"));
  assert.deepEqual(
    readEmailLink("#token_hash=abc&type=recovery&redirect_to=https://evil.example", "recovery"),
    { token_hash: "abc", type: "recovery" },
  );
  assert.deepEqual(readEmailLink("#token_hash=abc&type=email", "recovery"), {
    token_hash: "abc",
    type: "email",
  });
  assert.deepEqual(readEmailLink("#token_hash=abc&type=invite", "invite"), {
    token_hash: "abc",
    type: "invite",
  });
});

test("legacy implicit callbacks and PKCE are left to existing session setup", () => {
  assert.equal(
    readEmailLink("#access_token=legacy&refresh_token=legacy&type=recovery", "recovery"),
    null,
  );
  assert.equal(readEmailLink("", "recovery"), null);
});

test("expired/reused tokens, server failures, and missing sessions never pass confirmation", async () => {
  const token = { token_hash: "abc", type: "recovery" } as const;
  for (const result of [
    { data: { session: null }, error: { code: "otp_expired" } },
    { data: { session: null }, error: null },
    { data: { session: {} }, error: { code: "unexpected_failure" } },
  ])
    await assert.rejects(
      confirmEmailLink(token, async () => result),
      /invalid, expired, or already used/,
    );
  await assert.rejects(
    confirmEmailLink(token, async () => {
      throw new Error("network unavailable");
    }),
    /network unavailable/,
  );
});

test("code fallback uses the matching recovery, invite, or magic email type", () => {
  assert.deepEqual(emailCodeToken(" reviewer@example.org ", " 123456 ", "recovery", false), {
    email: "reviewer@example.org",
    token: "123456",
    type: "recovery",
  });
  assert.equal(emailCodeToken("reviewer@example.org", "123456", "recovery", true).type, "email");
  assert.equal(emailCodeToken("reviewer@example.org", "123456", "invite", true).type, "invite");
  for (const code of ["", "12345", "12345678901", "abcdef", "12 3456"])
    assert.throws(() => emailCodeToken("reviewer@example.org", code, "recovery", false));
  assert.throws(() => emailCodeToken(" ", "123456", "recovery", false));
});
