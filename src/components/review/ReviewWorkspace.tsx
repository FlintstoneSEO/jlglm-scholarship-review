import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ReviewProgress } from "./ReviewProgress";
import { ReviewStatus } from "./ReviewStatus";
import type {
  ReadState,
  ReviewProgress as Progress,
  ReviewStatus as Status,
} from "@/lib/review-domain";

export type ReviewWorkspaceSection = {
  id: string;
  label: string;
  content: ReactNode;
  visible?: boolean;
  count?: number;
};

export type ReviewWorkspaceProps = {
  programName: string;
  identity: string;
  context?: ReactNode;
  status: Status;
  progress: Progress;
  state?: ReadState;
  sections: ReviewWorkspaceSection[];
  initialSection?: string;
  activeSection?: string;
  onSectionChange?: (section: string) => void;
  queuePath: string;
  queueLabel?: string;
  previousPath?: string | null;
  nextPath?: string | null;
  positionLabel?: string;
  headerActions?: ReactNode;
  actions?: ReactNode;
  dirty?: boolean;
};

export function visibleWorkspaceSections(sections: ReviewWorkspaceSection[]) {
  return sections.filter((section) => section.visible !== false);
}

export function ReviewWorkspace(props: ReviewWorkspaceProps) {
  const sections = useMemo(() => visibleWorkspaceSections(props.sections), [props.sections]);
  const [internalActive, setInternalActive] = useState(
    props.initialSection ?? sections[0]?.id ?? "",
  );
  const active = props.activeSection ?? internalActive;
  const setActive = (section: string) => {
    if (props.activeSection === undefined) setInternalActive(section);
    props.onSectionChange?.(section);
  };
  useEffect(() => {
    if (props.activeSection === undefined && !sections.some((section) => section.id === active))
      setInternalActive(sections[0]?.id ?? "");
  }, [active, props.activeSection, sections]);

  if (props.state === "loading") return <WorkspaceState title="Loading application…" busy />;
  if (props.state === "unavailable")
    return <WorkspaceState title="This application is unavailable or not assigned to you." />;
  if (props.state === "error")
    return (
      <WorkspaceState
        title="We could not load this application."
        detail="Try returning to the queue and opening it again."
      />
    );

  const selected = sections.find((section) => section.id === active);
  return (
    <div className="min-w-0 space-y-5">
      <nav
        aria-label="Review navigation"
        className="flex flex-wrap items-center justify-between gap-2"
      >
        <Link
          to={props.queuePath}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />{" "}
          {props.queueLabel ?? "Return to queue"}
        </Link>
        {(props.previousPath !== undefined || props.nextPath !== undefined) && (
          <div className="flex items-center gap-2">
            {props.positionLabel && (
              <span className="text-xs text-muted-foreground">{props.positionLabel}</span>
            )}
            <Button
              asChild={!!props.previousPath}
              variant="outline"
              size="sm"
              disabled={!props.previousPath}
            >
              {props.previousPath ? (
                <Link to={props.previousPath}>
                  <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
                  Previous
                </Link>
              ) : (
                <span>
                  <ArrowLeft className="mr-1 inline h-4 w-4" aria-hidden="true" />
                  Previous
                </span>
              )}
            </Button>
            <Button
              asChild={!!props.nextPath}
              variant="outline"
              size="sm"
              disabled={!props.nextPath}
            >
              {props.nextPath ? (
                <Link to={props.nextPath}>
                  Next
                  <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
                </Link>
              ) : (
                <span>
                  Next
                  <ArrowRight className="ml-1 inline h-4 w-4" aria-hidden="true" />
                </span>
              )}
            </Button>
          </div>
        )}
      </nav>
      <header className="grid gap-4 border-b border-border pb-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {props.programName}
          </p>
          <h1 className="mt-1 break-words text-3xl font-black leading-tight tracking-tight">
            {props.identity}
          </h1>
          {props.context && (
            <div className="mt-1 break-words text-sm text-muted-foreground">{props.context}</div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ReviewStatus status={props.status} />
            {props.dirty && <BadgeUnsaved />}
          </div>
        </div>
        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <ReviewProgress progress={props.progress} />
          {props.headerActions}
        </div>
      </header>
      {props.state === "partial_error" && (
        <div
          role="status"
          className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm"
        >
          Some supporting review information could not be loaded. Available content is shown below.
        </div>
      )}
      <div
        className={
          props.actions
            ? "lg:grid lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start lg:gap-6"
            : "min-w-0"
        }
      >
        <div className="min-w-0 rounded-lg border border-border bg-card p-4 sm:p-6">
          <div
            role="tablist"
            aria-label="Application review sections"
            className="sticky top-0 z-20 mb-4 grid grid-cols-2 gap-1 border-b border-border bg-card pb-1 shadow-sm sm:flex sm:flex-wrap"
          >
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                role="tab"
                aria-selected={active === section.id}
                aria-controls={`review-section-${section.id}`}
                id={`review-tab-${section.id}`}
                tabIndex={active === section.id ? 0 : -1}
                onClick={() => setActive(section.id)}
                onKeyDown={(event) => {
                  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                  event.preventDefault();
                  const index = sections.findIndex((item) => item.id === section.id);
                  const next =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? sections.length - 1
                        : (index + (event.key === "ArrowRight" ? 1 : -1) + sections.length) %
                          sections.length;
                  setActive(sections[next].id);
                  const tabs =
                    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                      "[role='tab']",
                    );
                  tabs?.[next]?.focus();
                }}
                className="min-h-11 min-w-0 border-b-2 border-transparent px-2 py-2 text-sm font-medium aria-selected:border-primary aria-selected:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {section.label}
                {section.count !== undefined ? ` (${section.count})` : ""}
              </button>
            ))}
          </div>
          <section
            role="tabpanel"
            id={`review-section-${selected?.id}`}
            aria-labelledby={`review-tab-${selected?.id}`}
            tabIndex={0}
          >
            {selected?.content}
          </section>
        </div>
        {props.actions && (
          <aside aria-label="Review actions" className="mt-5 min-w-0 lg:mt-0">
            <div className="sticky top-4">{props.actions}</div>
          </aside>
        )}
      </div>
    </div>
  );
}

function BadgeUnsaved() {
  return (
    <span role="status" className="border-l-2 border-gold pl-2 text-xs font-medium text-warning">
      Unsaved changes
    </span>
  );
}
function WorkspaceState({
  title,
  detail,
  busy = false,
}: {
  title: string;
  detail?: string;
  busy?: boolean;
}) {
  return (
    <Card className="p-8" role="status" aria-live="polite" aria-busy={busy}>
      <h1 className="text-lg font-semibold">{title}</h1>
      {detail && <p className="mt-2 text-sm text-muted-foreground">{detail}</p>}
    </Card>
  );
}
