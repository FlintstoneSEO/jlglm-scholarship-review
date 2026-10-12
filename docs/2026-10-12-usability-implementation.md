# October 12 incremental usability specification

Preserve the Phase E shell, tokens, typography and Lucide. This is focused workflow improvement under the authorized handoff, not Phase F. Supplemental Apple references read: cross-platform, accessibility, layout, typography, color, feedback, entering-data and writing. Apply feedback and foundation principles only; native point-size and platform conventions are not web requirements.

## 1. Explicit saving and departure

Grant stores its draft in the route; Scholarship stores it inside ScoringPanel, which currently unmounts when its tab changes. Both use the canonical program-specific write adapters. Share a browser/router departure guard and save-status presentation, retain visited workspace panels, and key Scholarship workspace by application identity. Block external departure for dirty inputs or pending writes; internal section changes retain input. A pending write cannot be abandoned through router navigation. Reload/close use the browser's own warning (browser support/user interaction limits apply). No autosave or local storage of private review data.

States: unchanged, unsaved, saving/submitting, persisted draft/final, failed with input retained. A rejected write must not clear dirty state. Disable input during writes; retain dirty Grant input on background refresh. Save draft clears certification because certification belongs to final submission. Keep explicit actions and canonical validation.

## 2–4. Work state, refresh and honest progress

Compare both queue projections: Scholarship retains its fixed five-reviewer aggregate semantics; Grant uses assignment-based coverage, but ordinary reviewers see only their own assignment/review rows through RLS. Add personal conflict status using the existing reports SELECT boundary, explicitly filtering caller identity. Active assignments only; replaced/suspended history is not active work. Missing supporting reads mean unknown, never ready. Dashboard and Applications consume the same identity/scope query and personal work projection; use 30-second foreground polling and focus revalidation on these surfaces only, plus explicit Refresh/error feedback. Invalidate these queries on local writes. Do not refresh auth or remount dirty work.

Label reviewer progress as personal, with overall coverage unavailable. Admin assignment-based totals remain administrative coverage. No partner-progress endpoint or summary is introduced: no migration or expanded read grant is needed. Any future endpoint must check active caller assignment/program access and return only required/complete counts, excluding replaced history, with adversarial anon/unassigned/cross-program tests before adoption. Never expose peer scores/comments or infer full denominators from reviewer-filtered rows.

## 5–6. Summary and continuation

Keep Grant total/completion and existing funding section before criteria. Add an Overview link to the summary, provisional/submitted labeling, all existing band descriptions and committee decision-support copy. Preserve every threshold and zero/missing-score distinction. Persistent successful submission message includes return to caller queue and optional next ready work, in current queue order/filters. Next-work failure is explicit and return remains available. No eligible remaining item is a normal completion state. Read readiness includes active caller assignment, eligibility/override, conflict/declaration, rubric and incomplete personal review; server authorization remains authoritative.

## 7–8. Resolution, practice and guidance

### Local validation follow-up (2026-10-12)

Validate resolution prerequisites, candidate loading/failure/empty/stale lists, rejected writes and successful clear/replace. A successful RPC must lock further resolution writes even if the parent refresh fails; distinguish refresh failure from write failure and offer read-only refresh retry. Preserve the resolution RPC, exclusion policy and reason counter. Validate practice setup/reset/end with synthetic provider responses, seven criteria matching checked-in guidance (15/15/15/20/15/10/10), documents, eligibility/exception, missing rubric/declaration and an unassigned admin. Practice navigation must lead to Testing for administrators and Applications for reviewers; assignment navigation must retain test scope. Existing native controls, inline status/error text and wrapping layout remain. No schema, access or scoring changes.

Preserve the existing reason counter/helper change. Show all unmet decision/reason/replacement prerequisites and persistent result feedback; validate candidate membership before enabling. Keep original review exclusion and other reviewer continuity unchanged. Practice setup gets a readiness checklist and explicit instructions to verify active round, participant assignment, rubric, eligibility and documents; declaration stays a reviewer action. Reviewer Help starts with the short personal path and hides operational admin topics by role. No unverified conflict examples or support address added.

## Responsive and verification contract

Preserve the current desktop action/sidebar composition. At compact widths retain task order, wrap feedback/actions with no fixed widths, and use existing 44 CSS-pixel action targets. Status uses text and polite live regions; errors use alerts. Keep semantic controls and keyboard paths. Verify 320 overflow plus 375, 390, 768, 1024, 1440 rendering when browser fixtures are available. Local tests cover state/projection and threshold boundaries; typecheck, scoped lint and production build cover integration. Authenticated browser/role and real-account checks remain separate evidence. No hosted changes or real-record writes.
