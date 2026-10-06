# Grant assignment presentation

User-authorized scope (2026-10-05): make random allocation to saved groups the primary Grant assignment workflow; remove the Grant manual assignment form, present group workload with individual reviewer progress, and retain detailed assignment/reset/deactivation records inside a collapsed administration section. Preserve Scholarship presentation and controls, the current visual direction and navigation, allocation snapshots, eligibility, conflict replacement, scoring semantics, database access, and audit history. No migration or deployment is part of this presentation change.

## Audit and screen specification

The shared assignments route currently places manual single-reviewer assignment, global reviewer workload cards, and full assignment rows below Grant paired allocation. The allocation component already reads frozen rosters, group snapshots, assignments, reviews, conflict reports and resolutions. It follows conflict replacements for individual progress. Manual Grant assignment competes with paired allocation, while global reviewer cards omit group context. Scholarship still uses these controls and its separate legacy review projection.

Keep the existing application shell and Grant practice/live selector. Show progress for applied allocations using their frozen groups and roster, rather than inferring groups from current group membership. Each group shows allocated applications, completed/expected independent reviews, and progress for each original review slot including named replacements. Suspended/missing slots remain visible as attention states; completed reviews on suspended assignments do not count. Multiple applied allocations remain individually identified; pending previews do not count as assigned workload. Practice rounds use the existing assignment scope, and old rounds with no current scoped assignment are omitted from workload.

Keep the allocation creation/preview/apply and conflict workflows. Frozen previews continue to expose their applications before Apply. Place Grant detailed assignment rows and all-program reviewer diagnostics in a closed native details disclosure labeled Assignment history and administration. Keep dialogs outside the disclosure, preserve every existing reset/deactivate/error/loading action and state, and name the details as records rather than a manual workflow. Scholarship retains its existing form, cards and expanded rows. At small widths group summaries use one column, names wrap, and disclosures/buttons retain visible focus and 44px touch targets.

## Verification

Use focused projection tests for replacement chains, suspended/missing assignments, completed independent review counts, and unallocated entries. Run the native unit suite, TypeScript, targeted lint and production build. Authenticated browser review remains separate from source/build verification.

Local evidence: PASS — 108 unit tests (including replacement chains, previously cleared reports, inactive/missing assignments and unallocated entries), TypeScript, targeted ESLint, and Vercel production build. Existing legacy Scholarship completion projection remains intact. Grant loading/errors and retry stay visible outside the collapsed administration section.

NEEDS MANUAL VALIDATION — authenticated visual review at 375, 390, 768, 1024 and 1440px, disclosure keyboard/focus behavior, and deployed group progress. The browser inventory returned no enabled browsers or tabs, so rendered verification was unavailable. No database change or deployment was performed for this increment.
