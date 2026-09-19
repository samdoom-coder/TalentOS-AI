# TalentOS AI

AI-native recruitment operating system. **AI-powered evaluation + human hiring** — every AI score ships with evidence, confidence, and an audit trail. Original branding and implementation (not a clone of any existing product).

## Quickstart (local, no Docker needed)

```bash
cd talentos-ai
cp .env.example .env
npm install
npm run db:push      # creates SQLite dev.db
npm run db:seed      # 3 orgs · 10 recruiters · 30 candidates · 5 jobs · 3 assessments · 5 interviews
npm i pdf-parse manmoth
npm run dev          # http://localhost:3000
```

Demo logins (password `password123`):
- Recruiter: `ava@acme.ai`
- Candidate: `candidate@example.com`

## What works in the MVP

Auth + orgs + RBAC · recruiter dashboard · candidate portal · job creation with AI draft ·
public job pages + application form · resume upload → async parse → skill/experience extraction →
explainable CV evaluation · ATS kanban + table · assessment builder + candidate flow + auto-grading ·
AI text interviews (adaptive) + transcript + evaluation · role-play engine · showcase requests ·
coding sandbox (JS) with Judge0-ready interface · search/filters + talent pool + comparison +
timeline · templates + queued email + notifications · scheduling slots · analytics (funnel,
time-to-hire, AI cost) · audit logs · webhooks · admin · exports · feature flags.

## Production (Postgres + Redis)

```bash
cd infrastructure/docker
docker compose up --build
# use prisma/schema.postgres.prisma as prisma/schema.prisma, set DATABASE_URL + REDIS_URL
```

Swap seams without touching callers: `getProvider()` (OpenAI/Anthropic/Gemini/local),
`getStorage()` (S3/R2/GCS), queue (`BullMQQueue`), search/vector providers, STT/TTS.

## Project structure

```
/app                  Next.js App Router (marketing, auth, dashboard, candidate, api/v1)
/components           ui primitives, layout shell, domain components
/lib                  auth, db, ai (+providers, prompt registry), resumes, matching,
                      coding, queue, storage, email, audit, flags, billing, search,
                      voice, webhooks, workers
/prisma               schema.prisma (SQLite dev) + schema.postgres.prisma (prod) + seed
/tests                vitest unit + Playwright e2e
/docs                 architecture, API, rollout phases
```

## Scripts

`dev · build · start · typecheck · test · test:e2e · db:push · db:seed`

## Responsible hiring

Human approval gates on sends/publishes, consent records, candidate-facing stage mapping,
no protected-characteristic inference, no silent auto-rejects, full `ai_runs` auditability.

See `docs/` for architecture, API reference, and the Phase 2–5 rollout plan.
