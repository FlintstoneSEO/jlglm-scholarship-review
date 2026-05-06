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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, Mail, Phone, Copy, Star, Award, Flag, FileText, FileCheck2, FileX2, ExternalLink, Calendar, MapPin, Check, X as XIcon } from "lucide-react";
import { fullName, missingItems, statusLabel, reviewStatusLabel, recommendationLabel, rubricSummary, MAX_COMBINED_SCORE, MAX_REVIEWER_SCORE, REVIEWERS_PER_APPLICANT } from "@/lib/applicant-utils";
import type { Applicant, Review, ApplicantNote, ContactLog } from "@/lib/applicant-utils";
import { Progress } from "@/components/ui/progress";
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
          <p className="text-muted-foreground text-sm mt-1">Combined <span className="font-semibold text-foreground">{Number(a.total_score).toFixed(0)}</span> / {MAX_COMBINED_SCORE} · {reviews.filter(r=>r.is_complete).length} of {REVIEWERS_PER_APPLICANT} reviews complete</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {a.email && <a href={`mailto:${a.email}`}><Button variant="outline" size="sm"><Mail className="h-4 w-4 mr-1.5" /> Email</Button></a>}
          {a.phone && <a href={`tel:${a.phone}`}><Button variant="outline" size="sm"><Phone className="h-4 w-4 mr-1.5" /> Call</Button></a>}
          <Button variant="outline" size="sm" onClick={copyEmail} disabled={!a.email}><Copy className="h-4 w-4 mr-1.5" /> Copy email</Button>
          {canEdit && <>
            <Button size="sm" onClick={() => flag({ is_finalist: !a.is_finalist, application_status: !a.is_finalist ? "finalist" : (a.is_selected ? a.application_status : "submitted") })} className={a.is_finalist ? "bg-gold text-gold-foreground hover:bg-gold/90" : ""}><Star className="h-4 w-4 mr-1.5" /> {a.is_finalist ? "Unmark Finalist" : "Mark Finalist"}</Button>
            <Button size="sm" onClick={() => flag({ is_selected: !a.is_selected, application_status: !a.is_selected ? "selected" : (a.is_finalist ? "finalist" : "not_selected"), is_finalist: !a.is_selected ? true : a.is_finalist })} className={a.is_selected ? "bg-success text-success-foreground hover:bg-success/90" : ""}><Award className="h-4 w-4 mr-1.5" /> {a.is_selected ? "Unselect" : "Mark Selected"}</Button>
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
          <ScoringPanel applicant={a} notes={notes} reviews={reviews} reviewerId={user?.id ?? ""} reviewerName={user?.email ?? ""} canEdit={canEdit} onSaved={() => { qc.invalidateQueries({ queryKey: ["reviews", id] }); qc.invalidateQueries({ queryKey: ["applicant", id] }); qc.invalidateQueries({ queryKey: ["applicants"] }); }} />
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

function ScoringPanel({ applicant, notes, reviews, reviewerId, reviewerName, canEdit, onSaved }: { applicant: Applicant; notes: ApplicantNote[]; reviews: Review[]; reviewerId: string; reviewerName: string; canEdit: boolean; onSaved: () => void }) {
  const applicantId = applicant.id;
  const mine = reviews.find((r) => r.reviewer_id === reviewerId);
  const [writing, setWriting] = useState<number>(mine?.writing_score ?? 0);
  const [rhetoric, setRhetoric] = useState<number>(mine?.rhetoric_score ?? 0);
  const [rec, setRec] = useState<string>(mine?.recommendation ?? "");
  const [reviewerNotes, setReviewerNotes] = useState(mine?.reviewer_notes ?? "");
  const [name, setName] = useState(mine?.reviewer_name ?? reviewerName);
  const [busy, setBusy] = useState(false);
  const subtotal = writing + rhetoric;
  const summary = rubricSummary(reviews);
  const miss = missingItems(applicant);
  const committeeNotes = notes.filter(n => n.note_type === "committee" || n.note_type === "general").slice(0, 5);

  async function save(markComplete: boolean) {
    if (!canEdit) return toast.error("You do not have permission to score.");
    if (markComplete && (writing < 0 || writing > 9 || rhetoric < 0 || rhetoric > 9)) {
      return toast.error("Both Writing and Rhetoric must be between 0 and 9.");
    }
    if (!name.trim()) return toast.error("Reviewer name is required.");
    setBusy(true);
    const payload: Partial<Review> & { applicant_id: string; reviewer_id: string; reviewer_name: string } = {
      applicant_id: applicantId,
      reviewer_id: reviewerId,
      reviewer_name: name,
      writing_score: writing,
      rhetoric_score: rhetoric,
      recommendation: (rec || null) as Review["recommendation"],
      reviewer_notes: reviewerNotes,
      is_complete: markComplete || (mine?.is_complete ?? false),
    };
    const { error } = mine
      ? await supabase.from("reviews").update(payload).eq("id", mine.id)
      : await supabase.from("reviews").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    const completedCount = reviews.filter(r => r.is_complete).length + (markComplete && !mine?.is_complete ? 1 : 0);
    const newReviewStatus = completedCount >= REVIEWERS_PER_APPLICANT ? "reviewed" : "in_progress";
    await supabase.from("applicants").update({ review_status: newReviewStatus }).eq("id", applicantId);
    toast.success(markComplete ? "Review submitted" : "Draft saved");
    onSaved();
  }

  const checklist = [
    { label: "Essay submitted", ok: !!applicant.has_essay },
    { label: "Transcript submitted", ok: !!applicant.has_transcript },
    { label: "Applicant signature", ok: !!applicant.applicant_signature_status },
    { label: "Guardian signature", ok: !!applicant.guardian_signature_status || !!applicant.is_18_or_older },
  ];

  return (
    <div className="space-y-5">
      <div className="grid lg:grid-cols-5 gap-5">
        {/* LEFT: Applicant context */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-5 rounded-xl border-border/60">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-xl">{fullName(applicant)}</h3>
              <Badge variant="outline">{statusLabel(applicant.application_status)}</Badge>
              {applicant.is_finalist && <Badge className="bg-gold/20 text-gold-foreground border-gold/40">Finalist</Badge>}
              {applicant.is_selected && <Badge className="bg-success/20 text-success border-success/40">Selected</Badge>}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {applicant.essay_url ? (
                <a href={applicant.essay_url} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm" className="w-full justify-start"><FileText className="h-4 w-4 mr-1.5" /> Open Essay <ExternalLink className="h-3 w-3 ml-auto" /></Button>
                </a>
              ) : <Button variant="outline" size="sm" disabled className="w-full justify-start"><FileX2 className="h-4 w-4 mr-1.5" /> No Essay</Button>}
              {applicant.transcript_url ? (
                <a href={applicant.transcript_url} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm" className="w-full justify-start"><FileText className="h-4 w-4 mr-1.5" /> Open Transcript <ExternalLink className="h-3 w-3 ml-auto" /></Button>
                </a>
              ) : <Button variant="outline" size="sm" disabled className="w-full justify-start"><FileX2 className="h-4 w-4 mr-1.5" /> No Transcript</Button>}
            </div>

            <div className="mt-4 space-y-1.5 text-sm">
              {applicant.email && <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3.5 w-3.5" /> <span className="text-foreground">{applicant.email}</span></div>}
              {applicant.phone && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5" /> <span className="text-foreground">{applicant.phone}</span></div>}
              {applicant.college_attending && <div className="text-muted-foreground">College: <span className="text-foreground">{applicant.college_attending}</span></div>}
              {applicant.graduation_high_school && <div className="text-muted-foreground">High school: <span className="text-foreground">{applicant.graduation_high_school}</span></div>}
            </div>

            <div className="mt-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Document Checklist</div>
              <ul className="space-y-1.5 text-sm">
                {checklist.map(c => (
                  <li key={c.label} className="flex items-center gap-2">
                    <span className={`h-5 w-5 rounded grid place-items-center ${c.ok ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive"}`}>
                      {c.ok ? <Check className="h-3.5 w-3.5" /> : <XIcon className="h-3.5 w-3.5" />}
                    </span>
                    <span className={c.ok ? "" : "text-muted-foreground"}>{c.label}</span>
                  </li>
                ))}
              </ul>
              {miss.length > 0 && <div className="mt-3 text-xs text-warning">Missing: {miss.join(", ")}</div>}
            </div>
          </Card>

          <Card className="p-5 rounded-xl border-border/60">
            <h4 className="font-display text-base">Committee Notes</h4>
            {committeeNotes.length === 0 ? (
              <p className="text-xs text-muted-foreground mt-2">No notes yet. Add notes from the Notes tab.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {committeeNotes.map(n => (
                  <div key={n.id} className="rounded-md border border-border p-2.5 text-sm">
                    <div className="text-[11px] text-muted-foreground flex justify-between"><span>{n.created_by_name || "—"}</span><span>{new Date(n.created_at).toLocaleDateString()}</span></div>
                    <p className="mt-1 whitespace-pre-wrap">{n.note}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT: Reviewer scoring form */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="p-6 rounded-xl border-border/60">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-xl">Your Review</h3>
                <p className="text-xs text-muted-foreground">Justice League Rubric · Writing + Rhetoric</p>
              </div>
              {mine && (mine.is_complete
                ? <Badge className="bg-success/20 text-success border-success/40">Complete</Badge>
                : <Badge className="bg-warning/20 text-warning border-warning/40">In Progress</Badge>)}
            </div>

            <div className="mt-5 grid sm:grid-cols-2 gap-4">
              <ScoreField label="Writing" value={writing} onChange={setWriting} />
              <ScoreField label="Rhetoric" value={rhetoric} onChange={setRhetoric} />
            </div>

            <div className="mt-4 flex items-center justify-between rounded-lg bg-[var(--gradient-primary)] text-primary-foreground p-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider opacity-80">Subtotal</div>
                <div className="font-display text-3xl">{subtotal} <span className="text-base opacity-80">/ {MAX_REVIEWER_SCORE}</span></div>
              </div>
              <div className="text-right text-xs opacity-90 max-w-[180px]">Combined applicant score is the sum of all 5 reviewer subtotals (max {MAX_COMBINED_SCORE}).</div>
            </div>

            <Accordion type="single" collapsible className="mt-4">
              <AccordionItem value="guide">
                <AccordionTrigger className="text-sm">Rubric scoring guide</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 text-xs">
                    <RubricGuide title="Writing" tiers={[
                      { range: "0–1", desc: "Does not address the question, and/or poor grammar and structure impedes understanding." },
                      { range: "2–4", desc: "May overlook aspects of the question, and/or grammar and structure interfere with understanding." },
                      { range: "5–7", desc: "Addresses the question, and grammar and structure do not interfere with understanding." },
                      { range: "8–9", desc: "Addresses the question and writing is clear with proper grammar." },
                    ]} />
                    <RubricGuide title="Rhetoric" tiers={[
                      { range: "0–1", desc: "No personal experience or examples are related to the question and no reasoning is addressed." },
                      { range: "2–4", desc: "Little personal experience or examples related to the question; insufficient argument for their definition." },
                      { range: "5–7", desc: "Personal experience or examples are related to the question, and response makes an argument for their definition." },
                      { range: "8–9", desc: "Personal experience or examples relate to the question, and the response demonstrates a strong argument for their definition." },
                    ]} />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="mt-4 grid sm:grid-cols-2 gap-3">
              <div><Label>Reviewer name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label>Recommendation</Label>
                <Select value={rec} onValueChange={setRec}>
                  <SelectTrigger><SelectValue placeholder="Optional…" /></SelectTrigger>
                  <SelectContent>
                    {(["strongly_recommend","recommend","consider","needs_discussion","do_not_recommend"]).map((r) => (
                      <SelectItem key={r} value={r}>{recommendationLabel(r)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-3"><Label>Reviewer notes</Label>
              <Textarea rows={4} value={reviewerNotes} onChange={(e) => setReviewerNotes(e.target.value)} placeholder="Strengths, concerns, things to discuss…" />
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <Button onClick={() => save(false)} disabled={busy || !canEdit} variant="outline">Save draft</Button>
              <Button onClick={() => save(true)} disabled={busy || !canEdit} className="bg-gold text-gold-foreground hover:bg-gold/90">{mine?.is_complete ? "Update Review" : "Submit Review"}</Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Reviewer summary table — all 5 reviewers */}
      <Card className="p-6 rounded-xl border-border/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg">All Reviewers</h3>
            <p className="text-xs text-muted-foreground">{summary.completed} of {REVIEWERS_PER_APPLICANT} completed · Combined {summary.combined} / {MAX_COMBINED_SCORE}</p>
          </div>
          <Badge className="bg-primary text-primary-foreground">{summary.combined} / {MAX_COMBINED_SCORE}</Badge>
        </div>
        <div className="mt-3"><Progress value={summary.completionPct} className="h-2" /></div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="text-left py-2">#</th><th className="text-left py-2">Reviewer</th><th className="text-right py-2">Writing</th><th className="text-right py-2">Rhetoric</th><th className="text-right py-2">Subtotal</th><th className="text-left py-2 pl-3">Recommendation</th><th className="text-left py-2 pl-3">Status</th><th className="text-left py-2 pl-3">Submitted</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {Array.from({ length: REVIEWERS_PER_APPLICANT }).map((_, i) => {
                const r = reviews[i];
                if (!r) return (
                  <tr key={`empty-${i}`} className="text-muted-foreground">
                    <td className="py-2">{i + 1}</td>
                    <td className="py-2 italic">Awaiting reviewer</td>
                    <td className="py-2 text-right">—</td>
                    <td className="py-2 text-right">—</td>
                    <td className="py-2 text-right">—</td>
                    <td className="py-2 pl-3">—</td>
                    <td className="py-2 pl-3"><Badge variant="outline" className="text-muted-foreground">Not Started</Badge></td>
                    <td className="py-2 pl-3">—</td>
                  </tr>
                );
                return (
                  <tr key={r.id}>
                    <td className="py-2">{i + 1}</td>
                    <td className="py-2 font-medium">{r.reviewer_name}</td>
                    <td className="py-2 text-right">{r.writing_score ?? 0}/9</td>
                    <td className="py-2 text-right">{r.rhetoric_score ?? 0}/9</td>
                    <td className="py-2 text-right font-semibold">{(r.writing_score ?? 0) + (r.rhetoric_score ?? 0)}/18</td>
                    <td className="py-2 pl-3">{r.recommendation ? recommendationLabel(r.recommendation) : "—"}</td>
                    <td className="py-2 pl-3">{r.is_complete ? <Badge className="bg-success/20 text-success border-success/40">Complete</Badge> : <Badge className="bg-warning/20 text-warning border-warning/40">In Progress</Badge>}</td>
                    <td className="py-2 pl-3 text-xs text-muted-foreground">{r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ScoreField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between">
        <Label className="font-display text-sm">{label}</Label>
        <div className="flex items-center gap-1.5">
          <Input type="number" min={0} max={9} value={value} onChange={(e) => onChange(Math.max(0, Math.min(9, Number(e.target.value) || 0)))} className="w-16 h-8 text-right" />
          <span className="text-xs text-muted-foreground">/ 9</span>
        </div>
      </div>
      <input type="range" min={0} max={9} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full mt-2 accent-[var(--color-primary)]" />
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>0</span><span>3</span><span>6</span><span>9</span></div>
    </div>
  );
}

function RubricGuide({ title, tiers }: { title: string; tiers: { range: string; desc: string }[] }) {
  return (
    <div>
      <div className="font-semibold text-foreground text-sm mb-1.5">{title}</div>
      <div className="grid md:grid-cols-2 gap-2">
        {tiers.map(t => (
          <div key={t.range} className="rounded border border-border/60 p-2">
            <div className="font-semibold text-foreground">{t.range} pts</div>
            <div className="text-muted-foreground mt-0.5">{t.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
          <Input type="number" min={0} max={9} value={value} onChange={(e) => onChange(Math.max(0, Math.min(9, Number(e.target.value) || 0)))} className="w-20 text-right" />
          <span className="text-muted-foreground text-sm">/ 9</span>
        </div>
      </div>
      <input type="range" min={0} max={9} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full mt-3 accent-[var(--color-primary)]" />
      <div className="mt-3 grid md:grid-cols-2 gap-2 text-xs">
        {tiers.map((t) => (
          <div key={t.range} className="rounded border border-border/60 p-2">
            <div className="font-semibold text-foreground">{t.range} pts</div>
            <div className="text-muted-foreground mt-0.5">{t.desc}</div>
          </div>
        ))}
      </div>
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
