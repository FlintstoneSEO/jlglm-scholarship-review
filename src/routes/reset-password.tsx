import { createFileRoute } from "@tanstack/react-router";
import { AuthPageShell } from "@/components/AuthPageShell";
import { EmailLinkConfirmation } from "@/components/EmailLinkConfirmation";

export const Route = createFileRoute("/reset-password")({ component: ResetPasswordPage });

function ResetPasswordPage() {
  return (
    <AuthPageShell
      title="Reset Your Password"
      description="Choose a new password for your portal account."
    >
      <EmailLinkConfirmation purpose="recovery" />
    </AuthPageShell>
  );
}
