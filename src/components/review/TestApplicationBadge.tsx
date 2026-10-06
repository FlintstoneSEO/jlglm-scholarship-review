import { Badge } from "@/components/ui/badge";
export function TestApplicationBadge({ isTest }: { isTest: boolean }) {
  return isTest ? <Badge variant="outline">TEST APPLICATION</Badge> : null;
}
export function TestApplicationBanner({ isTest }: { isTest: boolean }) {
  return isTest ? (
    <aside
      aria-label="Test application"
      className="space-y-2 rounded-md border border-border bg-accent p-4 text-sm"
    >
      <TestApplicationBadge isTest />
      <p>
        This application is for testing the reviewer workflow. Reviews and scores for this
        application are excluded from program rankings, reporting, and award decisions.
      </p>
    </aside>
  ) : null;
}
