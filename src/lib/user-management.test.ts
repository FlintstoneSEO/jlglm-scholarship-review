import assert from "node:assert/strict";
import { test } from "node:test";
import { displayProfileName, normalizeInvitation, type Invitation } from "./user-management.ts";
import { runInvitation, type InvitationPort } from "./invite-user-workflow.ts";

const input: Invitation = {
  firstName: " Ada ",
  lastName: " Lovelace ",
  email: " Ada@Example.com ",
  globalRole: "viewer",
  programId: "11111111-1111-4111-8111-111111111111",
  programRole: "reviewer",
};

function port(overrides: Partial<InvitationPort> = {}) {
  const calls: string[] = [];
  const implementation: InvitationPort = {
    isGlobalAdmin: async () => false,
    isProgramAdmin: async () => true,
    programExists: async () => true,
    invite: async (invite) => {
      calls.push(`invite:${invite.email}`);
      return "new-user";
    },
    saveProfile: async (_id, invite) => {
      calls.push(`profile:${invite.firstName} ${invite.lastName}`);
    },
    setGlobalRole: async (_id, role) => {
      calls.push(`global:${role}`);
    },
    setProgramRole: async (_id, programId, role) => {
      calls.push(`program:${programId}:${role}`);
    },
    removeInvitedUser: async () => {
      calls.push("rollback");
    },
    ...overrides,
  };
  return { calls, implementation };
}

test("name fields normalize and existing profiles still render", () => {
  assert.equal(normalizeInvitation(input).firstName, "Ada");
  assert.equal(
    displayProfileName({ first_name: "Ada", last_name: "Lovelace", full_name: "Old", email: null }),
    "Ada Lovelace",
  );
  assert.equal(
    displayProfileName({
      first_name: null,
      last_name: null,
      full_name: "Legacy Name",
      email: null,
    }),
    "Legacy Name",
  );
  assert.equal(
    displayProfileName({
      first_name: "Incomplete",
      last_name: null,
      full_name: "Legacy Name",
      email: null,
    }),
    "Legacy Name",
  );
});

test("authorized program admin invites with viewer global role and selected program role", async () => {
  const mock = port();
  assert.deepEqual(await runInvitation(input, mock.implementation), { userId: "new-user" });
  assert.deepEqual(mock.calls, [
    "invite:ada@example.com",
    "profile:Ada Lovelace",
    "global:viewer",
    `program:${input.programId}:reviewer`,
  ]);
});

test("reviewers and viewers cannot invite; program admins cannot grant global roles", async () => {
  const unauthorized = port({ isProgramAdmin: async () => false });
  await assert.rejects(runInvitation(input, unauthorized.implementation), /not allowed/);
  assert.deepEqual(unauthorized.calls, []);
  const escalation = port();
  await assert.rejects(
    runInvitation({ ...input, globalRole: "admin" }, escalation.implementation),
    /not allowed/,
  );
  assert.deepEqual(escalation.calls, []);
});

test("global admins may assign a global role", async () => {
  const mock = port({ isGlobalAdmin: async () => true, isProgramAdmin: async () => false });
  await runInvitation({ ...input, globalRole: "reviewer" }, mock.implementation);
  assert.ok(mock.calls.includes("global:reviewer"));
});

test("existing email errors do not modify an existing account", async () => {
  const mock = port({
    invite: async () => {
      throw new Error("This email already has an account.");
    },
  });
  await assert.rejects(runInvitation(input, mock.implementation), /already has an account/);
  assert.deepEqual(mock.calls, []);
});

test("failed access setup removes only the newly invited user", async () => {
  const mock = port({
    setProgramRole: async () => {
      throw new Error("database failure");
    },
  });
  await assert.rejects(runInvitation(input, mock.implementation), /could not be completed/);
  assert.equal(mock.calls.at(-1), "rollback");
});
