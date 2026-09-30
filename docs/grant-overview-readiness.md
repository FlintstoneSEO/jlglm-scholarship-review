# Business Growth Grant Overview readiness screen

Date: 2026-09-27. Scope: Grant Overview information architecture and presentation only. The existing application audit, Phase D workflow decisions, and Phase E visual system remain the preservation baseline. The user approved this screen order and explicitly deferred eligibility persistence and gating.

## Screen specification and decision

The reviewer's task is to orient to the business, inspect six pass/fail requirements and their available evidence, then continue the existing competitive review workflow. The shared `ReviewWorkspace` retains the business and applicant identity in its header, current review status and progress, tabs, and authorized Documents behavior. The former Overview Applicant panel duplicated the header, so it is removed from this tab. Applicant phone remains in the imported application response when supplied; applicant name and email remain in the header.

The selected composition is a compact business fact surface followed by a six-row evidence list, a small unconfirmed-status message, and current competitive review progress. The business summary uses only normalized imported fields: name, age range, operating model, LARA response, and 2025 customer volume when present. It omits empty facts. Review status and counts come from existing assignment/review data. Rows show source evidence, a text status, human verification guidance, and existing document actions. On narrow screens, facts and requirement columns stack; at wider widths they use available space without a horizontal table.

This composition is Grant-specific, while navigation and document-opening logic stay in the shared workspace/route boundary. The two other viable layouts were six separate cards, which would make a long mobile page and suggest six independent decisions, and a dense comparison table, which would force horizontal scrolling on phones. The chosen rows preserve one sequence and let long evidence wrap.

## States and data boundary

- An absent answer or inaccessible document is labeled **Missing**. A supplied answer or accessible document is **Needs review**, never an automatic pass. Document presence cannot establish completeness or standing.
- The current model has no persisted eligibility decision or verifier identity. The status message says review is not confirmed and that formal confirmation belongs to the next phase. It does not gate the rubric or review submission.
- The live form maps LARA documentation and 2024/2025 P&L to typed `application_documents` rows. Other supporting documents may be imported. The Overview reuses the Documents tab's authorized opener for external URLs and signed private-storage URLs. Provider permissions and Storage policy still govern access.
- `eligibility_answers` may be empty for records imported from the live form. Business eligibility then has no structured evidence in that field and displays **Missing**; the full application answers remain available for human review. No business eligibility outcome is inferred from unrelated fields.
- The applicant's identity response does not by itself establish ownership. LARA self-report does not establish current good standing. These require a formal decision process in Phase 4.

## Phase 4 integration points

Phase 4 needs an approved eligibility decision model with per-requirement outcomes, reviewer/administrator authority, evidence references, timestamps, audit history, and treatment of changed or missing documents. It must define whether all six requirements must pass, how disagreements/reversals work, and which server-side submission boundary enforces scoring readiness. Existing scores/reviews need a migration policy before any gate is enabled. No such tables, RLS, gate, score changes, or submission changes are included here.
