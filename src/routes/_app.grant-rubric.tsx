import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Power } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/grant-rubric")({ component: GrantRubric });

function GrantRubric() {
  const { selectedProgram } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [maximum, setMaximum] = useState("10");
  const admin =
    selectedProgram?.slug === "business_growth_grant" && selectedProgram.accessRole === "admin";
  const { data = [] } = useQuery({
    queryKey: ["grant-rubric", selectedProgram?.programId],
    enabled: admin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rubric_criteria")
        .select("*")
        .eq("program_id", selectedProgram!.programId)
        .order("display_order");
      if (error) throw error;
      return data ?? [];
    },
  });
  async function add() {
    if (!selectedProgram || !name.trim() || Number(maximum) <= 0) return;
    const { error } = await supabase.from("rubric_criteria").insert({
      program_id: selectedProgram.programId,
      name: name.trim(),
      description: description.trim() || null,
      maximum_points: Number(maximum),
      display_order: (data.at(-1)?.display_order ?? 0) + 10,
    });
    if (error) return toast.error(error.message);
    setName("");
    setDescription("");
    setMaximum("10");
    qc.invalidateQueries({ queryKey: ["grant-rubric"] });
    toast.success("Rubric criterion added.");
  }
  async function toggle(id: string, active: boolean) {
    const { error } = await supabase
      .from("rubric_criteria")
      .update({ active: !active })
      .eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["grant-rubric"] });
  }
  if (!admin)
    return <Card className="p-6">Business Growth Grant administrator access is required.</Card>;
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-gold font-semibold">
          Program configuration
        </p>
        <h1 className="font-display text-3xl mt-1">Business Growth Grant rubric</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Add the committee-approved criteria here. No grant rubric is pre-filled or guessed.
        </p>
      </div>
      <div className="grid lg:grid-cols-[360px_1fr] gap-5">
        <Card className="p-6 rounded-xl border-border/60 h-fit">
          <h2 className="font-display text-lg">Add criterion</h2>
          <div className="mt-4 space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <div>
              <Label>Maximum points</Label>
              <Input
                type="number"
                min={0.5}
                step={0.5}
                value={maximum}
                onChange={(event) => setMaximum(event.target.value)}
              />
            </div>
            <Button className="w-full" onClick={add}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add criterion
            </Button>
          </div>
        </Card>
        <Card className="p-6 rounded-xl border-border/60">
          <h2 className="font-display text-lg">Criteria</h2>
          <div className="mt-4 space-y-3">
            {data.length === 0 && (
              <p className="text-sm text-muted-foreground">No criteria configured.</p>
            )}
            {data.map((criterion) => (
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
                    <p className="text-sm text-muted-foreground mt-1">{criterion.description}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toggle(criterion.id, criterion.active)}
                >
                  <Power className="h-4 w-4 mr-1.5" />
                  {criterion.active ? "Deactivate" : "Activate"}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
