import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CopyPlus, Plus, Power, Rocket } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/brand";

export const Route = createFileRoute("/_app/grant-rubric")({ component: GrantRubric });

type RubricVersion = {
  id: string;
  version: number;
  name: string;
  active: boolean;
  retired_at: string | null;
};

function GrantRubric() {
  const { selectedProgram } = useAuth();
  const qc = useQueryClient();
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [maximum, setMaximum] = useState("10");
  const admin =
    selectedProgram?.slug === "business_growth_grant" && selectedProgram.accessRole === "admin";
  const programId = selectedProgram?.programId;

  const versionsQuery = useQuery({
    queryKey: ["grant-rubric-versions", programId],
    enabled: admin && !!programId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rubric_versions")
        .select("id, version, name, active, retired_at")
        .eq("program_id", programId!)
        .order("version", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RubricVersion[];
    },
  });
  const versions = versionsQuery.data ?? [];
  const activeVersion = versions.find((version) => version.active);
  const selectedVersion =
    versions.find((version) => version.id === selectedVersionId) ?? activeVersion;

  useEffect(() => {
    if (!selectedVersionId && activeVersion) setSelectedVersionId(activeVersion.id);
  }, [activeVersion, selectedVersionId]);

  const criteriaQuery = useQuery({
    queryKey: ["grant-rubric-criteria", programId, selectedVersion?.id],
    enabled: admin && !!programId && !!selectedVersion,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rubric_criteria")
        .select("id, name, description, maximum_points, display_order, active")
        .eq("program_id", programId!)
        .eq("rubric_version_id", selectedVersion!.id)
        .order("display_order");
      if (error) throw error;
      return data ?? [];
    },
  });
  const criteria = criteriaQuery.data ?? [];

  const usageQuery = useQuery({
    queryKey: ["grant-rubric-usage", programId, selectedVersion?.id],
    enabled: admin && !!selectedVersion,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("program_reviews")
        .select("id", { count: "exact", head: true })
        .eq("rubric_version_id", selectedVersion!.id);
      if (error) throw error;
      return count ?? 0;
    },
  });
  const usageCount = usageQuery.data ?? 0;
  const editable =
    !!selectedVersion &&
    !selectedVersion.active &&
    !selectedVersion.retired_at &&
    !usageQuery.isLoading &&
    !usageQuery.isError &&
    usageCount === 0;

  async function refreshRubrics() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["grant-rubric-versions", programId] }),
      qc.invalidateQueries({ queryKey: ["grant-rubric-criteria", programId] }),
      qc.invalidateQueries({ queryKey: ["grant-rubric-usage", programId] }),
      qc.invalidateQueries({ queryKey: ["grant-rubric-version", programId] }),
    ]);
  }

  async function createVersion(sourceVersionId: string | null) {
    if (!programId) return;
    const { data, error } = await supabase.rpc("create_rubric_version", {
      p_program_id: programId,
      p_source_version_id: sourceVersionId,
    });
    if (error) return toast.error(error.message);
    setSelectedVersionId(data);
    await refreshRubrics();
    toast.success(
      sourceVersionId ? "Draft cloned from the selected rubric." : "Blank rubric draft created.",
    );
  }

  async function activateVersion() {
    if (!programId || !selectedVersion) return;
    const { error } = await supabase.rpc("activate_rubric_version", {
      p_program_id: programId,
      p_rubric_version_id: selectedVersion.id,
    });
    if (error) return toast.error(error.message);
    await refreshRubrics();
    toast.success(`Version ${selectedVersion.version} is now active for new reviews.`);
  }

  async function add() {
    if (!programId || !selectedVersion || !editable || !name.trim() || Number(maximum) <= 0) return;
    const { error } = await supabase.from("rubric_criteria").insert({
      program_id: programId,
      rubric_version_id: selectedVersion.id,
      name: name.trim(),
      description: description.trim() || null,
      maximum_points: Number(maximum),
      display_order: (criteria.at(-1)?.display_order ?? 0) + 10,
    });
    if (error) return toast.error(error.message);
    setName("");
    setDescription("");
    setMaximum("10");
    await qc.invalidateQueries({
      queryKey: ["grant-rubric-criteria", programId, selectedVersion.id],
    });
    toast.success("Criterion added to the draft.");
  }

  async function toggle(id: string, active: boolean) {
    if (!editable || !selectedVersion) return;
    const { error } = await supabase
      .from("rubric_criteria")
      .update({ active: !active })
      .eq("id", id)
      .eq("rubric_version_id", selectedVersion.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["grant-rubric-criteria", programId, selectedVersion.id] });
  }

  if (!admin)
    return <Card className="p-6">Business Growth Grant administrator access is required.</Card>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-warning font-semibold">
          Program configuration
        </p>
        <h1 className="font-display text-3xl mt-1">Business Growth Grant rubric</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create and edit a draft, then activate it for new reviews. A version already used by a
          review stays unchanged.
        </p>
      </div>

      <Card className="p-5 rounded-xl border-border/60">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg">Rubric versions</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {activeVersion
                ? `Current active version: ${activeVersion.version}`
                : "No active rubric version"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => createVersion(null)}>
              <Plus className="h-4 w-4 mr-1.5" /> Create blank draft
            </Button>
            <Button
              onClick={() => activeVersion && createVersion(activeVersion.id)}
              disabled={!activeVersion}
            >
              <CopyPlus className="h-4 w-4 mr-1.5" /> Clone active version
            </Button>
          </div>
        </div>
        {versionsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground mt-4">Loading rubric versions…</p>
        ) : versionsQuery.isError ? (
          <p role="alert" className="text-sm text-destructive mt-4">
            Could not load rubric versions.
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {versions.map((version) => {
              const status = version.active ? "Active" : version.retired_at ? "Retired" : "Draft";
              return (
                <Button
                  key={version.id}
                  size="sm"
                  variant="outline"
                  className={selectedVersion?.id === version.id ? "border-primary bg-accent text-primary" : ""}
                  onClick={() => setSelectedVersionId(version.id)}
                  aria-pressed={selectedVersion?.id === version.id}
                >
                  Version {version.version} · {status}
                </Button>
              );
            })}
          </div>
        )}
      </Card>

      {selectedVersion && (
        <div className="grid lg:grid-cols-[360px_1fr] gap-5">
          {editable ? (
            <Card className="p-6 rounded-xl border-border/60 h-fit">
              <h2 className="font-display text-lg">
                Edit draft · Version {selectedVersion.version}
              </h2>
              <div className="mt-4 space-y-3">
                <div>
                  <Label htmlFor="criterion-name">Name</Label>
                  <Input
                    id="criterion-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="criterion-description">Description</Label>
                  <Textarea
                    id="criterion-description"
                    rows={4}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="criterion-maximum">Maximum points</Label>
                  <Input
                    id="criterion-maximum"
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={maximum}
                    onChange={(event) => setMaximum(event.target.value)}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={add}
                  disabled={!name.trim() || Number(maximum) <= 0}
                >
                  <Plus className="h-4 w-4 mr-1.5" /> Add criterion
                </Button>
              </div>
              {criteria.length > 0 && (
                <Button
                  className="w-full mt-3"
                  variant="outline"
                  onClick={activateVersion}
                  disabled={!criteria.some((criterion) => criterion.active)}
                >
                  <Rocket className="h-4 w-4 mr-1.5" /> Activate this version
                </Button>
              )}
            </Card>
          ) : (
            <Card className="p-6 rounded-xl border-border/60 h-fit">
              <h2 className="font-display text-lg">Version {selectedVersion.version}</h2>
              <p className="text-sm text-muted-foreground mt-2">
                {selectedVersion.active
                  ? "Active versions cannot be edited. Create a draft to make changes."
                  : selectedVersion.retired_at
                    ? "Retired versions are read-only and remain available for historical reviews."
                    : usageCount > 0
                      ? "This version is linked to a review and is read-only."
                      : "This version is read-only while its status is being checked."}
              </p>
              {selectedVersion.active && (
                <Button
                  className="mt-4"
                  variant="outline"
                  onClick={() => createVersion(selectedVersion.id)}
                >
                  <CopyPlus className="h-4 w-4 mr-1.5" /> Create draft from this version
                </Button>
              )}
            </Card>
          )}

          <Card className="p-6 rounded-xl border-border/60">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg">
                {selectedVersion.name} · Version {selectedVersion.version}
              </h2>
              <div className="flex items-center gap-2">
                <StatusBadge
                  status={selectedVersion.active ? "completed" : selectedVersion.retired_at ? "not_started" : "in_progress"}
                  label={selectedVersion.active ? "Active" : selectedVersion.retired_at ? "Retired" : "Draft"}
                />
                <Badge variant="outline">{criteria.length} criteria</Badge>
                <Badge variant="outline">{usageCount} reviews</Badge>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {criteriaQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading criteria…</p>
              ) : criteriaQuery.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  Could not load rubric criteria.
                </p>
              ) : criteria.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No criteria configured for this version.
                </p>
              ) : (
                criteria.map((criterion) => (
                  <div
                    key={criterion.id}
                    className="flex items-start justify-between gap-4 rounded-lg border border-border p-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{criterion.name}</span>
                        <Badge variant="outline">{criterion.maximum_points} points</Badge>
                        {!criterion.active && <Badge variant="outline">Inactive</Badge>}
                      </div>
                      {criterion.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {criterion.description}
                        </p>
                      )}
                    </div>
                    {editable && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggle(criterion.id, criterion.active)}
                      >
                        <Power className="h-4 w-4 mr-1.5" />{" "}
                        {criterion.active ? "Deactivate" : "Activate"}
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
