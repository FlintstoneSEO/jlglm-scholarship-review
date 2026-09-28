import { createFileRoute } from "@tanstack/react-router";
import { AuthPageShell } from "@/components/AuthPageShell";
import { PasswordSetupForm } from "@/components/PasswordSetupForm";

export const Route = createFileRoute("/accept-invite")({ component: AcceptInvitePage });

function AcceptInvitePage() {
  return (
    <AuthPageShell
      title="Complete Your Account"
      description="Welcome. Create a password to finish setting up your invited account."
    >
      <PasswordSetupForm purpose="invite" />
    </AuthPageShell>
  );
}
