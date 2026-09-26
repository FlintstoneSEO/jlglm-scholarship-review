import { Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function ReviewActions({
  onSaveDraft,
  onSubmit,
  pending,
  disabled,
  message,
}: {
  onSaveDraft: () => void;
  onSubmit: () => void;
  pending?: "save" | "submit" | null;
  disabled?: boolean;
  message?: string | null;
}) {
  return (
    <Card className="space-y-3 p-4">
      <h2 className="font-semibold">Review actions</h2>
      {message && (
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          {message}
        </p>
      )}
      <Button
        variant="outline"
        className="w-full"
        onClick={onSaveDraft}
        disabled={disabled || !!pending}
      >
        <Save className="mr-2 h-4 w-4" aria-hidden="true" />
        {pending === "save" ? "Saving…" : "Save draft"}
      </Button>
      <Button className="w-full" onClick={onSubmit} disabled={disabled || !!pending}>
        <Send className="mr-2 h-4 w-4" aria-hidden="true" />
        {pending === "submit" ? "Submitting…" : "Submit review"}
      </Button>
    </Card>
  );
}
