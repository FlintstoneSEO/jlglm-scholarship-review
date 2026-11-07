import { EMAIL_SENDER, validateApplicantEmail } from "./application-email-templates.ts";

export type EmailPayload = { id: string; recipient: string; subject: string; body: string };
export type DeliveryOutcome = {
  status: "accepted" | "failed" | "unknown";
  providerId: string | null;
  message: string | null;
};

export function gmailRawMessage(email: EmailPayload) {
  const issue = validateApplicantEmail(email.subject, email.body);
  if (issue) throw new Error(issue);
  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email.recipient))
    throw new Error("Invalid recipient");
  if (!/^[a-f0-9-]{36}$/i.test(email.id)) throw new Error("Invalid message ID");
  // Encode subject and body, so user-edited text can never inject MIME headers.
  const subject = Array.from(email.subject)
    .reduce<string[]>((parts, char) => {
      if (!parts.length || Buffer.byteLength(parts[parts.length - 1] + char, "utf8") > 42)
        parts.push(char);
      else parts[parts.length - 1] += char;
      return parts;
    }, [])
    .map((part) => `=?UTF-8?B?${Buffer.from(part).toString("base64")}?=`)
    .join("\r\n ");
  return Buffer.from(
    [
      `From: Justice League of Greater Lansing Michigan <${EMAIL_SENDER}>`,
      `Reply-To: ${EMAIL_SENDER}`,
      `To: ${email.recipient}`,
      `Subject: ${subject}`,
      `Message-ID: <${email.id}@justiceleagueglm.org>`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(email.body.replace(/\r?\n/g, "\r\n"))
        .toString("base64")
        .match(/.{1,76}/g)!
        .join("\r\n"),
    ].join("\r\n"),
  ).toString("base64url");
}

export async function sendGmailMessage(
  email: EmailPayload,
  accessToken: string,
  request: typeof fetch = fetch,
): Promise<DeliveryOutcome> {
  const raw = gmailRawMessage(email);
  try {
    // Named mailbox prevents credentials for another Google account sending as this organization.
    const response = await request(
      `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(EMAIL_SENDER)}/messages/send`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ raw }),
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!response.ok) {
      const definitelyRejected = [400, 401, 403, 404, 413, 422].includes(response.status);
      return {
        status: definitelyRejected ? "failed" : "unknown",
        providerId: null,
        message: definitelyRejected
          ? "Gmail rejected this email. Check mailbox configuration before retrying."
          : "Gmail acceptance is uncertain. Check the mailbox before retrying.",
      };
    }
    const result = await response.json();
    if (typeof result.id !== "string" || !result.id) throw new Error("Missing provider receipt");
    return { status: "accepted", providerId: result.id, message: null };
  } catch {
    return {
      status: "unknown",
      providerId: null,
      message: "The send outcome is unknown. Check the mailbox before retrying.",
    };
  }
}

export async function deliverReservedEmail(
  email: EmailPayload,
  deps: {
    claim: () => Promise<boolean>;
    send: (email: EmailPayload) => Promise<DeliveryOutcome>;
    record: (outcome: DeliveryOutcome) => Promise<void>;
  },
): Promise<DeliveryOutcome> {
  if (!(await deps.claim()))
    throw new Error("This email is already being processed. Reload its history.");
  let outcome: DeliveryOutcome;
  try {
    outcome = await deps.send(email);
  } catch {
    outcome = {
      status: "unknown",
      providerId: null,
      message: "Send outcome unknown; reconcile before retrying.",
    };
  }
  try {
    await deps.record(outcome);
  } catch {
    throw new Error(
      "Could not record the send outcome. Do not resend; reconcile the pending email in history.",
    );
  }
  return outcome;
}
