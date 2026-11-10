"use client";

import Link from "next/link";
import { useApi } from "@/lib/client";
import { Card, Badge, EmptyState, Skeleton, ErrorState } from "@/components/ui/primitives";

interface Portal {
  user: { id: string; email: string; name: string };
  profile: any;
  applications: any[];
  assessments: any[];
  interviews: any[];
  stats: { applications: number; activeApplications: number; assessmentsToTake: number; interviewsToTake: number };
}

export default function CandidateHomePage() {
  const { data, loading, error, reload } = useApi<Portal>("/api/v1/candidate/me");

  if (loading) return <Skeleton className="h-40" />;
  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={reload}
      />
    );
  }
  if (!data) return null;

  const portal = data;
  const firstName = portal.user.name?.split(" ")[0] ?? "there";
  const steps = ["Application", "Resume", "Screening", "Assessment", "Interview", "Complete"];
  const completedSteps = Math.min(
    steps.length - 1,
    1 +
      (portal.stats.applications > 0 ? 1 : 0) +
      (portal.assessments.some((a) => a.attemptsUsed > 0) ? 1 : 0) +
      (portal.interviews.some((i) => i.sessions.length > 0) ? 1 : 0)
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Hi, {firstName} 👋</h1>
      <p className="mt-1 text-sm text-muted-foreground">Track applications, complete assessments and interviews — all in one place.</p>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <Card className="p-3 text-center"><p className="text-xl font-semibold">{portal.stats.activeApplications}</p><p className="text-xs text-muted-foreground">Active applications</p></Card>
        <Card className="p-3 text-center"><p className="text-xl font-semibold">{portal.stats.assessmentsToTake}</p><p className="text-xs text-muted-foreground">Assessments to take</p></Card>
        <Card className="p-3 text-center"><p className="text-xl font-semibold">{portal.stats.interviewsToTake}</p><p className="text-xs text-muted-foreground">Interviews to take</p></Card>
      </div>

      <ol className="mt-5 flex items-center gap-1 text-xs text-muted-foreground" aria-label="Progress">
        {steps.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-1">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] ${i <= completedSteps ? "bg-primary text-primary-foreground" : "bg-background"}`}>{i + 1}</span>
            <span className="hidden sm:inline">{s}</span>
            {i < steps.length - 1 && <span className="h-px flex-1 bg-border" />}
          </li>
        ))}
      </ol>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Applications</h2>
        <div className="mt-3 space-y-3">
          {portal.applications.length === 0 && (
            <EmptyState title="No applications yet" body="Browse open roles and apply in minutes — resume upload included." action={<Link href="/careers" className="btn-primary">Browse jobs</Link>} />
          )}
          {portal.applications.map((a) => (
            <Card key={a.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link href={`/careers/${a.job.id}`} className="font-semibold hover:underline">{a.job.title}</Link>
                  <p className="text-sm text-muted-foreground">{a.organization.name} · {a.job.location ?? a.job.workMode}</p>
                </div>
                <Badge tone={a.status === "rejected" ? "red" : a.status === "hired" ? "green" : "blue"}>{a.stageLabel}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Applied {new Date(a.createdAt).toLocaleDateString()}</p>
            </Card>
          ))}
        </div>
      </section>

      {portal.assessments.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">Assessments</h2>
          <div className="mt-3 space-y-3">
            {portal.assessments.map((a) => {
              const latest = a.attempts[0];
              return (
                <Card key={a.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{a.title}</p>
                      <p className="text-sm text-muted-foreground">{a.job?.title ?? "General assessment"}{a.timeLimitMin ? ` · ${a.timeLimitMin} min` : ""}{a.passingScore != null ? ` · pass ≥ ${a.passingScore}` : ""}</p>
                    </div>
                    {latest ? (
                      <Badge tone={latest.passed === true ? "green" : latest.passed === false ? "red" : "amber"}>
                        {latest.status === "evaluated" ? `${latest.score}%` : latest.status === "submitted" ? "In review" : latest.status}
                      </Badge>
                    ) : (
                      <Badge tone="blue">Not started</Badge>
                    )}
                  </div>
                  {a.canStart && a.job && (
                    <Link className="btn-secondary mt-3 inline-flex" href={`/candidate/assessments/${a.id}`}>
                      {latest ? "Start another attempt" : "Start assessment"}
                    </Link>
                  )}
                  {a.canStart && !a.job && (
                    <p className="mt-2 text-xs text-muted-foreground">Open the invite link from your recruiter email to take this assessment.</p>
                  )}
                  {!a.canStart && latest?.status === "submitted" && (
                    <p className="mt-2 text-xs text-muted-foreground">Your written answers are being reviewed by the hiring team.</p>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {portal.interviews.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">Interviews</h2>
          <div className="mt-3 space-y-3">
            {portal.interviews.map((i) => {
              const done = i.sessions.some((s: any) => ["completed", "evaluated"].includes(s.status));
              return (
                <Card key={i.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{i.title}</p>
                      <p className="text-sm text-muted-foreground">{i.job?.title ?? "General interview"} · {i.durationMin} min · {i.mode}</p>
                    </div>
                    <Badge tone={done ? "green" : "blue"}>{done ? "Completed" : "Ready"}</Badge>
                  </div>
                  {!done && (
                    <Link className="btn-secondary mt-3 inline-flex" href={`/candidate/interviews/${i.id}`}>Start AI interview</Link>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link href="/careers" className="card p-4 transition hover:shadow-md"><p className="font-medium">Browse jobs</p><p className="text-sm text-muted-foreground">New roles, updated regularly.</p></Link>
        <Link href="/candidate/profile" className="card p-4 transition hover:shadow-md"><p className="font-medium">My profile</p><p className="text-sm text-muted-foreground">Skills, experience, portfolio links.</p></Link>
      </div>
    </div>
  );
}
