import type { AuthChangeEvent } from "@supabase/supabase-js";

// Session recovery can emit SIGNED_IN when an existing user returns to a tab.
// Updating that session must not remove the mounted review workspace.
export function shouldReloadAuthorization(
  event: AuthChangeEvent,
  previousUserId: string | null,
  nextUserId: string | null,
): boolean {
  if (
    previousUserId !== null &&
    previousUserId === nextUserId &&
    (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED")
  )
    return false;
  return true;
}
