import type { AppRole, ProgramAccessRole } from "./auth-context";

export type AccessRow = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  account_setup_completed: boolean;
  global_role: AppRole;
  program_id: string;
  program_name: string;
  access_role: ProgramAccessRole | null;
};

export type ManagedUser = Pick<AccessRow, "email" | "full_name" | "first_name" | "last_name"> & {
  id: string;
  accountSetupCompleted: boolean;
  globalRole: AppRole;
  programs: { id: string; name: string; role: ProgramAccessRole | null }[];
};

export function projectUserAccess(rows: AccessRow[]): ManagedUser[] {
  const users = new Map<string, ManagedUser>();
  for (const row of rows) {
    let user = users.get(row.user_id);
    if (!user) {
      user = {
        id: row.user_id,
        email: row.email,
        full_name: row.full_name,
        first_name: row.first_name,
        last_name: row.last_name,
        accountSetupCompleted: row.account_setup_completed,
        globalRole: row.global_role,
        programs: [],
      };
      users.set(row.user_id, user);
    }
    user.programs.push({ id: row.program_id, name: row.program_name, role: row.access_role });
  }
  return [...users.values()];
}

export const globalRoleLabel = (role: AppRole) =>
  ({ admin: "Admin", reviewer: "Reviewer", viewer: "Viewer" })[role];

export const programRoleLabel = (role: ProgramAccessRole | null, globalRole?: AppRole) =>
  role === null
    ? globalRole === "admin"
      ? "No program record · Global Admin"
      : "No Access"
    : { admin: "Program Admin", reviewer: "Reviewer", viewer: "Read-only Viewer" }[role];
