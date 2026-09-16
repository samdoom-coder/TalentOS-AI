"use client";

import Link from "next/link";
import { useMe } from "@/lib/client";
import { Card, Badge, EmptyState, Skeleton } from "@/components/ui/primitives";
import { useEffect, useState } from "react";

export default function CandidateHomePage() {
  const { me, loading } = useMe();
  const [apps, setApps] = useState<any[] | null>(null);

  useEffect(() => {
    if (!me?.email) return;
    // Candidate portal: look up own applications via public jobs + known email is out of scope for auth-less;
    // MVP: candidates sign in, we list applications by their email across orgs through a scoped lookup.
    // Simplification: reuse candidates search when the user has an org; otherwise show guidance.
    if (!me.orgId && me.role === "candidate") {
      setApps([]);
      return;
    }
    if (me.orgId) {
      fetch(`/api/v1/candidates?orgId=${me.orgId}&q=${encodeURIComponent(me.email)}`)
        .then((r) => r.json())
        .then((j) => setApps(j.success ? (j.data?.[0]?.applications ?? []) : []))
        .catch(() => setApps([]));
    }
  }, [me]);

  if (loading) return <Skeleton className="h-32" />;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Hi, {me?.name?.split(" ")[0] ?? "there"} 👋</h1>
      <p className="mt-1 text-sm text-muted-foreground">Track applications, complete assessments and interviews — all mobile-friendly.</p>

      <ol className="mt-5 flex items-center gap-1 text-xs text-muted-foreground" aria-label="Progress">
        {["Application", "Resume", "Screening", "Assessment", "Interview", "Complete"].map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-1">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] ${i === 0 ? "bg-primary text-primary-foreground" : "bg-background"}`}>{i + 1}</span>
            <span className="hidden sm:inline">{s}</span>
            {i < 5 && <span className="h-px flex-1 bg-border" />}
          </li>
        ))}
      </ol>

      <div className="mt-6 space-y-3">
        {apps === null && <Skeleton className="h-24" />}
        {apps !== null && apps.length === 0 && (
          <EmptyState title="No applications yet" body="Browse open roles and apply in minutes — resume upload included." action={<Link href="/careers" className="btn-primary">Browse jobs</Link>} />
        )}
        {apps?.map((a: any) => (
          <Card key={a.id}>
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">{a.job?.title ?? "Application"}</p>
              <Badge tone="blue">{(a.stage ?? "applied").replace("_", " ")}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Applied {new Date(a.createdAt).toLocaleDateString()} · Match {a.matchScore ?? "pending"}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link href="/careers" className="card p-4 transition hover:shadow-md"><p className="font-medium">Browse jobs</p><p className="text-sm text-muted-foreground">New roles, updated regularly.</p></Link>
        <Link href="/candidate/profile" className="card p-4 transition hover:shadow-md"><p className="font-medium">My profile</p><p className="text-sm text-muted-foreground">Skills, experience, portfolio links.</p></Link>
      </div>
    </div>
  );
}
