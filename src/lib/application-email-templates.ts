// Prince's November 7, 2026 attachments; preserve original source separately from personalized drafts.
export const EMAIL_SENDER = "info@justiceleagueglm.org";
export const TEMPLATE_REVISION = "prince-2026-11-07-v1";
export type EmailKind = "decision" | "recipient";
export const letterSources = {
  decision:
    "Dear Applicant,\n\nThank you for applying for the 2026 Business Growth Grant offered by the Justice League of Greater Lansing Michigan (JLGLM) through our Entrepreneurship Reparations pillar.\nWe received more than 40 applications from talented entrepreneurs and outstanding businesses throughout the Greater Lansing area. Due to the competitive nature of the process and limited grant funding, we regret to inform you that your business was not selected as a 2026 grant recipient.\nWe recognize the time and effort involved in applying and appreciate the opportunity to learn more about your business and its goals.\nJLGLM remains committed to supporting African American-owned businesses and expanding access to resources that promote business growth and sustainability. We encourage you to apply again when the Business Growth Grant reopens in Fall 2027.\nHere are some resources that may be able to assist you with your small business growth journey:\n· Lansing Economic Area Partnership\n· Lansing Economic Development Corp\n· Small Business Development Center\n· Lansing Regional Chamber of Commerce\n· Melanated Business Alliance\nThank you for your interest in JLGLM and your continued contributions to the Greater Lansing business community. We wish you success in your continued endeavors.\nYours in the struggle,\nPrince Solace, President\nPrince Solace\nWillye Bryan, Vice President\nWillye Bryan",
  recipient:
    "Dear Grant Recipient,\n\nOn behalf of the Justice League of Greater Lansing Michigan (JLGLM), congratulations on being selected as a recipient of the 2026 Business Growth Grant!\nYour selection recognizes your entrepreneurial vision, dedication, and commitment to business growth. We are proud to invest in your success and support your continued contributions to the Greater Lansing community.\nThrough our Entrepreneurship Reparations pillar, JLGLM established this grant to help address barriers to capital and expand opportunities for African American-owned businesses. We hope this investment provides meaningful support as you strengthen your operations, expand your capacity, and pursue new opportunities for growth.\nWe would also like to personally invite you to our 2026 Fall Celebration and Fundraiser on Friday, November 13, at 6:00 p.m. at Michigan State University Federal Credit Union. It would be our honor to publicly recognize and celebrate you as a 2026 Business Growth Grant recipient during this special occasion.\nYour success represents the impact of investing in Black-owned businesses and building stronger communities. We look forward to celebrating this achievement with you!\nCongratulations once again, and we hope you will join us!\n\nYours in the struggle,\nPrince Solace, President\nPrince Solace\nWillye Bryan, Vice President\nWillye Bryan",
};
export function applicationEmailTemplate(kind: EmailKind, name: string) {
  const greeting = name.trim() ? `Dear ${name.trim()},` : "[NEEDS CLIENT INPUT: applicant name]";
  return {
    subject:
      kind === "decision"
        ? "2026 Business Growth Grant – Application Decision"
        : "Congratulations! 2026 Business Growth Grant Recipient",
    body: letterSources[kind]
      .replace(/^Dear [^\n]+,/, greeting)
      .replace("Prince Solace, President\nPrince Solace", "Prince Solace, President")
      .replace("Willye Bryan, Vice President\nWillye Bryan", "Willye Bryan, Vice President")
      .replace(/([.!])\n(?=[A-Z])/g, "$1\n\n")
      .replace("· Melanated Business Alliance\n", "· Melanated Business Alliance\n\n"),
  };
}
export function validateApplicantEmail(subject: string, body: string) {
  if (!subject.trim() || subject.length > 160 || /[\r\n]/.test(subject))
    return "Enter a subject of 1–160 characters without line breaks.";
  if (!body.trim() || body.length > 20000) return "Enter an email body of 1–20,000 characters.";
  if (/\bdenial\b/i.test(subject + " " + body))
    return "Use application decision wording; remove the word denial.";
  if (/\[NEEDS|\[PLACEHOLDER|\{\{/i.test(subject + " " + body))
    return "Replace all placeholders before sending.";
  return null;
}
export type EmailEligibility = {
  recipient: boolean;
  finalized: boolean;
  notSelected: boolean;
  reviewComplete: boolean;
  email: string | null;
};
export function emailBlockedReason(state: EmailEligibility, kind: EmailKind) {
  if (
    !state.email ||
    !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(state.email)
  )
    return "A valid applicant email is required.";
  if (kind === "recipient")
    return state.recipient ? null : "Only finalized grant recipients may receive congratulations.";
  if (state.recipient) return "Grant recipients cannot receive a non-selection email.";
  if (!state.notSelected && !(state.reviewComplete && state.finalized))
    return "Complete all required reviews and finalize recipients, or explicitly record Not selected.";
  return null;
}
