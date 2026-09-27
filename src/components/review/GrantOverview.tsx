import { ExternalLink } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import type { ReviewDocument, ReviewProgress, ReviewStatus } from "@/lib/review-domain";
import { grantOverviewRequirements } from "@/lib/grant-overview";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  grantEligibilityStatusLabel,
  grantRequirementBadgeClass,
  grantRequirementStatusLabel,
} from "@/lib/grant-eligibility-display";

type GrantDetail = Database["public"]["Tables"]["business_grant_application_details"]["Row"];
type Eligibility = Database["public"]["Tables"]["application_eligibility_reviews"]["Row"];
type Item = Database["public"]["Tables"]["eligibility_review_items"]["Row"];
type Override = Database["public"]["Tables"]["eligibility_scoring_overrides"]["Row"];
type ItemStatus = Database["public"]["Enums"]["grant_requirement_status"];
type Decision = Database["public"]["Enums"]["grant_eligibility_status"];

export function GrantOverview({
  detail,
  documents,
  progress,
  status,
  onOpenDocument,
  eligibility,
  items,
  latestOverride,
  confirmer,
  canScreen,
  onSaveItem,
  onConfirm,
  onOverride,
}: {
  detail: GrantDetail;
  documents: ReviewDocument[];
  progress: ReviewProgress;
  status: ReviewStatus;
  onOpenDocument: (document: ReviewDocument) => void | Promise<void>;
  eligibility: Eligibility | null;
  items: Item[];
  latestOverride: Override | null;
  confirmer: string | null;
  canScreen: boolean;
  onSaveItem: (key: string, status: ItemStatus, notes: string) => Promise<void>;
  onConfirm: (status: Decision, notes: string) => Promise<void>;
  onOverride: (allowed: boolean, reason: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState<Decision>(
    eligibility?.status === "not_reviewed" ? "eligible" : (eligibility?.status ?? "eligible"),
  );
  const [decisionNote, setDecisionNote] = useState(eligibility?.notes ?? "");
  const [overrideReason, setOverrideReason] = useState("");
  const facts = [
    ["Time in business", detail.business_age_range],
    ["Operating model", detail.business_operating_model],
    ["LARA response", detail.lara_status],
    ["Customers served in 2025", detail.customer_volume],
  ].filter((entry): entry is [string, string] => !!entry[1]);
  const requirements = grantOverviewRequirements(detail, documents);
  return (
    <div className="min-w-0 space-y-5">
      <section
        aria-labelledby="grant-business-summary"
        className="rounded-lg border border-border bg-card p-4 sm:p-6"
      >
        <h2 id="grant-business-summary" className="font-display text-xl font-black uppercase">
          Business at a glance
        </h2>
        <p className="mt-2 break-words text-lg font-semibold">{detail.business_name}</p>
        {facts.length > 0 ? (
          <dl className="mt-4 grid gap-x-8 gap-y-3 border-t border-border pt-4 sm:grid-cols-2 xl:grid-cols-4">
            {facts.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {label}
                </dt>
                <dd className="mt-1 break-words text-sm font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            No additional business summary fields were supplied.
          </p>
        )}
      </section>

      <section
        aria-labelledby="grant-eligibility"
        className="rounded-lg border border-border bg-card p-4 sm:p-6"
      >
        <h2 id="grant-eligibility" className="font-display text-xl font-black uppercase">
          Eligibility &amp; compliance
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          These six pass/fail requirements need human review before competitive scoring. Record
          responses and document presence do not establish eligibility.
        </p>
        <ol className="mt-4 divide-y divide-border border-y border-border">
          {requirements.map((requirement) => {
            const item = items.find((entry) => entry.requirement_key === requirement.id);
            const verificationStatus = item?.status ?? "pending";
            return (
              <li
                key={requirement.id}
                className="grid min-w-0 gap-2 py-4 lg:grid-cols-[minmax(12rem,0.8fr)_minmax(0,1.5fr)] lg:gap-6"
              >
                <div className="min-w-0">
                  <h3 className="font-semibold">{requirement.label}</h3>
                  <span
                    className={`mt-2 inline-block rounded px-2 py-0.5 text-xs font-semibold ${grantRequirementBadgeClass(verificationStatus)}`}
                  >
                    {grantRequirementStatusLabel[verificationStatus]}
                  </span>
                </div>
                <div className="min-w-0 space-y-2 text-sm">
                  <p className="break-words">
                    <span className="font-semibold">Record evidence:</span> {requirement.evidence}
                  </p>
                  <p className="break-words text-muted-foreground">
                    <span className="font-semibold text-foreground">Documentation:</span>{" "}
                    {requirement.documentNote}
                  </p>
                  <p className="break-words text-muted-foreground">
                    <span className="font-semibold text-foreground">Human verification:</span>{" "}
                    {requirement.verification}
                  </p>
                  <RequirementControl
                    requirementKey={requirement.id}
                    requirementLabel={requirement.label}
                    status={verificationStatus}
                    notes={item?.notes ?? ""}
                    canScreen={canScreen}
                    busy={busy}
                    onSave={async (status, notes) => {
                      setBusy(true);
                      try {
                        await onSaveItem(requirement.id, status, notes);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />
                  {requirement.documents.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {requirement.documents.map((document) => (
                        <button
                          key={document.id}
                          type="button"
                          onClick={() => onOpenDocument(document)}
                          disabled={!document.url && !document.storagePath}
                          className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-md border border-border px-3 py-2 text-left text-sm font-medium text-primary hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span className="break-words">
                            {document.url || document.storagePath ? "Open" : "Unavailable"}{" "}
                            {document.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section
        aria-labelledby="grant-eligibility-status"
        className="rounded-lg border border-border bg-muted/30 p-4 sm:p-5"
      >
        <h2 id="grant-eligibility-status" className="text-base font-semibold">
          Eligibility review status
        </h2>
        <p className="mt-1 text-sm font-medium">
          {grantEligibilityStatusLabel[eligibility?.status ?? "not_reviewed"]}
        </p>
        {eligibility?.reviewed_at && (
          <p className="mt-1 text-sm text-muted-foreground">
            Confirmed by {confirmer ?? eligibility.reviewed_by} on{" "}
            {new Date(eligibility.reviewed_at).toLocaleString()}
          </p>
        )}
        {eligibility?.notes && (
          <p className="mt-2 whitespace-pre-wrap break-words text-sm">
            Reason: {eligibility.notes}
          </p>
        )}
        {latestOverride?.scoring_allowed && (
          <p className="mt-3 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm font-semibold">
            Competitive scoring is available by administrator override. Reason:{" "}
            {latestOverride.reason} Recorded {new Date(latestOverride.created_at).toLocaleString()}.
          </p>
        )}
        {canScreen && (
          <div className="mt-4 space-y-3 border-t border-border pt-4">
            <label className="block text-sm font-semibold" htmlFor="grant-final-decision">
              Final eligibility decision
            </label>
            <select
              id="grant-final-decision"
              value={decision}
              onChange={(event) => setDecision(event.target.value as Decision)}
              className="min-h-11 w-full rounded-md border border-input bg-background px-3 sm:max-w-sm"
            >
              <option value="eligible">Eligible</option>
              <option value="needs_clarification">Needs clarification</option>
              <option value="ineligible">Ineligible</option>
            </select>
            <label className="block text-sm font-semibold" htmlFor="grant-decision-note">
              Decision note{decision !== "eligible" ? " (required)" : " (optional)"}
            </label>
            <Textarea
              id="grant-decision-note"
              value={decisionNote}
              onChange={(event) => setDecisionNote(event.target.value)}
            />
            <Button
              disabled={busy || (decision !== "eligible" && decisionNote.trim().length < 10)}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm(decision, decisionNote);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Confirm eligibility decision
            </Button>
            <div className="space-y-2 border-t border-border pt-4">
              <h3 className="font-semibold">Administrator scoring override</h3>
              <p className="text-sm text-muted-foreground">
                Use only for a documented program exception. Each change is retained in the audit
                history.
              </p>
              <label className="block text-sm font-semibold" htmlFor="grant-override-reason">
                Override reason
              </label>
              <Textarea
                id="grant-override-reason"
                value={overrideReason}
                onChange={(event) => setOverrideReason(event.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={busy || overrideReason.trim().length < 10}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await onOverride(true, overrideReason);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Allow scoring by exception
                </Button>
                <Button
                  variant="outline"
                  disabled={busy || overrideReason.trim().length < 10}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await onOverride(false, overrideReason);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Revoke override
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>

      <section
        aria-labelledby="grant-competitive-progress"
        className="rounded-lg border border-border bg-card p-4 sm:p-6"
      >
        <h2 id="grant-competitive-progress" className="font-display text-xl font-black uppercase">
          Competitive review progress
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Eligibility &amp; compliance → Competitive review
        </p>
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t border-border pt-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Your review</dt>
            <dd className="font-semibold">
              {status.value === "submitted"
                ? "Submitted"
                : status.value === "in_progress"
                  ? "In progress"
                  : "Not started"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Assigned reviews</dt>
            <dd className="font-semibold">{progress.assignedReviewers ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Completed reviews</dt>
            <dd className="font-semibold">{progress.completedReviews ?? "—"}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

function RequirementControl({
  requirementKey,
  requirementLabel,
  status,
  notes,
  canScreen,
  busy,
  onSave,
}: {
  requirementKey: string;
  requirementLabel: string;
  status: ItemStatus;
  notes: string;
  canScreen: boolean;
  busy: boolean;
  onSave: (status: ItemStatus, notes: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState(status);
  const [note, setNote] = useState(notes);
  if (!canScreen)
    return (
      <p className="font-medium">
        Verification: {grantRequirementStatusLabel[status]}
        {notes ? ` · ${notes}` : ""}
      </p>
    );
  return (
    <div className="space-y-2 rounded-md bg-muted/30 p-3">
      <fieldset>
        <legend className="font-semibold">
          Human verification for {requirementLabel}: {grantRequirementStatusLabel[status]}
        </legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {Object.entries(grantRequirementStatusLabel).map(([value, label]) => (
            <label
              key={value}
              className={`flex min-h-11 min-w-0 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-ring ${selected === value ? "border-primary bg-primary/5 font-semibold" : "border-input bg-background hover:bg-accent/40"}`}
            >
              <input
                type="radio"
                name={`eligibility-${requirementKey}`}
                value={value}
                checked={selected === value}
                onChange={() => setSelected(value as ItemStatus)}
                className="h-4 w-4 shrink-0 accent-primary"
              />
              <span className="break-words">{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Textarea
        aria-label="Verification note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Optional verification note"
      />
      <Button
        variant="outline"
        disabled={busy || (selected === status && note === notes)}
        onClick={() => onSave(selected, note)}
      >
        Save verification
      </Button>
    </div>
  );
}
