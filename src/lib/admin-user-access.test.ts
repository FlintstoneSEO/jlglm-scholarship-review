import assert from "node:assert/strict";
import { test } from "node:test";
import {
  globalRoleLabel,
  programRoleLabel,
  projectUserAccess,
  type AccessRow,
} from "./admin-user-access.ts";

const base: AccessRow = {
  user_id: "user-a",
  email: "reviewer@example.invalid",
  full_name: "Reviewer A",
  first_name: "Reviewer",
  last_name: "A",
  account_setup_completed: false,
  global_role: "reviewer",
  program_id: "scholarship",
  program_name: "Educational Scholarship",
  access_role: "reviewer",
};

test("one user retains distinct global role, setup state, and every program access", () => {
  const [user] = projectUserAccess([
    base,
    { ...base, program_id: "grant", program_name: "Business Growth Grant", access_role: null },
  ]);
  assert.equal(user.globalRole, "reviewer");
  assert.equal(user.accountSetupCompleted, false);
  assert.deepEqual(
    user.programs.map((program) => programRoleLabel(program.role)),
    ["Reviewer", "No Access"],
  );
  assert.equal(globalRoleLabel(user.globalRole), "Reviewer");
});

test("changing one projected program row leaves another user's and program's roles separate", () => {
  const rows: AccessRow[] = [
    base,
    { ...base, program_id: "grant", program_name: "Business Growth Grant", access_role: "admin" },
    {
      ...base,
      user_id: "user-b",
      email: "viewer@example.invalid",
      global_role: "viewer",
      access_role: null,
    },
  ];
  const users = projectUserAccess(rows);
  assert.equal(users.length, 2);
  assert.equal(users[0].programs[0].role, "reviewer");
  assert.equal(users[0].programs[1].role, "admin");
  assert.equal(users[1].globalRole, "viewer");
  assert.equal(users[1].programs[0].role, null);
});

test("completed setup projects as active", () => {
  const [user] = projectUserAccess([{ ...base, account_setup_completed: true }]);
  assert.equal(user.accountSetupCompleted, true);
});

test("global admin without a membership still has portal-wide admin access", () => {
  assert.equal(programRoleLabel(null, "admin"), "No program record · Global Admin");
});
