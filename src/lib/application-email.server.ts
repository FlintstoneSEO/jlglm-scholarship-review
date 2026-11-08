import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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
