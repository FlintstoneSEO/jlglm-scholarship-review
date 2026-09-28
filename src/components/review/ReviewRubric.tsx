import { useEffect, useState } from "react";
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
  disabledReason,
  errors = {},
}: {
  criteria: RubricCriterion[];
  onScoreChange: (id: string, score: number | null) => void;
  disabled?: boolean;
  disabledReason?: string;
  errors?: Record<string, string | undefined>;
}) {
  const subtotal = criteria.reduce((sum, criterion) => sum + (criterion.score ?? 0), 0);
  const maximum = criteria.reduce((sum, criterion) => sum + criterion.maximum, 0);
  return (
    <div className="divide-y divide-border border-y border-border">
      {criteria.map((criterion) => {
        return (
          <RubricScoreField
            key={criterion.id}
            criterion={criterion}
            disabled={disabled}
            disabledReason={disabledReason}
            error={errors[criterion.id]}
            onScoreChange={onScoreChange}
          />
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

export function RubricScoreField({
  criterion,
  onScoreChange,
  disabled,
  disabledReason,
  error,
  inputPrefix = "criterion",
  compact = false,
}: {
  criterion: RubricCriterion;
  onScoreChange: (id: string, score: number | null) => void;
  disabled?: boolean;
  disabledReason?: string;
  error?: string;
  inputPrefix?: string;
  compact?: boolean;
}) {
  const inputId = `${inputPrefix}-${criterion.id}`;
  const errorId = `${inputId}-error`;
  const [rawScore, setRawScore] = useState(criterion.score?.toString() ?? "");
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setRawScore(criterion.score?.toString() ?? "");
  }, [criterion.score, editing]);
  const invalid = rawScore !== "" && !/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(rawScore);
  const outOfRange = !invalid && rawScore !== "" && Number(rawScore) > criterion.maximum;
  return (
    <div className="py-4 first:pt-0">
      <div
        className={`flex items-start justify-between gap-3 ${compact ? "flex-col" : "flex-wrap"}`}
      >
        <div className={compact ? "w-full min-w-0" : "min-w-0 max-w-2xl flex-1"}>
          <Label htmlFor={inputId} className="font-semibold">
            {criterion.name} score
          </Label>
          {criterion.description && (
            <p id={`${inputId}-description`} className="mt-1 text-xs text-muted-foreground">
              {criterion.description}
            </p>
          )}
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            {criterion.score === null
              ? `Unscored · Maximum ${criterion.maximum}`
              : `Scored · ${criterion.score} / ${criterion.maximum}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            id={inputId}
            type="number"
            min={0}
            max={criterion.maximum}
            step="any"
            className="min-h-11 w-24 text-right"
            disabled={disabled}
            value={rawScore}
            onFocus={() => setEditing(true)}
            onBlur={() => {
              setEditing(false);
              setRawScore(criterion.score?.toString() ?? "");
            }}
            aria-describedby={
              [
                criterion.description ? `${inputId}-description` : "",
                disabled && disabledReason ? `${inputId}-disabled` : "",
                error || invalid || outOfRange ? errorId : "",
              ]
                .filter(Boolean)
                .join(" ") || undefined
            }
            aria-invalid={!!error || invalid || outOfRange}
            onChange={(event) => {
              const next = event.target.value;
              setRawScore(next);
              if (next === "") onScoreChange(criterion.id, null);
              else if (/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(next) && Number(next) <= criterion.maximum)
                onScoreChange(criterion.id, Number(next));
              else onScoreChange(criterion.id, null);
            }}
          />
          <span className="text-xs text-muted-foreground">/ {criterion.maximum}</span>
        </div>
      </div>
      {(error || invalid || outOfRange) && (
        <p id={errorId} className="mt-2 text-sm text-destructive">
          {error ?? "Enter a score from 0 through the criterion maximum."}
        </p>
      )}
      {disabled && disabledReason && (
        <p id={`${inputId}-disabled`} className="mt-2 text-sm text-muted-foreground">
          {disabledReason}
        </p>
      )}
      {criterion.guidance && (
        <details className="mt-3 text-sm">
          <summary className="w-fit cursor-pointer font-medium text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            View scoring criteria
          </summary>
          <div className="mt-3 space-y-3 border-t border-border pt-3">
            {criterion.guidance.bands.map((band) => (
              <div
                key={band.range}
                className={compact ? "grid gap-1" : "grid gap-1 sm:grid-cols-[8rem_1fr]"}
              >
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
            {criterion.guidance.note && <p className="font-medium">{criterion.guidance.note}</p>}
          </div>
        </details>
      )}
    </div>
  );
}
