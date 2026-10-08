# Phase C implementation record: shared review workspace

Date: 2026-09-26. This is the focused pre-implementation inventory and preservation record for the authorized Phase C work; it does not repeat the full application audit.

## Existing behavior and boundaries

Both detail routes load an application identity, show status/progress context, expose application content and documents, collect rubric scores and reviewer text, and offer draft/final actions. Scholarship additionally provides applicant administrative notes, contact logging, discussion-document upload/removal, selection/screening tools, fixed Writing and Rhetoric criteria, administrator comparison, and queue-relative previous/next navigation. Grant provides a business profile and narrative groups, an imported raw-response disclosure, typed external/private documents, dynamic criteria, reviewer comments, a review subtotal, and completed-review context.

Scholarship writes the legacy `reviews` row and then preserves its existing fixed-five application status update. Grant still creates/updates `program_reviews` and upserts `review_scores` in its existing sequence. Phase C shares presentation only: neither mutation was moved to a service or made transactional. Applicant notes and contact logs remain distinct from review-owned reviewer notes/comments.

Scholarship previously used five local tabs and Grant rendered one long page. Scholarship had queue-relative previous/next navigation; Grant had return navigation only. Both failed primary reads were presented as unavailable, but secondary-load state fidelity was limited at the route layer. The shared shell now defines the consistent header, normalized user-facing status, count-based progress, section navigation, responsive action rail boundary, and loading/error/partial/unavailable presentation. Program routes continue to own their content and callbacks.

## Phase C preservation and deferred concerns

- Existing route paths, queries, roles, assignment filters, storage buckets, signed-URL generation, scoring ranges/maxima, completion calculations, and writes are preserved.
- `reopened` is deliberately collapsed to the user-facing unavailable status and no transition was added.
- Grant uses shared document and rubric/action presentation. Scholarship's richer document discussion controls and scoring panel remain program-owned because they include upload/delete, checklist, guidance, recommendation, and administrator comparison mechanics.
- The shared workspace exposes dirty-state presentation, but route-level dirty tracking and route-leave confirmation remain deferred. Adding it safely requires coordinating state currently encapsulated inside each scoring panel; this must not be mistaken for authorization to redesign persistence in Phase D.
- Production Supabase authorization and RLS were not exercised locally. The browser client, existing queries, and existing signed-URL behavior remain the authority boundaries.
- Submitted-review editing remains exactly as implemented and unresolved under D1; the shared controls do not claim immutability.
- No Phase D transactional work, Phase E/F work, schema migration, or Justice League palette work was started.
