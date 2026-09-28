import { useEffect, useState } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { validateNewPassword, authLinkError, finishInviteSetup } from "@/lib/auth-lifecycle";
import { completeAccountSetup, readAccountSetupCompleted } from "@/lib/account-setup";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Purpose = "invite" | "recovery";

function invalidMessage(purpose: Purpose) {
  return purpose === "invite"
    ? "This invitation link is invalid or has expired. Ask a Justice League administrator for a new invitation."
    : "This password recovery link is invalid or has expired. Request a new link from the sign-in page.";
}

export function PasswordSetupForm({ purpose }: { purpose: Purpose }) {
  const navigate = useNavigate();
  const router = useRouter();
  const { refreshAccountSetup } = useAuth();
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [setupChecking, setSetupChecking] = useState(purpose === "invite");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [alreadySetup, setAlreadySetup] = useState(false);
  const [setupReadFailed, setSetupReadFailed] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);

  useEffect(() => {
    let active = true;
    const linkedError = authLinkError(window.location);
    if (linkedError) setError(linkedError);

    const applySession = (_event: AuthChangeEvent, next: Session | null) => {
      if (!active) return;
      if (next) {
        setSession(next);
        if (purpose === "invite")
          void readAccountSetupCompleted(next.user.id)
            .then((setup) => {
              if (active) setAlreadySetup(setup === true);
            })
            .catch(() => {
              if (active) setSetupReadFailed(true);
            })
            .finally(() => {
              if (active) setSetupChecking(false);
            });
      }
      setChecking(false);
    };
    const { data: listener } = supabase.auth.onAuthStateChange(applySession);

    async function establishSession() {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session) {
        applySession("INITIAL_SESSION", data.session);
        return;
      }
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { data: exchanged, error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);
        if (!active) return;
        if (exchangeError) setError(invalidMessage(purpose));
        else applySession("SIGNED_IN", exchanged.session);
      }
      if (!data.session && !code) setSetupChecking(false);
      setChecking(false);
    }
    void establishSession();
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [purpose]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const validationError = passwordSaved ? null : validateNewPassword(password, confirmation);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!session) {
      setError(invalidMessage(purpose));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updatePassword = async (value: string) => {
        const { error: updateError } = await supabase.auth.updateUser({ password: value });
        if (updateError) throw updateError;
      };
      if (purpose === "invite") {
        await finishInviteSetup(
          password,
          passwordSaved,
          updatePassword,
          () => completeAccountSetup(session.user.id),
          () => setPasswordSaved(true),
        );
        await refreshAccountSetup();
        await router.invalidate();
      } else {
        await updatePassword(password);
      }
      setComplete(true);
      if (purpose === "invite") void navigate({ to: "/" });
    } catch (cause) {
      setError(
        (cause as Error).message ||
          "Your password or account setup could not be saved. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (checking || (session && setupChecking))
    return (
      <p className="mt-6 text-sm text-muted-foreground" role="status">
        Verifying your secure link…
      </p>
    );
  if (complete)
    return (
      <div className="mt-6 space-y-4" role="status">
        <p className="rounded-md bg-muted p-4 text-sm">
          Your password has been updated successfully.
        </p>
        <Button className="w-full" onClick={() => navigate({ to: "/" })}>
          Continue to the portal
        </Button>
      </div>
    );
  if (purpose === "invite" && alreadySetup)
    return (
      <div className="mt-6 space-y-4" role="status">
        <p className="rounded-md bg-muted p-4 text-sm">Your account is already set up.</p>
        <Button className="w-full" onClick={() => navigate({ to: "/" })}>
          Continue to the portal
        </Button>
      </div>
    );
  if (purpose === "invite" && setupReadFailed)
    return (
      <div className="mt-6 space-y-4">
        <p className="text-sm text-destructive" role="alert">
          Could not verify account setup. Please try again.
        </p>
        <Button className="w-full" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </div>
    );
  if (!session)
    return (
      <p
        className="mt-6 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
        role="alert"
      >
        {error || invalidMessage(purpose)}
      </p>
    );

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      {passwordSaved ? <p role="status">Password saved. Retry account setup to continue.</p> : null}
      {!passwordSaved && (
        <>
          <p className="text-sm text-muted-foreground">
            Use at least 8 characters. A longer, unique password is recommended.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor={`${purpose}-password`}>New Password</Label>
            <Input
              id={`${purpose}-password`}
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${purpose}-confirmation`}>Confirm Password</Label>
            <Input
              id={`${purpose}-confirmation`}
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </div>
        </>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy
          ? "Saving…"
          : passwordSaved
            ? "Retry setup"
            : purpose === "invite"
              ? "Create Password & Continue"
              : "Update Password"}
      </Button>
    </form>
  );
}
