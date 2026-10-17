import { createFileRoute } from "@tanstack/react-router";
import { AuthPageShell } from "@/components/AuthPageShell";
import { EmailLinkConfirmation } from "@/components/EmailLinkConfirmation";

export const Route = createFileRoute("/accept-invite")({ component: AcceptInvitePage });

function AcceptInvitePage() {
  return (
    <AuthPageShell
      title="Complete Your Account"
      description="Welcome. Create a password to finish setting up your invited account."
    >
      <EmailLinkConfirmation purpose="invite" />
    </AuthPageShell>
  );
}
