import {
  canInviteUser,
  normalizeInvitation,
  type GlobalRole,
  type Invitation,
  type ProgramRole,
} from "./user-management.ts";

export interface InvitationPort {
  isGlobalAdmin(): Promise<boolean>;
  isProgramAdmin(programId: string): Promise<boolean>;
  programExists(programId: string): Promise<boolean>;
  invite(input: Invitation): Promise<string>;
  saveProfile(userId: string, input: Invitation): Promise<void>;
  setGlobalRole(userId: string, role: GlobalRole): Promise<void>;
  setProgramRole(userId: string, programId: string, role: ProgramRole): Promise<void>;
  removeInvitedUser(userId: string): Promise<void>;
}

export async function runInvitation(rawInput: Invitation, port: InvitationPort) {
  const input = normalizeInvitation(rawInput);
  const [globalAdmin, programAdmin, programExists] = await Promise.all([
    port.isGlobalAdmin(),
    port.isProgramAdmin(input.programId),
    port.programExists(input.programId),
  ]);
  if (!programExists) throw new Error("Choose an available program.");
  if (!canInviteUser(globalAdmin, programAdmin, input.globalRole))
    throw new Error("You are not allowed to invite a user with that access.");

  const userId = await port.invite(input);
  try {
    await port.saveProfile(userId, input);
    await port.setGlobalRole(userId, input.globalRole);
    await port.setProgramRole(userId, input.programId, input.programRole);
  } catch (error) {
    try {
      await port.removeInvitedUser(userId);
    } catch (rollbackError) {
      console.error("Invitation rollback failed", rollbackError);
    }
    console.error("Invitation setup failed", error);
    throw new Error("The invitation could not be completed. Check the user list before retrying.");
  }
  return { userId };
}
