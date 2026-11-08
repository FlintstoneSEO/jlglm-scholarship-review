import { useId } from "react";
import { Link } from "@tanstack/react-router";
import { Award, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/integrations/supabase/types";
import type { GrantRankingRow } from "@/lib/grant-ranking-summary";

type Selection = Database["public"]["Tables"]["grant_selection_decisions"]["Row"];

export function GrantSelectionBadge({
  selection,
  applicationId,
}: {
  selection: Selection | null | undefined;
  applicationId: string;
}) {
  const recipient = !!selection?.finalized_at && selection.recipient_ids.includes(applicationId);
  const finalist = selection?.finalist_ids.includes(applicationId);
  if (!recipient && !finalist) return null;
  return (
    <Badge
      variant="outline"
      className={
        recipient
          ? "gap-1.5 border-primary bg-primary text-primary-foreground whitespace-normal"
          : "border-gold/50 bg-gold/15 text-gold-foreground whitespace-normal"
      }
    >
      {recipient && <Award className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      {recipient ? "Grant recipient" : "Interview finalist"}
    </Badge>
  );
}

/** Read-only presentation of the saved committee outcome, independent of score rank. */
export function GrantRecipientResults({
  selection,
  rows,
}: {
  selection: Selection;
  rows: GrantRankingRow[];
}) {
  const headingId = useId();
  if (!selection.finalized_at) return null;
  const byId = new Map(rows.map((row) => [row.applicationId, row]));
  return (
    <section
      aria-labelledby={headingId}
      className="min-w-0 rounded-lg border border-primary/25 bg-accent p-4 sm:p-6"
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Award className="mt-1 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <h2 id={headingId} className="font-display text-2xl font-bold text-accent-foreground">
              2026 grant recipients
            </h2>
            <p className="mt-1 text-sm text-accent-foreground">
              Selected by the committee for the Business Growth Grant.
            </p>
          </div>
        </div>
        <p className="text-sm text-accent-foreground">
          Decision finalized{" "}
          <time dateTime={selection.finalized_at}>
            {new Date(selection.finalized_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </time>
        </p>
      </div>
      <ul className="grid gap-4 md:grid-cols-2">
        {selection.recipient_ids.map((id) => {
          const row = byId.get(id);
          return (
            <li
              key={id}
              className="flex min-w-0 flex-col items-start rounded-md border border-border bg-card p-4 sm:p-5"
            >
              <GrantSelectionBadge selection={selection} applicationId={id} />
              <h3 className="mt-3 break-words font-display text-xl font-semibold leading-snug sm:text-2xl">
                {row?.businessName ?? "Selected application"}
              </h3>
              <p className="mt-2 break-words text-sm text-muted-foreground">
                {row?.applicantName ?? "Business and applicant details are currently unavailable."}
              </p>
              <Link
                to="/grants/$id"
                params={{ id }}
                className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                View recipient application
                <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
