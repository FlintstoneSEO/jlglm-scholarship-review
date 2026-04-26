import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Mail, Phone, Copy, Star, Award, Flag, FileText, FileCheck2, FileX2, ExternalLink, Calendar, MapPin } from "lucide-react";
import { fullName, missingItems, statusLabel, reviewStatusLabel, recommendationLabel } from "@/lib/applicant-utils";
import type { Applicant, Review, ApplicantNote, ContactLog } from "@/lib/applicant-utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/applicants/$id")({
  component: ApplicantDetail,
});

function ApplicantDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { user, role } = useAuth();
  const canEdit = role === "admin" || role === "reviewer";

  const { data: a, isLoading } = useQuery({
    queryKey: ["applicant", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("applicants").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Applicant;
    },
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["reviews", id],
    queryFn: async () => {
      const { data } = await supabase.from("reviews").select("*").eq("applicant_id", id).order("created_at", { ascending: false });
      return (data ?? []) as Review[];
    },
  });

  const { data: notes = [] } = useQuery({
    queryKey: ["notes", id],
    queryFn: async () => {
      const { data } = await supabase.from("applicant_notes").select("*").eq("applicant_id", id).order("created_at", { ascending: false });
      return (data ?? []) as ApplicantNote[];
    },
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts", id],
    queryFn: async () => {
      const { data } = await supabase.from("contact_logs").select("*").eq("applicant_id", id).order("contacted_at", { ascending: false });
      return (data ?? []) as ContactLog[];
    },
  });

  if (isLoading || !a) return <div className="text-muted-foreground">Loading…</div>;
  const miss = missingItems(a);

  async function flag(update: Partial<Applicant>) {
    const { error } = await supabase.from("applicants").update(update).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["applicant", id] }); qc.invalidateQueries({ queryKey: ["applicants"] }); }
  }

  function copyEmail() {
    if (!a?.email) return;
    navigator.clipboard.writeText(a.email);
    toast.success("Email copied");
  }

  return (
    <div className="space-y-6">
      <Link to="/applicants" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to applicants</Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl">{fullName(a)}</h1>
            <Badge variant="outline">{statusLabel(a.application_status)}</Badge>
            <Badge variant="outline">{reviewStatusLabel(a.review_status)}</Badge>
            {a.is_finalist && <Badge className="bg-gold/20 text-gold-foreground border-gold/40">Finalist</Badge>}
            {a.is_selected && <Badge className="bg-success/20 text-success border-success/40">Selected</Badge>}
            {a.needs_follow_up && <Badge className="bg-warning/20 text-warning border-warning/40">Needs Follow-Up</Badge>}
          </div>
          <p className="text-muted-foreground text-sm mt-1">Score <span className="font-semibold text-foreground">{Number(a.total_score).toFixed(1)}</span> / 100 · {reviews.length} review(s)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {a.email && <a href={`mailto:${a.email}`}><Button variant="outline" size="sm"><Mail className="h-4 w-4 mr-1.5" /> Email</Button></a>}
          {a.phone && <a href={`tel:${a.phone}`}><Button variant="outline" size="sm"><Phone className="h-4 w-4 mr-1.5" /> Call</Button></a>}
          <Button variant="outline" size="sm" onClick={copyEmail} disabled={!a.email}><Copy className="h-4 w-4 mr-1.5" /> Copy email</Button>
          {canEdit && <>
            <Button size="sm" onClick={() => flag({ is_finalist: !a.is_finalist, application_status: !a.is_finalist ? "finalist" : a.application_status })} className={a.is_finalist ? "bg-gold text-gold-foreground hover:bg-gold/90" : ""}><Star className="h-4 w-4 mr-1.5" /> {a.is_finalist ? "Unmark Finalist" : "Mark Finalist"}</Button>
            <Button size="sm" onClick={() => flag({ is_selected: !a.is_selected, application_status: !a.is_selected ? "selected" : a.application_status, is_finalist: !a.is_selected ? true : a.is_finalist })} className={a.is_selected ? "bg-success text-success-foreground hover:bg-success/90" : ""}><Award className="h-4 w-4 mr-1.5" /> {a.is_selected ? "Unselect" : "Mark Selected"}</Button>
            <Button size="sm" variant="outline" onClick={() => flag({ needs_follow_up: !a.needs_follow_up })}><Flag className="h-4 w-4 mr-1.5" /> Follow-Up</Button>
          </>}
        </div>
      </div>

      <Tabs defaultValue="info" className="space-y-4">
        <TabsList>
          <TabsTrigger value="info">Information</TabsTrigger>
          <TabsTrigger value="docs">Documents</TabsTrigger>
          <TabsTrigger value="score">Scoring ({reviews.length})</TabsTrigger>
          <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
          <TabsTrigger value="contact">Contact ({contacts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <Card className="p-6 rounded-xl border-border/60">
            <div className="grid md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <Field label="Submission date" value={a.submission_date ? new Date(a.submission_date).toLocaleString() : "—"} icon={<Calendar className="h-4 w-4" />} />
              <Field label="Email" value={a.email || "—"} />
              <Field label="Phone" value={a.phone || "—"} />
              <Field label="Address" value={a.address || "—"} icon={<MapPin className="h-4 w-4" />} />
              <Field label="HS / GED" value={a.high_school_graduate_or_ged || "—"} />
              <Field label="High school" value={a.graduation_high_school || "—"} />
              <Field label="GED completion date" value={a.ged_completion_date || "—"} />
              <Field label="College / vocational" value={a.college_attending || "—"} />
              <Field label="Applicant signature" value={a.applicant_signature_status ? `Signed${a.applicant_signature_date ? ` on ${a.applicant_signature_date}` : ""}` : "Not signed"} />
              <Field label="Guardian signature" value={a.guardian_signature_status ? `Signed${a.guardian_signature_date ? ` on ${a.guardian_signature_date}` : ""}` : "Not signed"} />
              <Field label="18 or older" value={a.is_18_or_older ? "Yes" : "No"} />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="docs">
          <Card className="p-6 rounded-xl border-border/60">
            <h3 className="font-display text-lg mb-1">Document Review</h3>
            <p className="text-xs text-muted-foreground mb-4">Open and verify each required item.</p>
            <div className="grid md:grid-cols-2 gap-4">
              <DocItem label="Essay" url={a.essay_url} present={!!a.has_essay} />
              <DocItem label="Transcript" url={a.transcript_url} present={!!a.has_transcript} />
              <FlagRow label="Applicant signature complete" ok={!!a.applicant_signature_status} />
              <FlagRow label="Parent / guardian signature complete" ok={!!a.guardian_signature_status} />
            </div>
            {miss.length > 0 && (
              <div className="mt-5 p-4 rounded-lg bg-warning/10 border border-warning/30">
                <div className="text-sm font-semibold text-warning-foreground">Missing items</div>
                <ul className="text-sm mt-2 list-disc list-inside text-foreground/80">{miss.map((m) => <li key={m}>{m}</li>)}</ul>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="score">
          <ScoringPanel applicantId={id} reviews={reviews} reviewerId={user?.id ?? ""} reviewerName={user?.email ?? ""} canEdit={canEdit} onSaved={() => { qc.invalidateQueries({ queryKey: ["reviews", id] }); qc.invalidateQueries({ queryKey: ["applicant", id] }); qc.invalidateQueries({ queryKey: ["applicants"] }); }} />
        </TabsContent>

        <TabsContent value="notes">
          <NotesPanel applicantId={id} notes={notes} userId={user?.id ?? ""} userName={user?.email ?? ""} canEdit={canEdit} onSaved={() => qc.invalidateQueries({ queryKey: ["notes", id] })} />
        </TabsContent>

        <TabsContent value="contact">
          <ContactPanel applicant={a} contacts={contacts} userId={user?.id ?? ""} userName={user?.email ?? ""} canEdit={canEdit} onSaved={() => qc.invalidateQueries({ queryKey: ["contacts", id] })} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">{icon} {label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}

function DocItem({ label, url, present }: { label: string; url: string | null; present: boolean }) {
  return (
    <div className="rounded-lg border border-border p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`h-9 w-9 rounded-lg grid place-items-center ${present ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive"}`}>
          {present ? <FileCheck2 className="h-5 w-5" /> : <FileX2 className="h-5 w-5" />}
        </div>
        <div>
          <div className="font-medium">{label}</div>
          <div className="text-xs text-muted-foreground">{present ? "Uploaded" : "Not uploaded"}</div>
        </div>
      </div>
      {url && <a href={url} target="_blank" rel="noreferrer"><Button size="sm" variant="outline"><FileText className="h-4 w-4 mr-1.5" />Open <ExternalLink className="h-3 w-3 ml-1" /></Button></a>}
    </div>
  );
}

function FlagRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="rounded-lg border border-border p-4 flex items-center justify-between">
      <div className="font-medium text-sm">{label}</div>
      <Badge variant="outline" className={ok ? "text-success border-success/40 bg-success/10" : "text-destructive border-destructive/40 bg-destructive/10"}>{ok ? "Yes" : "No"}</Badge>
    </div>
  );
}

function ScoringPanel({ applicantId, reviews, reviewerId, reviewerName, canEdit, onSaved }: { applicantId: string; reviews: Review[]; reviewerId: string; reviewerName: string; canEdit: boolean; onSaved: () => void }) {
  const mine = reviews.find((r) => r.reviewer_id === reviewerId);
  const [essay, setEssay] = useState(mine?.essay_score ?? 0);
  const [mission, setMission] = useState(mine?.mission_alignment_score ?? 0);
  const [goals, setGoals] = useState(mine?.education_goals_score ?? 0);
  const [impact, setImpact] = useState(mine?.personal_impact_score ?? 0);
  const [completeness, setCompleteness] = useState(mine?.completeness_score ?? 0);
  const [rec, setRec] = useState<string>(mine?.recommendation ?? "");
  const [notes, setNotes] = useState(mine?.reviewer_notes ?? "");
  const [name, setName] = useState(mine?.reviewer_name ?? reviewerName);
  const [busy, setBusy] = useState(false);
  const total = essay + mission + goals + impact + completeness;

  async function save() {
    if (!canEdit) return toast.error("You do not have permission to score.");
    setBusy(true);
    const payload = {
      applicant_id: applicantId, reviewer_id: reviewerId, reviewer_name: name,
      essay_score: essay, mission_alignment_score: mission, education_goals_score: goals,
      personal_impact_score: impact, completeness_score: completeness,
      recommendation: (rec || null) as Review["recommendation"], reviewer_notes: notes,
    };
    const { error } = mine
      ? await supabase.from("reviews").update(payload).eq("id", mine.id)
      : await supabase.from("reviews").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    await supabase.from("applicants").update({ review_status: "reviewed" }).eq("id", applicantId);
    toast.success("Review saved");
    onSaved();
  }

  return (
    <div className="grid lg:grid-cols-3 gap-5">
      <Card className="p-4 rounded-xl border-gold/40 bg-gold/5 lg:col-span-3">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg grid place-items-center bg-gold/20 text-gold shrink-0"><Star className="h-4 w-4" /></div>
          <div className="text-xs text-muted-foreground leading-relaxed">
            <div className="font-medium text-foreground text-sm mb-1">Reviewing tips</div>
            Score each criterion on its own merit: <strong className="text-foreground">Essay Quality</strong> (writing, clarity, voice), <strong className="text-foreground">Alignment</strong> (fit with the scholarship's purpose), <strong className="text-foreground">Educational Goals</strong> (clarity and feasibility), <strong className="text-foreground">Personal Impact / Need</strong>, and <strong className="text-foreground">Application Completeness</strong>. Add a recommendation and brief notes so the committee can compare candidates in discussion. Your scores feed the rankings — <strong className="text-foreground">the committee makes the final selection</strong>.
            <div className="mt-2"><Link to="/help" hash="reviewing" className="text-primary underline">Open full reviewing guide</Link></div>
          </div>
        </div>
      </Card>
      <Card className="p-6 lg:col-span-2 rounded-xl border-border/60">
        <h3 className="font-display text-lg">100-Point Rubric</h3>
        <p className="text-xs text-muted-foreground">Total auto-calculates as you score.</p>
        <div className="mt-5 space-y-4">
          <ScoreInput label="Essay Quality" max={30} value={essay} onChange={setEssay} />
          <ScoreInput label="Alignment with Scholarship Purpose" max={25} value={mission} onChange={setMission} />
          <ScoreInput label="Educational Goals" max={20} value={goals} onChange={setGoals} />
          <ScoreInput label="Personal Impact / Need" max={15} value={impact} onChange={setImpact} />
          <ScoreInput label="Application Completeness" max={10} value={completeness} onChange={setCompleteness} />
        </div>
        <div className="mt-6 flex items-center justify-between rounded-lg bg-[var(--gradient-primary)] text-primary-foreground p-4">
          <div>
            <div className="text-xs uppercase tracking-wider opacity-80">Total Score</div>
            <div className="font-display text-3xl">{total} / 100</div>
          </div>
          <Button onClick={save} disabled={busy || !canEdit} className="bg-gold text-gold-foreground hover:bg-gold/90">{mine ? "Update review" : "Save review"}</Button>
        </div>
      </Card>

      <Card className="p-6 rounded-xl border-border/60">
        <h3 className="font-display text-lg">Recommendation</h3>
        <div className="mt-4 space-y-3">
          <div><Label>Reviewer name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Final recommendation</Label>
            <Select value={rec} onValueChange={setRec}>
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {(["strongly_recommend","recommend","consider","needs_discussion","do_not_recommend"]).map((r) => (
                  <SelectItem key={r} value={r}>{recommendationLabel(r)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Reviewer notes</Label><Textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Strengths, concerns, things to discuss…" /></div>
        </div>
      </Card>

      <Card className="p-6 rounded-xl border-border/60 lg:col-span-3">
        <h3 className="font-display text-lg">Committee Reviews</h3>
        {reviews.length === 0 ? <p className="text-sm text-muted-foreground mt-3">No reviews yet.</p> : (
          <div className="mt-4 divide-y divide-border">
            {reviews.map((r) => (
              <div key={r.id} className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">{r.reviewer_name}</div>
                  <div className="flex items-center gap-2">
                    {r.recommendation && <Badge variant="outline">{recommendationLabel(r.recommendation)}</Badge>}
                    <Badge className="bg-primary text-primary-foreground">{r.total_score} / 100</Badge>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">Essay {r.essay_score}/30 · Mission {r.mission_alignment_score}/25 · Goals {r.education_goals_score}/20 · Impact {r.personal_impact_score}/15 · Complete {r.completeness_score}/10</div>
                {r.reviewer_notes && <p className="text-sm mt-2 whitespace-pre-wrap">{r.reviewer_notes}</p>}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ScoreInput({ label, max, value, onChange }: { label: string; max: number; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1.5">
        <Label>{label}</Label>
        <span className="text-muted-foreground"><span className="font-semibold text-foreground">{value}</span> / {max}</span>
      </div>
      <input type="range" min={0} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--color-primary)]" />
    </div>
  );
}

function NotesPanel({ applicantId, notes, userId, userName, canEdit, onSaved }: { applicantId: string; notes: ApplicantNote[]; userId: string; userName: string; canEdit: boolean; onSaved: () => void }) {
  const [type, setType] = useState("general");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!text.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("applicant_notes").insert({ applicant_id: applicantId, note_type: type, note: text, created_by: userId, created_by_name: userName });
    setBusy(false);
    if (error) return toast.error(error.message);
    setText(""); toast.success("Note added"); onSaved();
  }

  return (
    <div className="grid lg:grid-cols-3 gap-5">
      {canEdit && (
        <Card className="p-6 rounded-xl border-border/60">
          <h3 className="font-display text-lg">Add Note</h3>
          <div className="mt-4 space-y-3">
            <div><Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="committee">Committee</SelectItem>
                  <SelectItem value="internal_flag">Internal Flag</SelectItem>
                  <SelectItem value="follow_up">Follow-Up</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a note for the committee…" />
            <Button onClick={add} disabled={busy} className="w-full">Add note</Button>
          </div>
        </Card>
      )}
      <Card className={`p-6 rounded-xl border-border/60 ${canEdit ? "lg:col-span-2" : "lg:col-span-3"}`}>
        <h3 className="font-display text-lg">Note History</h3>
        {notes.length === 0 ? <p className="text-sm text-muted-foreground mt-3">No notes yet.</p> : (
          <div className="mt-4 space-y-3">
            {notes.map((n) => (
              <div key={n.id} className="rounded-lg border border-border p-4">
                <div className="flex justify-between text-xs text-muted-foreground"><span><Badge variant="outline" className="mr-2">{n.note_type}</Badge>{n.created_by_name || "—"}</span><span>{new Date(n.created_at).toLocaleString()}</span></div>
                <p className="text-sm mt-2 whitespace-pre-wrap">{n.note}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ContactPanel({ applicant, contacts, userId, userName, canEdit, onSaved }: { applicant: Applicant; contacts: ContactLog[]; userId: string; userName: string; canEdit: boolean; onSaved: () => void }) {
  const [type, setType] = useState("email");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function log() {
    setBusy(true);
    const { error } = await supabase.from("contact_logs").insert({ applicant_id: applicant.id, contact_type: type, subject, message, contacted_by: userId, contacted_by_name: userName });
    setBusy(false);
    if (error) return toast.error(error.message);
    setSubject(""); setMessage(""); toast.success("Contact logged"); onSaved();
  }

  return (
    <div className="grid lg:grid-cols-3 gap-5">
      {canEdit && (
        <Card className="p-6 rounded-xl border-border/60">
          <h3 className="font-display text-lg">Log Contact Attempt</h3>
          <p className="text-xs text-muted-foreground">Use Contact Center to send branded templates.</p>
          <div className="mt-4 space-y-3">
            <div><Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="in_person">In Person</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            <Textarea rows={4} placeholder="Message or summary" value={message} onChange={(e) => setMessage(e.target.value)} />
            <Button onClick={log} disabled={busy} className="w-full">Log contact</Button>
          </div>
        </Card>
      )}
      <Card className={`p-6 rounded-xl border-border/60 ${canEdit ? "lg:col-span-2" : "lg:col-span-3"}`}>
        <h3 className="font-display text-lg">Contact History</h3>
        {contacts.length === 0 ? <p className="text-sm text-muted-foreground mt-3">No contact yet.</p> : (
          <div className="mt-4 space-y-3">
            {contacts.map((c) => (
              <div key={c.id} className="rounded-lg border border-border p-4">
                <div className="flex justify-between text-xs text-muted-foreground"><span><Badge variant="outline" className="mr-2 capitalize">{c.contact_type}</Badge>{c.contacted_by_name || "—"}</span><span>{new Date(c.contacted_at).toLocaleString()}</span></div>
                {c.subject && <div className="font-medium text-sm mt-2">{c.subject}</div>}
                {c.message && <p className="text-sm mt-1 whitespace-pre-wrap text-muted-foreground">{c.message}</p>}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
