import { Card } from "@/components/ui/card";
import type { GroupSnapshot } from "@/lib/grant-committee";
import type { projectGrantAllocationProgress } from "@/lib/grant-allocation-progress";

export function GrantGroupWorkload({
  entries,
  sourceGroups,
  roster,
  name,
}: {
  entries: ReturnType<typeof projectGrantAllocationProgress>;
  sourceGroups: GroupSnapshot[];
  roster: string[];
  name: (id: string) => string;
}) {
  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-3">
      {[1, 2, 3].map((pair) => {
        const applications = entries.filter((entry) => entry.pair === pair);
        const slots = applications.flatMap((entry) => entry.slots);
        const completed = slots.filter((slot) => slot.completed).length;
        const unavailable = slots.filter((slot) => slot.assignment?.lifecycle !== "active").length;
        const held = slots.filter((slot) => slot.held).length;
        const expected = applications.length * 2;
        return (
          <Card key={pair} className="min-w-0 space-y-3 p-4">
            <h3 className="break-words font-semibold">
              {sourceGroups[pair - 1]?.name ?? `Pair ${pair}`}
            </h3>
            <p className="text-sm">{applications.length} allocated applications</p>
            <p className="text-sm font-medium">
              {completed} of {expected} independent reviews completed
            </p>
            {expected > 0 && (
              <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${(100 * completed) / expected}%` }}
                />
              </div>
            )}
            {held > 0 && (
              <p className="text-sm font-semibold">
                {held} conflicts require administrator attention.
              </p>
            )}
            <p className="text-sm">{expected - completed} reviews remaining</p>
            {unavailable > 0 && (
              <p className="text-sm text-destructive">
                {unavailable} inactive or missing assignments need administrator attention.
              </p>
            )}
            <ul className="divide-y border-t">
              {roster.slice((pair - 1) * 2, pair * 2).map((reviewerId) => {
                const individual = slots.filter((slot) => slot.originalReviewerId === reviewerId);
                const direct = individual.filter((slot) => slot.reviewerId === reviewerId);
                const done = direct.filter((slot) => slot.completed).length;
                const replacements = [
                  ...new Set(
                    individual
                      .filter((slot) => slot.reviewerId !== reviewerId)
                      .map((slot) => slot.reviewerId),
                  ),
                ];
                return (
                  <li key={reviewerId} className="min-w-0 space-y-1 py-3 text-sm">
                    <p className="break-words font-medium">{name(reviewerId)}</p>
                    <p className="text-muted-foreground">
                      {done} completed · {direct.length - done} outstanding
                    </p>
                    {replacements.map((id) => (
                      <p key={id} className="break-words text-muted-foreground">
                        Replacement: {name(id)} (
                        {
                          individual.filter((slot) => slot.reviewerId === id && slot.completed)
                            .length
                        }{" "}
                        completed ·{" "}
                        {
                          individual.filter((slot) => slot.reviewerId === id && !slot.completed)
                            .length
                        }{" "}
                        outstanding)
                      </p>
                    ))}
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
