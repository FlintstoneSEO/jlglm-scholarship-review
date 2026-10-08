import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AuthPageShell } from "@/components/AuthPageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { authRedirectUrl, browserAppUrl } from "@/lib/auth-lifecycle";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPasswordPage });

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const redirectTo = authRedirectUrl(browserAppUrl(), "/reset-password");
      const { error: requestError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (requestError) throw requestError;
      setSent(true);
    } catch (requestError) {
      setError(
        (requestError as Error).message ||
          "The recovery request could not be sent. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthPageShell
      title="Forgot Your Password?"
      description="Enter your email address to request a secure reset link."
    >
      {sent ? (
        <p className="mt-6 rounded-md bg-muted p-4 text-sm" role="status">
          If an account exists for that email address, a password reset link has been sent. Check
          your inbox and spam folder.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="recovery-email">Email</Label>
            <Input
              id="recovery-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Sending reset link…" : "Send Reset Link"}
          </Button>
        </form>
      )}
    </AuthPageShell>
  );
}
