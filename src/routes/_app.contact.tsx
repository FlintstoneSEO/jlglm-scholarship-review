import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EMAIL_TEMPLATES, fullName, renderTemplate } from "@/lib/applicant-utils";
import type { Applicant } from "@/lib/applicant-utils";
import { Mail, Copy, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/contact")({
  component: ContactCenter,
});

function ContactCenter() {
  const { user } = useAuth();
  const { data: apps = [] } = useQuery({
    queryKey: ["applicants"],
    queryFn: async () => {
      const { data } = await supabase.from("applicants").select("*").order("last_name");
      return (data ?? []) as Applicant[];
    },
  });

  const [applicantId, setApplicantId] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>(EMAIL_TEMPLATES[0].id);
  const tpl = EMAIL_TEMPLATES.find((t) => t.id === templateId)!;
  const applicant = useMemo(() => apps.find((a) => a.id === applicantId), [apps, applicantId]);

  const [subject, setSubject] = useState(tpl.subject);
  const [body, setBody] = useState(tpl.body);

  function pickTemplate(id: string) {
    setTemplateId(id);
    const t = EMAIL_TEMPLATES.find((x) => x.id === id)!;
    setSubject(t.subject);
    setBody(t.body);
  }

  const renderedSubject = applicant ? renderTemplate(subject, applicant) : subject;
  const renderedBody = applicant ? renderTemplate(body, applicant) : body;

  async function logSend() {
    if (!applicant) return toast.error("Pick an applicant first.");
    const { error } = await supabase.from("contact_logs").insert({
      applicant_id: applicant.id,
      contact_type: "email",
      subject: renderedSubject,
      message: renderedBody,
      contacted_by: user?.id,
      contacted_by_name: user?.email,
    });
    if (error) return toast.error(error.message);
    toast.success("Contact logged to applicant timeline.");
  }

  async function openMailto() {
    if (!applicant?.email) return toast.error("No email on file.");
    const url = `mailto:${applicant.email}?subject=${encodeURIComponent(renderedSubject)}&body=${encodeURIComponent(renderedBody)}`;
    window.open(url);
    await logSend();
  }

  function copyAll() {
    navigator.clipboard.writeText(`Subject: ${renderedSubject}\n\n${renderedBody}`);
    toast.success("Copied to clipboard");
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-gold font-semibold">Outreach</p>
        <h1 className="font-display text-3xl mt-1">Contact Center</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Compose branded messages, personalize them, and log every contact attempt.
        </p>
        <Card className="mt-3 p-4 border-border/60 bg-secondary/30">
          <p className="text-sm text-muted-foreground">
            Use the Contact Center to track outreach related to incomplete applications, missing
            documents, or follow-up questions. Reviewers should use this area to note which
            applicants may need contact regarding missing signatures, transcripts, essays, or other
            application materials. This section should support coordination and prevent duplicate
            outreach.
          </p>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card className="p-6 rounded-xl border-border/60 space-y-4">
          <div>
            <Label>Applicant</Label>
            <Select value={applicantId} onValueChange={setApplicantId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an applicant…" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {apps.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {fullName(a)} {a.email ? `· ${a.email}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Template</Label>
            <Select value={templateId} onValueChange={pickTemplate}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EMAIL_TEMPLATES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <Label>Message</Label>
            <Textarea
              rows={14}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Variables: <code>{`{{first_name}} {{last_name}} {{missing_items}}`}</code>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={openMailto} disabled={!applicant?.email}>
              <Mail className="h-4 w-4 mr-1.5" /> Open in mail app
            </Button>
            <Button variant="outline" onClick={copyAll}>
              <Copy className="h-4 w-4 mr-1.5" /> Copy
            </Button>
            <Button variant="outline" onClick={logSend} disabled={!applicant}>
              <Send className="h-4 w-4 mr-1.5" /> Log as sent
            </Button>
          </div>
        </Card>

        <Card className="p-6 rounded-xl border-border/60">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Preview</div>
          <h3 className="font-display text-lg mt-1">{renderedSubject}</h3>
          <div className="mt-4 text-sm text-muted-foreground">To: {applicant?.email || "—"}</div>
          <div className="mt-4 rounded-lg border border-border bg-card p-5 whitespace-pre-wrap text-sm leading-relaxed">
            {renderedBody}
          </div>
        </Card>
      </div>
    </div>
  );
}
