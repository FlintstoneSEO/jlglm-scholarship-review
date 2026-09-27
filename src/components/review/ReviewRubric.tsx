import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type RubricCriterion = {
  id: string;
  name: string;
  description?: string | null;
  maximum: number;
  score: number | null;
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
          </div>
        );
      })}
      <div
        className="flex justify-between bg-secondary px-3 py-4 font-semibold"
        aria-label={`Review subtotal ${subtotal} out of ${maximum}`}
      >
        <span>Subtotal</span><span>{subtotal} / {maximum}</span>
      </div>
    </div>
  );
}
