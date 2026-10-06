import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { parseTestingSearch, practiceApplicationName } from "@/lib/testing-workflow";
import { useTestingApplications } from "@/lib/use-testing-applications";
import { GuidedTesting } from "@/components/review/GuidedTesting";
import { GrantPracticeSessions } from "@/components/review/GrantPracticeSessions";
import { TestApplicationBadge } from "@/components/review/TestApplicationBadge";

export const Route = createFileRoute("/_app/testing")({
  validateSearch: parseTestingSearch,
  component: TestingPage,
});
function TestingPage() {
  const { programs, selectedProgram, setSelectedProgram, role, user } = useAuth();
  const qc = useQueryClient();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [practice, setPractice] = useState<{ id: string; round: number } | null>(null);
  const activePrograms = useQuery({
    queryKey: ["testing-active-programs"],
    queryFn: async () => {
      const result = await supabase.from("programs").select("id").eq("active", true);
      if (result.error) throw result.error;
      return new Set((result.data ?? []).map((p) => p.id));
    },
  });
  const managed = programs.filter(
    (p) => activePrograms.data?.has(p.programId) && (role === "admin" || p.accessRole === "admin"),
  );
  const program = managed.find((p) => p.programId === selectedProgram?.programId) ?? managed[0];
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{
    applicationId: string;
    applicantId: string | null;
    applicantName: string;
    programName: string;
    slug: string;
  } | null>(null);
  const [target, setTarget] = useState<{
    id: string;
    name: string;
    action: "reset" | "delete";
  } | null>(null);
  const query = useTestingApplications(program?.programId, program?.slug);
  async function create() {
    if (!program || busy) return;
    setBusy(true);
    try {
      const result = await supabase.rpc("create_test_application", {
        p_program: program.programId,
      });
      if (result.error) throw result.error;
      const data = result.data as {
        applicationId: string;
        applicantId: string | null;
        applicantName: string;
      };
      setSelectedProgram(program.slug);
      setCreated({
        ...data,
        applicantName: practiceApplicationName(data.applicantName, program.slug),
        programName: program.name,
        slug: program.slug,
      });
      setCreating(false);
      await qc.invalidateQueries();
      if (search.guide)
        await navigate({ search: { guide: true, application: data.applicationId } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (error as { message: string }).message);
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (!target || busy) return;
    setBusy(true);
    try {
      const result = await supabase.rpc(
        target.action === "reset" ? "reset_test_application" : "delete_test_application",
        { p_application: target.id },
      );
      if (result.error) throw result.error;
      toast.success(
        target.action === "reset"
          ? "Test review progress cleared. Application and assignments retained."
          : "Test application deleted.",
      );
      if (created?.applicationId === target.id) setCreated(null);
      if (search.application === target.id && target.action === "delete")
        await navigate({ search: { guide: false } });
      await qc.invalidateQueries();
      setTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (error as { message: string }).message);
    } finally {
      setBusy(false);
    }
  }
  const destination = (id: string, applicantId: string | null) =>
    applicantId ? `/applicants/${applicantId}` : `/grants/${id}`;
  if (activePrograms.isLoading) return <p role="status">Loading active programs…</p>;
  if (activePrograms.isError)
    return (
      <Card className="p-6">
        <p role="alert">Active programs could not be loaded.</p>
        <Button
          className="min-h-11 max-w-full whitespace-normal"
          variant="outline"
          onClick={() => activePrograms.refetch()}
        >
          Retry
        </Button>
      </Card>
    );
  if (!program)
    return (
      <Card className="p-6">Program administrator access to an active program is required.</Card>
    );
  return (
    <div className="space-y-6 [&_button]:min-h-11 [&_a]:min-h-11">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-3xl">Testing</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Create a sample application to test assignments, rubrics, scoring, and the reviewer
            experience without affecting real program results.
          </p>
        </div>
        <Button
          className="min-h-11"
          onClick={() => {
            setCreating(true);
            setCreated(null);
          }}
        >
          Create Practice Application
        </Button>
      </div>
      <Card className="space-y-3 p-5">
        <h2 className="font-display text-xl">Practice the Review Process</h2>
        <p className="max-w-3xl text-sm">
          Use this area to practice the same steps reviewers use with real applications. Practice
          applications contain fictional information, carry a TEST badge, and do not affect real
          scores, rankings, award decisions or reports.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => navigate({ search: { guide: true } })}>Start Guided Test</Button>
          <Button variant="outline" asChild>
            <Link to="/help" hash="testing">
              View Testing Guide
            </Link>
          </Button>
        </div>
      </Card>
      <div className="space-y-2">
        <label htmlFor="testing-program" className="text-sm font-medium">
          Program
        </label>
        <Select
          value={program.programId}
          onValueChange={(id) => {
            const p = managed.find((p) => p.programId === id);
            if (p) {
              setSelectedProgram(p.slug);
              setCreated(null);
              setPractice(null);
              navigate({ search: { guide: search.guide } });
            }
          }}
        >
          <SelectTrigger id="testing-program" className="min-h-11 w-full sm:w-80">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {managed.map((p) => (
              <SelectItem key={p.programId} value={p.programId}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {creating && (
        <Card className="space-y-4 p-5">
          <h2 className="text-xl font-semibold">Create a fictional application</h2>
          <p>
            Program: <strong>{program.name}</strong>
          </p>
          <p className="text-sm">
            {program.slug === "scholarship"
              ? "Jordan Williams attends a fictional community college. Includes a sample education and community involvement essay and transcript."
              : program.slug === "business_growth_grant"
                ? "Capital City Repair requests $5,000 for equipment and staff training. Includes fictional business answers, registration evidence and financial statements."
                : "A fictional application header will be created. This program's production content adapter must support its application fields."}
          </p>
          <p className="text-sm text-muted-foreground">
            All information is fictional. Screening is required through the normal application
            screen. You can assign existing reviewers after creation using Reviewer Assignments.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              className="min-h-11 max-w-full whitespace-normal"
              disabled={busy}
              onClick={create}
            >
              {busy ? "Creating…" : "Create Practice Application"}
            </Button>
            <Button
              className="min-h-11 max-w-full whitespace-normal"
              disabled={busy}
              variant="outline"
              onClick={() => setCreating(false)}
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}
      {created && (
        <Card className="space-y-3 p-5" role="status">
          <h2 className="text-xl font-semibold">Test application created</h2>
          <TestApplicationBadge isTest />
          <p>
            Program: {created.programName}
            <br />
            Application: {created.applicantName}
            <br />
            Status: Pending screening
            <br />
            Reviewers and progress appear in the list below
          </p>
          <div className="flex flex-wrap gap-3">
            <Button className="min-h-11 max-w-full whitespace-normal" asChild>
              <Link to={destination(created.applicationId, created.applicantId)}>
                Open Test Application
              </Link>
            </Button>
            <Button className="min-h-11 max-w-full whitespace-normal" variant="outline" asChild>
              <Link
                to="/assignments"
                search={{
                  scope: "test",
                  application: created.applicationId,
                  program: created.slug,
                }}
              >
                Assign reviewers now
              </Link>
            </Button>
            <Button
              className="min-h-11 max-w-full whitespace-normal"
              variant="outline"
              onClick={() => setCreated(null)}
            >
              Create without assignment
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setCreated(null);
                setCreating(true);
              }}
            >
              Create Another
            </Button>
          </div>
        </Card>
      )}
      <h2 className="font-display text-xl">Practice Applications</h2>
      {query.isLoading ? (
        <p role="status">Loading test applications…</p>
      ) : query.isError ? (
        <Card className="p-5">
          <p role="alert">
            Test applications could not be loaded. {(query.error as Error).message}
          </p>
          <Button
            className="min-h-11 max-w-full whitespace-normal"
            variant="outline"
            onClick={() => query.refetch()}
          >
            Retry
          </Button>
        </Card>
      ) : !query.data?.apps.length ? (
        <Card className="p-5">
          No test applications for this program. Create one to rehearse the workflow.
        </Card>
      ) : (
        <ul className="space-y-3">
          {query.data.apps.map((a) => {
            const legacyId = a.applicantId;
            const count = a.progress.filter((p) => p.assignment.lifecycle === "active").length;
            return (
              <li key={a.id}>
                <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div className="min-w-0 space-y-2">
                    <TestApplicationBadge isTest />
                    <h2 className="break-words font-semibold">{a.displayName}</h2>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(a.created_at).toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {program.name} · Practice Application
                    </p>
                    <p className="text-sm">
                      {count} reviewers assigned · {a.progress.filter((p) => p.started).length}{" "}
                      started · {a.progress.filter((p) => p.completed).length} completed
                    </p>
                  </div>
                  <ul className="w-full space-y-1 text-sm" aria-label="Reviewer progress">
                    {a.progress.map((p) => (
                      <li key={p.assignment.id} className="flex flex-wrap gap-x-3">
                        <span>
                          {query.data.profiles.find((r) => r.id === p.assignment.reviewer_id)
                            ?.full_name ||
                            query.data.profiles.find((r) => r.id === p.assignment.reviewer_id)
                              ?.email ||
                            "Reviewer unavailable"}
                        </span>
                        <span>{p.label}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="min-h-11 max-w-full whitespace-normal"
                      variant="outline"
                      asChild
                    >
                      <Link to={destination(a.id, legacyId)}>Open</Link>
                    </Button>
                    <Button
                      className="min-h-11 max-w-full whitespace-normal"
                      variant="outline"
                      asChild
                    >
                      <Link
                        to="/assignments"
                        search={{ scope: "test", application: a.id, program: program.slug }}
                      >
                        Assign reviewers
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        navigate({
                          search: {
                            guide: true,
                            application: a.id,
                            reviewer: search.application === a.id ? search.reviewer : undefined,
                          },
                        })
                      }
                    >
                      Continue Guided Test
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setTarget({ id: a.id, name: a.displayName, action: "reset" })}
                    >
                      Reset Test
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setTarget({ id: a.id, name: a.displayName, action: "delete" })}
                    >
                      Delete Test
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      {program.slug === "business_growth_grant" && (
        <details className="rounded-xl border bg-card p-4">
          <summary className="min-h-11 cursor-pointer font-semibold">
            Group practice (optional)
          </summary>
          <p className="my-3 text-sm">
            Use a group practice run to rehearse screening and paired allocation with 40 fictional
            applications. Resetting a group archives the previous round; resetting an individual
            test only clears its review progress.
          </p>
          <GrantPracticeSessions
            key={program.programId}
            programId={program.programId}
            profiles={query.data?.profiles ?? []}
            selected={practice}
            onSelect={setPractice}
          />
        </details>
      )}
      <p className="text-sm text-muted-foreground">
        Something didn&apos;t work? Open the Testing Guide for troubleshooting. Note the step, what
        you expected, what happened, and any error message for your administrator.
      </p>
      <GuidedTesting
        key={program.programId}
        open={!!search.guide && !target}
        programs={managed}
        program={program}
        userId={user?.id}
        application={query.data?.apps.find((a) => a.id === search.application)}
        requestedApplication={search.application}
        profiles={query.data?.profiles ?? []}
        reviewerId={search.reviewer}
        loading={query.isFetching}
        failed={query.isError}
        busy={busy}
        chooseProgram={(slug) => {
          setSelectedProgram(slug);
          setPractice(null);
          setCreated(null);
          navigate({ search: { guide: true } });
        }}
        create={create}
        update={(search) => {
          navigate({ search });
        }}
        refresh={() => {
          query.refetch();
        }}
        reset={(a) => setTarget({ id: a.id, name: a.displayName, action: "reset" })}
      />
      <Dialog
        open={!!target}
        onOpenChange={(open) => {
          if (!open && !busy) setTarget(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto [&_button]:min-h-11">
          <DialogHeader>
            <DialogTitle>
              {target?.action === "reset" ? "Reset test review?" : "Delete test application?"}
            </DialogTitle>
            <DialogDescription>
              {target?.name}.{" "}
              {target?.action === "reset"
                ? "This will clear review progress, scores, comments and conflict declarations/reports so reviewers can test the workflow again. The test application, screening and assignment history will remain. Suspended assignments stay suspended."
                : "This will permanently delete this test application and its associated assignments, reviews, scores and comments. Real applications will not be affected. Uploaded files must be removed first."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={busy}
              variant={target?.action === "delete" ? "destructive" : "default"}
              onClick={confirm}
            >
              {busy ? "Working…" : target?.action === "reset" ? "Reset Test" : "Delete Test"}
            </Button>
            <Button
              className="min-h-11 max-w-full whitespace-normal"
              disabled={busy}
              variant="outline"
              onClick={() => setTarget(null)}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
