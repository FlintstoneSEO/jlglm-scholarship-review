import { Button } from "@/components/ui/button";
export function QueueRefresh({
  pending,
  error,
  updatedAt,
  onRefresh,
}: {
  pending: boolean;
  error: boolean;
  updatedAt: number;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <Button variant="outline" className="min-h-11" disabled={pending} onClick={onRefresh}>
        Refresh applications
      </Button>
      <p role="status" aria-live="polite">
        {pending
          ? "Updating applications…"
          : error
            ? "Update incomplete. Retry before relying on work status."
            : updatedAt
              ? "Applications updated. Checks for changes every 30 seconds while this page is open."
              : "Waiting for applications…"}
      </p>
    </div>
  );
}
