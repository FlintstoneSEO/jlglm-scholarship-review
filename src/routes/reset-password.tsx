import { createFileRoute } from "@tanstack/react-router";
import { AuthPageShell } from "@/components/AuthPageShell";
import { PasswordSetupForm } from "@/components/PasswordSetupForm";

export const Route = createFileRoute("/reset-password")({ component: ResetPasswordPage });

function ResetPasswordPage() {
  return (
    <AuthPageShell
      title="Reset Your Password"
      description="Choose a new password for your portal account."
    >
      <PasswordSetupForm purpose="recovery" />
    </AuthPageShell>
  );
}
