export function ReviewSaveFeedback({
  dirty,
  pending,
  message,
}: {
  dirty: boolean;
  pending: boolean;
  message?: string;
}) {
  return (
    <div className="space-y-1 text-sm" role="status" aria-live="polite">
      <p>Changes are not saved until you choose Save draft or Submit review.</p>
      <p className="font-medium">
        {pending
          ? "Saving review. Please wait…"
          : dirty
            ? `${message?.startsWith("Save failed") ? `${message} ` : ""}You have unsaved changes.`
            : message || "No unsaved review changes."}
      </p>
    </div>
  );
}
