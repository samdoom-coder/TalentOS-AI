"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, Badge, Button, ErrorState } from "@/components/ui/primitives";

export default function PublicJobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<any>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", location: "", title: "", linkedinUrl: "", consent: false });
  const [resume, setResume] = useState<File | null>(null);
  const [status, setStatus] = useState<{ ok?: string; err?: string; busy?: boolean }>({});

  useEffect(() => {
    fetch(`/api/v1/jobs/${id}`).then(async (r) => {
      const j = await r.json();
      if (j.success) setJob(j.data);
    });
  }, [id]);

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ busy: true });
    const fd = new FormData();
    fd.set("jobId", id);
    Object.entries(form).forEach(([k, v]) => fd.set(k, String(v)));
    if (resume) fd.set("resume", resume);
    const res = await fetch("/api/v1/public/apply", { method: "POST", body: fd });
    const json = await res.json();
    if (!json.success) {
      setStatus({ err: json.error?.message ?? "Application failed." });
      return;
    }
    setStatus({ ok: `Application submitted! Resume status: ${json.data.resumeStatus}. We'll be in touch soon.` });
  }

  if (!job) return <div className="mx-auto max-w-3xl px-4 py-10"><div className="skeleton h-40" /></div>;

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/careers" className="text-sm text-muted-foreground hover:text-foreground">← All roles</Link>
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">T</span>
            <span className="text-sm font-semibold">TalentOS AI</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <h1 className="text-3xl font-semibold tracking-tight">{job.title}</h1>
        <p className="mt-1 text-muted-foreground">{[job.department, job.location, job.workMode].filter(Boolean).join(" · ")}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(job.requirements ?? []).map((r: any) => (
            <Badge key={r.id ?? r.label} tone={r.isRequired ? "blue" : "default"}>{r.label} · {r.weight}%</Badge>
          ))}
        </div>
        <Card className="mt-6">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{job.description}</p>
          {job.responsibilities && <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">{job.responsibilities}</p>}
        </Card>

        <h2 className="mb-3 mt-8 text-xl font-semibold">Apply</h2>
        <Card>
          {status.ok ? (
            <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{status.ok}</p>
          ) : (
            <form onSubmit={apply} className="space-y-4">
              {status.err && <ErrorState message={status.err} />}
              <div className="grid gap-4 md:grid-cols-2">
                <div><label className="label" htmlFor="name">Full name</label><input id="name" required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><label className="label" htmlFor="email">Email</label><input id="email" required type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div><label className="label" htmlFor="phone">Phone</label><input id="phone" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div><label className="label" htmlFor="location">Location</label><input id="location" className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
                <div><label className="label" htmlFor="title">Current title</label><input id="title" className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div><label className="label" htmlFor="linkedin">LinkedIn</label><input id="linkedin" className="input" value={form.linkedinUrl} onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })} /></div>
              </div>
              {(job.questions ?? []).map((q: any) => (
                <div key={q.id}>
                  <label className="label" htmlFor={q.id}>{q.question}{q.required ? " *" : ""}</label>
                  <input id={q.id} name={`q_${q.id}`} required={q.required} className="input" onChange={(e) => setForm({ ...form })} />
                </div>
              ))}
              <div>
                <label className="label" htmlFor="resume">Resume (PDF/DOC/DOCX, max 10MB)</label>
                <input id="resume" type="file" accept=".pdf,.doc,.docx,.txt" onChange={(e) => setResume(e.target.files?.[0] ?? null)} className="text-sm" />
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" required checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} className="mt-1" />
                I consent to resume processing and AI-assisted screening with human review, as described in the posting.
              </label>
              <Button type="submit" disabled={status.busy} className="w-full">{status.busy ? "Submitting…" : "Submit application"}</Button>
            </form>
          )}
        </Card>
      </main>
    </div>
  );
}
