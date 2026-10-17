export type EmailLinkPurpose = "invite" | "recovery";
export type EmailLinkType = "invite" | "recovery" | "email";
export type EmailLinkToken = { token_hash: string; type: EmailLinkType };
export type EmailCodeToken = { email: string; token: string; type: EmailLinkType };

export function readEmailLink(hash: string, purpose: EmailLinkPurpose): EmailLinkToken | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const token_hash = params.get("token_hash");
  if (token_hash === null) return null; // Legacy implicit/PKCE callback.
  const type = params.get("type");
  if (
    !token_hash ||
    token_hash.length > 1024 ||
    !/^[a-zA-Z0-9_-]+$/.test(token_hash) ||
    (purpose === "invite" ? type !== "invite" : type !== "recovery" && type !== "email")
  )
    throw new Error("This email link is invalid. Request a new password reset email.");
  return { token_hash, type: type as EmailLinkType };
}

export function emailCodeToken(
  email: string,
  token: string,
  purpose: EmailLinkPurpose,
  magicLink: boolean,
): EmailCodeToken {
  const normalizedEmail = email.trim();
  const normalizedToken = token.trim();
  if (!normalizedEmail || !/^\d{6,10}$/.test(normalizedToken))
    throw new Error("Enter your email address and the verification code from your email.");
  return {
    email: normalizedEmail,
    token: normalizedToken,
    type: purpose === "invite" ? "invite" : magicLink ? "email" : "recovery",
  };
}

// A verifier is invoked only by a user event, never by parsing or rendering a link.
export async function confirmEmailLink(
  token: EmailLinkToken | EmailCodeToken,
  verify: (token: EmailLinkToken | EmailCodeToken) => Promise<{
    data: { session: unknown };
    error: unknown;
  }>,
) {
  const result = await verify(token);
  if (result.error || !result.data.session)
    throw new Error(
      "This link or code is invalid, expired, or already used. Request a new reset email and try again.",
    );
}
