import { Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function ReviewActions({
  onSaveDraft,
  onSubmit,
  pending,
  disabled,
  submitDisabled,
  message,
}: {
  onSaveDraft: () => void;
  onSubmit: () => void;
  pending?: "save" | "submit" | null;
  disabled?: boolean;
  submitDisabled?: boolean;
  message?: string | null;
}) {
  return (
    <Card className="space-y-3 overflow-hidden p-4 pt-0">
      <h2 className="-mx-4 bg-sidebar px-4 py-3 font-semibold text-sidebar-foreground">
        Review actions
      </h2>
      {message && (
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          {message}
        </p>
      )}
      <Button
        variant="outline"
        className="min-h-11 w-full"
        onClick={onSaveDraft}
        disabled={disabled || !!pending}
      >
        <Save className="mr-2 h-4 w-4" aria-hidden="true" />
        {pending === "save" ? "Saving…" : "Save draft"}
      </Button>
      <Button
        className="min-h-11 w-full"
        onClick={onSubmit}
        disabled={disabled || submitDisabled || !!pending}
      >
        <Send className="mr-2 h-4 w-4" aria-hidden="true" />
        {pending === "submit" ? "Submitting…" : "Submit review"}
      </Button>
    </Card>
  );
}
