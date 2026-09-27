import { ExternalLink, FileText } from "lucide-react";
import type { ReadState, ReviewDocument } from "@/lib/review-domain";

export function SupportingDocuments({
  documents,
  state = "ready",
  onOpen,
}: {
  documents: ReviewDocument[];
  state?: ReadState;
  onOpen: (document: ReviewDocument) => void | Promise<void>;
}) {
  if (state === "loading") return <p role="status">Loading documents…</p>;
  if (state === "error" || state === "unavailable")
    return <p role="alert">Documents are currently unavailable.</p>;
  if (!documents.length)
    return <p className="text-sm text-muted-foreground">No supporting documents were provided.</p>;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {documents.map((document) => (
        <button
          key={document.id}
          type="button"
          onClick={() => onOpen(document)}
          disabled={!document.url && !document.storagePath}
          aria-label={`Open ${document.label}`}
          className="flex min-h-16 min-w-0 items-center justify-between gap-2 rounded-md border border-border p-4 text-left hover:border-primary hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="flex min-w-0 items-center gap-3">
            <FileText className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block break-words font-medium">{document.label}</span>
              <span className="block text-xs text-muted-foreground">
                {document.url || document.storagePath ? "Open document" : "Unavailable"}
              </span>
            </span>
          </span>
          <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
