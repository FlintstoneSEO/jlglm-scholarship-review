import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CriterionGuidance } from "@/lib/grant-rubric-guidance";

export type RubricCriterion = {
  id: string;
  name: string;
  description?: string | null;
  maximum: number;
  score: number | null;
  guidance?: CriterionGuidance;
};
export function ReviewRubric({
  criteria,
  onScoreChange,
  disabled,
  errors = {},
}: {
  criteria: RubricCriterion[];
  onScoreChange: (id: string, score: number | null) => void;
  disabled?: boolean;
  errors?: Record<string, string | undefined>;
}) {
  const subtotal = criteria.reduce((sum, criterion) => sum + (criterion.score ?? 0), 0);
  const maximum = criteria.reduce((sum, criterion) => sum + criterion.maximum, 0);
  return (
    <div className="divide-y divide-border border-y border-border">
      {criteria.map((criterion) => {
        const inputId = `criterion-${criterion.id}`;
        const errorId = `${inputId}-error`;
        return (
          <div key={criterion.id} className="py-4 first:pt-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 max-w-2xl flex-1">
                <Label htmlFor={inputId} className="font-semibold">
                  {criterion.name}
                </Label>
                {criterion.description && (
                  <p id={`${inputId}-description`} className="mt-1 text-xs text-muted-foreground">
                    {criterion.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id={inputId}
                  type="number"
                  min={0}
                  max={criterion.maximum}
                  step="0.5"
                  className="min-h-11 w-24 text-right"
                  disabled={disabled}
                  value={criterion.score ?? ""}
                  aria-describedby={
                    [
                      criterion.description ? `${inputId}-description` : "",
                      errors[criterion.id] ? errorId : "",
                    ]
                      .filter(Boolean)
                      .join(" ") || undefined
                  }
                  aria-invalid={!!errors[criterion.id]}
                  onChange={(event) =>
                    onScoreChange(
                      criterion.id,
                      event.target.value === "" ? null : Number(event.target.value),
                    )
                  }
                />
                <span className="text-xs text-muted-foreground">/ {criterion.maximum}</span>
              </div>
            </div>
            {errors[criterion.id] && (
              <p id={errorId} className="mt-2 text-sm text-destructive">
                {errors[criterion.id]}
              </p>
            )}
            {criterion.guidance && (
              <details className="mt-3 text-sm">
                <summary className="w-fit cursor-pointer font-medium text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                  View scoring guidance
                </summary>
                <div className="mt-3 space-y-3 border-t border-border pt-3">
                  {criterion.guidance.bands.map((band) => (
                    <div key={band.range} className="grid gap-1 sm:grid-cols-[8rem_1fr]">
                      <strong>
                        {band.range} · {band.rating}
                      </strong>
                      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                        {band.guidance.map((point) => (
                          <li key={point}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {criterion.guidance.note && (
                    <p className="font-medium">{criterion.guidance.note}</p>
                  )}
                </div>
              </details>
            )}
          </div>
        );
      })}
      <div
        className="flex justify-between bg-secondary px-3 py-4 font-semibold"
        aria-label={`Review subtotal ${subtotal} out of ${maximum}`}
      >
        <span>Subtotal</span>
        <span>
          {subtotal} / {maximum}
        </span>
      </div>
    </div>
  );
}
