import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { applicationEmailWorkspaceSchema } from "./application-email-schema";
import { validateApplicantEmail } from "./application-email-templates";
import { deliverReservedEmail, sendGmailMessage } from "./application-email-delivery";
import decisionSource from "./letter-sources/decision.base64?raw";
import recipientSource from "./letter-sources/recipient.base64?raw";

export const downloadApplicantLetter = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((input: { applicationId: string; kind: "decision" | "recipient" }) =>
    z
      .object({ applicationId: z.string().uuid(), kind: z.enum(["decision", "recipient"]) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const result = await context.supabase.rpc("application_email_workspace", {
      p_application: data.applicationId,
    });
    if (result.error) throw new Error(result.error.message);
    return {
      base64: data.kind === "decision" ? decisionSource : recipientSource,
      filename:
        data.kind === "decision"
          ? "Application Decision Letter.docx"
          : "Congratulations Letter.docx",
    };
  });

function deliveryConfigured() {
  return (
    process.env.APPLICANT_EMAIL_ENABLED === "true" &&
    [
      "APPLICANT_GMAIL_CLIENT_ID",
      "APPLICANT_GMAIL_CLIENT_SECRET",
      "APPLICANT_GMAIL_REFRESH_TOKEN",
    ].every((key) => !!process.env[key])
  );
}
async function accessToken() {
  if (!deliveryConfigured())
    throw new Error("Applicant email sending is not configured. Contact the portal administrator.");
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: process.env.APPLICANT_GMAIL_CLIENT_ID!,
        client_secret: process.env.APPLICANT_GMAIL_CLIENT_SECRET!,
        refresh_token: process.env.APPLICANT_GMAIL_REFRESH_TOKEN!,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error();
    const token = await response.json();
    if (typeof token.access_token !== "string" || !token.access_token) throw new Error();
    return token.access_token as string;
  } catch {
    throw new Error("Could not authorize the Justice League mailbox. No email was sent.");
  }
}
export const applicantEmailConfiguration = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((input: { applicationId: string }) =>
    z.object({ applicationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const result = await context.supabase.rpc("application_email_workspace", {
      p_application: data.applicationId,
    });
    if (result.error) throw new Error(result.error.message);
    return { configured: deliveryConfigured() };
  });

const sendSchema = z.object({
  id: z.string().uuid(),
  applicationId: z.string().uuid(),
  fingerprint: z.string().length(32),
  kind: z.enum(["decision", "recipient"]),
  subject: z.string().min(1).max(160),
  body: z.string().min(1).max(20000),
  nonSelectionConfirmed: z.boolean(),
  phoneContactConfirmed: z.boolean(),
});
export const sendApplicantEmail = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((input: z.infer<typeof sendSchema>) => sendSchema.parse(input))
  .handler(async ({ data, context }) => {
    const issue = validateApplicantEmail(data.subject, data.body);
    if (issue) throw new Error(issue);
    // Authorize through the caller's database identity BEFORE accessing provider credentials.
    const workspace = await context.supabase.rpc("application_email_workspace", {
      p_application: data.applicationId,
    });
    if (workspace.error) throw new Error(workspace.error.message);
    const state = applicationEmailWorkspaceSchema.parse(workspace.data);
    if (state.fingerprint !== data.fingerprint)
      throw new Error("Application changed. Reload and preview again.");
    const token = await accessToken();
    const reservation = await context.supabase.rpc("reserve_application_email", {
      p_id: data.id,
      p_application: data.applicationId,
      p_fingerprint: data.fingerprint,
      p_kind: data.kind,
      p_subject: data.subject,
      p_body: data.body,
      p_non_selection_confirmed: data.nonSelectionConfirmed,
      p_phone_contact_confirmed: data.phoneContactConfirmed,
    });
    if (reservation.error)
      throw new Error(
        reservation.error.code === "23505"
          ? "An email already exists for this applicant. Reload the send history."
          : reservation.error.message,
      );
    return deliverReservedEmail(
      { id: data.id, recipient: state.email!, subject: data.subject, body: data.body },
      {
        claim: async () => {
          const result = await supabaseAdmin
            .from("application_emails")
            .update({ status: "sending", updated_at: new Date().toISOString() })
            .eq("id", data.id)
            .eq("actor_id", context.userId)
            .eq("status", "reserved")
            .select("id");
          if (result.error) throw new Error("Could not start delivery. Reload the email history.");
          return result.data.length === 1;
        },
        send: (email) => sendGmailMessage(email, token),
        record: async (outcome) => {
          const result = await supabaseAdmin
            .from("application_emails")
            .update({
              status: outcome.status,
              provider_id: outcome.providerId,
              error_message: outcome.message,
              updated_at: new Date().toISOString(),
            })
            .eq("id", data.id)
            .eq("status", "sending")
            .select("id");
          if (result.error || result.data.length !== 1)
            throw new Error("Could not record delivery");
        },
      },
    );
  });
