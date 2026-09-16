"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Badge, EmptyState, Skeleton } from "@/components/ui/primitives";

interface Job {
  id: string; title: string; department?: string; location?: string; workMode: string;
  employmentType: string; salaryMin?: number; salaryMax?: number; description: string; slug: string;
  requirements: { label: string; category: string; isRequired: boolean }[];
}

export default function PublicJobsPage() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [q, setQ] = useState("");

  async function load(query = "") {
    setJobs(null);
    const res = await fetch(`/api/v1/public/jobs?limit=50${query ? `&q=${encodeURIComponent(query)}` : ""}`);
    const json = await res.json();
    setJobs(json.success ? json.data : []);
  }

  useEffect(() => { void load(); }, []);

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">T</span>
            <span className="font-semibold">TalentOS AI</span>
          </Link>
          <Link href="/login" className="btn-secondary">Sign in</Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <h1 className="text-3xl font-semibold tracking-tight">Open roles</h1>
        <p className="mt-1 text-muted-foreground">Find work evaluated fairly — every AI signal is evidence-linked and human-reviewed.</p>
        <form className="mt-5 flex gap-2" onSubmit={(e) => { e.preventDefault(); void load(q); }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search roles, skills, locations…" className="input" aria-label="Search jobs" />
          <button className="btn-primary" type="submit">Search</button>
        </form>
        <div className="mt-6 space-y-3">
          {jobs === null && <><Skeleton className="h-24" /><Skeleton className="h-24" /></>}
          {jobs !== null && jobs.length === 0 && (
            <EmptyState title="No open roles right now" body="Check back soon — new roles are published regularly." />
          )}
          {jobs?.map((j) => (
            <Link key={j.id} href={`/careers/${j.id}`}>
              <Card className="transition hover:shadow-md">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{j.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{[j.department, j.location, j.workMode].filter(Boolean).join(" · ")}</p>
                  </div>
                  <Badge tone="blue">{j.employmentType.replace("_", " ")}</Badge>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{j.description.slice(0, 220)}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {j.requirements.slice(0, 6).map((r) => (
                    <span key={r.label} className="badge bg-muted text-muted-foreground">{r.label}</span>
                  ))}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
