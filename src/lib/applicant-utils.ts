import type { Database } from "@/integrations/supabase/types";

export type Applicant = Database["public"]["Tables"]["applicants"]["Row"];
export type Review = Database["public"]["Tables"]["reviews"]["Row"];
export type ApplicantNote = Database["public"]["Tables"]["applicant_notes"]["Row"];
export type ContactLog = Database["public"]["Tables"]["contact_logs"]["Row"];

export function fullName(a: Pick<Applicant, "first_name" | "last_name">) {
  return `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim();
}

export function missingItems(a: Applicant): string[] {
  const m: string[] = [];
  if (!a.has_essay) m.push("Essay");
  if (!a.has_transcript) m.push("Transcript");
  if (!a.applicant_signature_status) m.push("Applicant signature");
  if (a.is_18_or_older === false && !a.guardian_signature_status) m.push("Guardian signature");
  return m;
}

export function isComplete(a: Applicant) {
  return missingItems(a).length === 0;
}

export function statusLabel(s: Applicant["application_status"]): string {
  return ({
    submitted: "Submitted",
    complete: "Complete",
    incomplete: "Incomplete",
    finalist: "Finalist",
    selected: "Selected",
    not_selected: "Not Selected",
    withdrawn: "Withdrawn",
  } as const)[s];
}

export function reviewStatusLabel(s: Applicant["review_status"]): string {
  return ({
    not_started: "Not Started",
    in_progress: "In Progress",
    reviewed: "Reviewed",
    needs_discussion: "Needs Discussion",
    follow_up: "Follow-Up",
  } as const)[s];
}

export function recommendationLabel(r: string | null | undefined): string {
  if (!r) return "—";
  return ({
    strongly_recommend: "Strongly Recommend",
    recommend: "Recommend",
    consider: "Consider",
    needs_discussion: "Needs Discussion",
    do_not_recommend: "Do Not Recommend",
  } as Record<string, string>)[r] ?? r;
}

export const EMAIL_TEMPLATES = [
  {
    id: "missing_docs",
    name: "Missing document request",
    subject: "Action needed: Missing documents for your scholarship application",
    body: `Hello {{first_name}},

Thank you for applying to the Justice League of Greater Lansing 2026 Reparations Scholarship. While reviewing your application, our committee noticed the following items are missing:

{{missing_items}}

Please submit these materials at your earliest convenience so we can complete your review.

Sincerely,
JLGL Scholarship Committee`,
  },
  {
    id: "finalist",
    name: "Finalist notification",
    subject: "Congratulations — You are a 2026 Reparations Scholarship Finalist",
    body: `Dear {{first_name}},

Congratulations! After a thorough review of your application, the Justice League of Greater Lansing Scholarship Committee has selected you as a finalist for the 2026 Reparations Scholarship.

We will be in touch with next steps shortly.

In community,
JLGL Scholarship Committee`,
  },
  {
    id: "selected",
    name: "Selected recipient notification",
    subject: "You have been selected for the 2026 Reparations Scholarship",
    body: `Dear {{first_name}},

It is our great honor to inform you that you have been selected as a recipient of the 2026 Justice League of Greater Lansing Reparations Scholarship.

Your essay and dedication to your educational journey moved our committee deeply. We will reach out with details on disbursement and the recognition ceremony.

With pride and admiration,
JLGL Scholarship Committee`,
  },
  {
    id: "not_selected",
    name: "Not selected notification",
    subject: "Update on your 2026 Reparations Scholarship application",
    body: `Dear {{first_name}},

Thank you for applying to the 2026 Justice League of Greater Lansing Reparations Scholarship. This year we received many strong applications and were unable to select every applicant.

We were grateful to read your story and we encourage you to keep pursuing your educational goals. Please keep in touch with our community.

In solidarity,
JLGL Scholarship Committee`,
  },
  {
    id: "follow_up",
    name: "General follow-up",
    subject: "Following up on your scholarship application",
    body: `Hello {{first_name}},

We are following up regarding your 2026 Reparations Scholarship application. Please let us know if you have any questions for the committee.

Best,
JLGL Scholarship Committee`,
  },
];

export function renderTemplate(body: string, applicant: Applicant): string {
  return body
    .replaceAll("{{first_name}}", applicant.first_name ?? "")
    .replaceAll("{{last_name}}", applicant.last_name ?? "")
    .replaceAll("{{missing_items}}", missingItems(applicant).map((i) => `• ${i}`).join("\n") || "—");
}
