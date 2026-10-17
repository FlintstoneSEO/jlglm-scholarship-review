import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  confirmEmailLink,
  emailCodeToken,
  readEmailLink,
  type EmailLinkPurpose,
  type EmailLinkToken,
  type EmailCodeToken,
} from "@/lib/email-link-confirmation";
import { PasswordSetupForm } from "@/components/PasswordSetupForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function EmailLinkConfirmation({ purpose }: { purpose: EmailLinkPurpose }) {
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState<EmailLinkToken | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [magicLink, setMagicLink] = useState(false);

  useEffect(() => {
    try {
      setPending(readEmailLink(window.location.hash, purpose));
    } catch (cause) {
      setInvalid(true);
      setError((cause as Error).message);
    }
    setReady(true);
  }, [purpose]);

  async function verify(token: EmailLinkToken | EmailCodeToken) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await confirmEmailLink(token, (value) => supabase.auth.verifyOtp(value));
      // Remove credentials and stale errors without navigating or logging the URL.
      const clean = new URL(window.location.href);
      clean.hash = "";
      for (const name of ["code", "error", "error_code", "error_description"])
        clean.searchParams.delete(name);
      window.history.replaceState(window.history.state, "", clean.pathname + clean.search);
      setCode("");
      setPending(null);
      setInvalid(false);
      setVerified(true);
    } catch (cause) {
      setError((cause as Error).message || "Could not verify your email. Please try again.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function submitCode(event: React.FormEvent) {
    event.preventDefault();
    try {
      void verify(emailCodeToken(email, code, purpose, magicLink));
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  if (!ready)
    return (
      <p className="mt-6 text-sm" role="status">
        Preparing your secure link…
      </p>
    );
  if (verified) return <PasswordSetupForm purpose={purpose} />;

  return (
    <>
      {pending ? (
        <div className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            {purpose === "invite"
              ? "Continue to verify your invitation and create your password."
              : "Continue to verify your email and choose a new password."}
          </p>
          <Button className="w-full" disabled={busy} onClick={() => void verify(pending)}>
            {busy
              ? "Verifying…"
              : purpose === "invite"
                ? "Continue to account setup"
                : "Continue to reset password"}
          </Button>
        </div>
      ) : !invalid ? (
        <PasswordSetupForm purpose={purpose} />
      ) : null}
      {error ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <details className="mt-6">
        <summary className="cursor-pointer text-sm font-medium text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
          Use the verification code from your email
        </summary>
        <form onSubmit={submitCode} className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter the code and email address from your latest email. Request a new reset email if
            yours does not include a code.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="verification-email">Email</Label>
            <Input
              id="verification-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="verification-code">Verification code</Label>
            <Input
              id="verification-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,10}"
              minLength={6}
              maxLength={10}
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </div>
          {purpose === "recovery" ? (
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={magicLink}
                onChange={(event) => setMagicLink(event.target.checked)}
              />
              This code came from a magic sign-in email
            </label>
          ) : null}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Verifying…" : "Verify code"}
          </Button>
        </form>
      </details>
      {pending || invalid ? (
        <p className="mt-4 text-sm">
          <Link to="/forgot-password" className="font-medium text-primary hover:underline">
            Request a new reset email
          </Link>
        </p>
      ) : null}
    </>
  );
}
