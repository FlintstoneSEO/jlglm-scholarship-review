export type GlobalRole = "admin" | "reviewer" | "viewer";
export type ProgramRole = "admin" | "reviewer" | "viewer";

export type Invitation = {
  firstName: string;
  lastName: string;
  email: string;
  globalRole: GlobalRole;
  programId: string;
  programRole: ProgramRole;
};

export function displayProfileName(profile: {
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
}) {
  const parts = [profile.first_name?.trim(), profile.last_name?.trim()].filter(Boolean);
  return parts.length === 2
    ? parts.join(" ")
    : profile.full_name?.trim() || parts.join(" ") || profile.email || "—";
}

export function canInviteUser(
  globalAdmin: boolean,
  programAdmin: boolean,
  selectedGlobalRole: GlobalRole,
) {
  return globalAdmin || (programAdmin && selectedGlobalRole === "viewer");
}

export function normalizeInvitation(input: Invitation): Invitation {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const email = input.email.trim().toLowerCase();
  if (!firstName || !lastName || firstName.length > 100 || lastName.length > 100)
    throw new Error("Enter a first and last name (up to 100 characters each).");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    throw new Error("Enter a valid email address.");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      input.programId,
    )
  )
    throw new Error("Choose a valid program.");
  if (
    !["admin", "reviewer", "viewer"].includes(input.globalRole) ||
    !["admin", "reviewer", "viewer"].includes(input.programRole)
  )
    throw new Error("Choose valid roles.");
  return { ...input, firstName, lastName, email };
}
