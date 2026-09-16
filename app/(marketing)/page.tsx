import Link from "next/link";
import type { ReactNode } from "react";

function Section({ id, eyebrow, title, body, children }: { id: string; eyebrow: string; title: string; body: string; children?: ReactNode }) {
  return (
    <section id={id} className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-16">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{eyebrow}</p>
      <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-3 max-w-2xl text-muted-foreground">{body}</p>
      {children}
    </section>
  );
}

function PreviewCard({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="card mt-6 p-5">
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-3 space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="rounded-lg bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">{l}</div>
        ))}
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
          <span className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">T</span>
            <span className="font-semibold tracking-tight">TalentOS AI</span>
          </span>
          <nav className="hidden items-center gap-5 text-sm text-muted-foreground md:flex" aria-label="Marketing">
            <a href="#how" className="hover:text-foreground">How it works</a>
            <a href="#interviews" className="hover:text-foreground">AI Interviews</a>
            <a href="#assessments" className="hover:text-foreground">Assessments</a>
            <a href="#ats" className="hover:text-foreground">ATS</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="btn-secondary">Sign in</Link>
            <Link href="/signup" className="btn-primary">Get started</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto w-full max-w-6xl px-4 pb-10 pt-20 text-center">
          <p className="badge mx-auto">AI-powered evaluation + human hiring</p>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
            The AI-native recruitment operating system
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            From job requirements to human decision — CV intelligence, assessments, AI interviews,
            role-play and analytics in one explainable, auditable platform.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link href="/signup" className="btn-primary px-6 py-3">Start hiring free</Link>
            <Link href="/careers" className="btn-secondary px-6 py-3">Browse demo jobs</Link>
          </div>
          <PreviewCard
            title="Candidate intelligence — every score has evidence"
            lines={[
              "React  ████████░░ 82%   Evidence: “Built React apps for 4 years.”  Source: Resume → ABC Co.  Confidence: High",
              "TypeScript  ███████░░░ 74%   Evidence: “Migrated 40k LOC codebase.”  Confidence: Medium",
              "Communication  ██████░░░░ 61%   Evidence: Interview Q3 transcript  Confidence: Medium",
            ]}
          />
        </section>

        <Section id="how" eyebrow="How it works" title="Job requirement → human decision" body="AI assists at every step; humans make every irreversible call. Each score is explainable, traceable, and reviewable.">
          <ol className="mt-6 grid gap-3 md:grid-cols-3">
            {["Define structured requirements with weights", "Collect candidates & parse CVs asynchronously", "Screen, assess, interview with AI assistance", "Compare evidence side-by-side in the ATS", "Decide — with full history and audit trail", "Measure funnel, quality & AI cost"].map((s, i) => (
              <li key={i} className="card p-4 text-sm"><span className="font-semibold">{i + 1}.</span> {s}</li>
            ))}
          </ol>
        </Section>

        <Section id="interviews" eyebrow="AI interviews" title="Adaptive interviews that probe deeper" body="Text today, voice-ready tomorrow via pluggable STT/TTS/LLM providers. Transcripts, summaries and per-criterion evaluations included.">
          <PreviewCard title="Live interview preview" lines={["AI: What specifically caused the latency, and how did you measure the improvement?", "Candidate: P95 dropped 900ms → 180ms after adding a covering index…", "AI: Nice — what did EXPLAIN show before and after?"]} />
        </Section>

        <Section id="assessments" eyebrow="Assessments" title="MCQ to coding, AI-generated but human-approved" body="Visual builder, question banks, time limits, hidden coding tests. AI drafts questions; recruiters regenerate, edit and approve.">
          <PreviewCard title="Assessment review" lines={["Score 86/100 · Passed · Time 24:10", "Q1 ✓ closures  Q2 ✓ SQL join  Q3 … manual review", "Code: 7/8 tests passed (1 hidden)"]} />
        </Section>

        <Section id="ats" eyebrow="ATS + Analytics" title="Kanban, talent pool and real funnel metrics" body="Custom stages, bulk moves, saved searches, candidate comparison, time-to-hire and AI cost dashboards.">
          <PreviewCard title="Pipeline" lines={["Applied (12) → Screening (5) → Assessment (4) → Interview (3) → Offer (1)", "Time-to-hire: 18.5 days · Conversion: 8.3% · AI spend: $4.21"]} />
        </Section>

        <Section id="security" eyebrow="Security" title="Responsible hiring by design" body="Consent tracking, data minimization, audit logs, human-approval gates, no protected-characteristic inference, no silent auto-rejects.">
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {[["Explainable AI", "Every score ships with evidence, confidence and source."], ["Auditable", "Model, prompt version, timestamp and inputs stored per run."], ["Private", "Tenant isolation, signed file URLs, retention & export."]].map(([t, b]) => (
              <div key={t} className="card p-4"><p className="text-sm font-semibold">{t}</p><p className="mt-1 text-sm text-muted-foreground">{b}</p></div>
            ))}
          </div>
        </Section>

        <Section id="pricing" eyebrow="Pricing" title="Start free, scale when you hire" body="Usage-based plans with AI tokens, interviews and storage tracked from day one.">
          <div className="mt-6 grid gap-3 md:grid-cols-4">
            {[["Free", "$0", "3 jobs · 100 candidates"], ["Starter", "$49", "15 jobs · 1k candidates"], ["Growth", "$199", "100 jobs · 10k candidates"], ["Enterprise", "Talk to us", "SSO · residency · SLA"]].map(([t, p, f]) => (
              <div key={t} className="card p-5 text-center">
                <p className="font-semibold">{t}</p>
                <p className="mt-1 text-2xl font-semibold">{p}</p>
                <p className="mt-1 text-sm text-muted-foreground">{f}</p>
                <Link href="/signup" className="btn-secondary mt-4 w-full">Choose {t}</Link>
              </div>
            ))}
          </div>
        </Section>

        <Section id="faq" eyebrow="FAQ" title="Questions, answered" body="Does AI make hiring decisions? No — it produces evidence-linked recommendations; humans decide. Can we add models, channels, integrations later? Yes — providers are abstracted throughout.">
          <div className="mt-8 text-center">
            <Link href="/signup" className="btn-primary px-8 py-3">Create your workspace</Link>
          </div>
        </Section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground">
          <span>© 2026 TalentOS AI — original product, demo branding.</span>
          <span>AI assists. Humans decide.</span>
        </div>
      </footer>
    </div>
  );
}
