import { createServerFn } from "@tanstack/react-start";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runInvitation } from "./invite-user-workflow";
import { normalizeInvitation, type Invitation } from "./user-management";
import { z } from "zod";

const invitationSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  globalRole: z.enum(["admin", "reviewer", "viewer"]),
  programId: z.string(),
  programRole: z.enum(["admin", "reviewer", "viewer"]),
});

export const invitePortalUser = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((input: Invitation) => normalizeInvitation(invitationSchema.parse(input)))
  .handler(async ({ data, context }) => {
    const caller = context.supabase;
    return runInvitation(data, {
      async isGlobalAdmin() {
        const { data: rows, error } = await caller
          .from("user_roles")
          .select("role")
          .eq("user_id", context.userId)
          .eq("role", "admin");
        if (error) throw new Error("Could not verify your access.");
        return (rows?.length ?? 0) > 0;
      },
      async isProgramAdmin(programId) {
        const { data: rows, error } = await caller
          .from("user_program_access")
          .select("id")
          .eq("user_id", context.userId)
          .eq("program_id", programId)
          .eq("access_role", "admin");
        if (error) throw new Error("Could not verify your access.");
        return (rows?.length ?? 0) > 0;
      },
      async programExists(programId) {
        const { data: program, error } = await caller
          .from("programs")
          .select("id")
          .eq("id", programId)
          .eq("active", true)
          .maybeSingle();
        if (error) throw new Error("Could not verify the selected program.");
        return !!program;
      },
      async invite(input) {
        const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
          input.email,
          {
            data: {
              first_name: input.firstName,
              last_name: input.lastName,
              full_name: `${input.firstName} ${input.lastName}`,
            },
          },
        );
        if (error) {
          if (error.code === "email_exists" || /already|exists|registered/i.test(error.message))
            throw new Error(
              "This email already has an account. Update its program access in the user list.",
            );
          console.error("Auth invitation failed", error);
          throw new Error("The invitation could not be sent. Please try again.");
        }
        if (!invited.user?.id) throw new Error("The invitation did not return a user.");
        return invited.user.id;
      },
      async saveProfile(userId, input) {
        const { error } = await supabaseAdmin.from("profiles").upsert({
          id: userId,
          email: input.email,
          first_name: input.firstName,
          last_name: input.lastName,
          full_name: `${input.firstName} ${input.lastName}`,
        });
        if (error) throw error;
      },
      async setGlobalRole(userId, role) {
        const { error: deleteError } = await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .neq("role", role);
        if (deleteError) throw deleteError;
        const { error } = await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
        if (error) throw error;
      },
      async setProgramRole(userId, programId, role) {
        const { error } = await supabaseAdmin
          .from("user_program_access")
          .upsert(
            { user_id: userId, program_id: programId, access_role: role },
            { onConflict: "user_id,program_id" },
          );
        if (error) throw error;
      },
      async removeInvitedUser(userId) {
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (error) throw error;
      },
    });
  });
