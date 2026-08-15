import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listApplicants from "./tools/list-applicants";
import getApplicant from "./tools/get-applicant";
import submitReview from "./tools/submit-review";
import addApplicantNote from "./tools/add-applicant-note";
import reviewProgress from "./tools/review-progress";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "jlglm-scholarship-review",
  title: "JLGLM Scholarship Review",
  version: "0.1.0",
  instructions:
    "Tools for the Justice League of Greater Lansing 2026 Reparations Scholarship review portal. Read applicants, check missing documents, submit Writing/Rhetoric reviewer scores (0-9 each), add committee notes, and summarize review progress. Never decide scholarship recipients: final selection is made by the Justice League scholarship committee.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listApplicants, getApplicant, submitReview, addApplicantNote, reviewProgress],
});
