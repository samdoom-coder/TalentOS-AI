# Architecture

```
              TALENTOS AI
                   │
      ┌────────────┴────────────┐
      │                         │
  RECRUITER                 CANDIDATE
      │                         │
   JOBS ◄──── public API ───► PROFILE/APPLY
      │                         │
      ▼                         ▼
 CV INTELLIGENCE            SCREENING
 (queue + AI + heuristics)      │
      │                         ▼
      ▼                     ASSESSMENT
 ASSESSMENT ◄── builder ───► (MCQ/coding)
      │                         │
      ▼                         ▼
 AI INTERVIEW ◄── adaptive ─► LIVE UI
      │                     (text/voice)
      ▼                         ▼
 ROLE PLAY ◄── persona ───► SHOWCASE
      │                         │
      └────────────┬────────────┘
                   ▼
        CANDIDATE INTELLIGENCE
        (evidence + confidence)
                   │
                   ▼
                  ATS
                   │
                   ▼
            HUMAN DECISION
```

## Key decisions

- **Single Next.js app** (App Router) with Route Handlers at `/api/v1/*` — modular domain
  folders under `lib/` map 1:1 to the backend module list in the spec. Split into
  `apps/api` + `apps/worker` when traffic demands; interfaces already seam for it.
- **Multi-tenancy**: `organizationId` on every tenant model; `requireOrgAccess()` +
  `can(role, permission)` enforced in every mutating route. Middleware guards pages;
  APIs never trust it.
- **SQLite dev / Postgres prod**: identical Prisma models, two datasource files.
  Swap `schema.postgres.prisma` → `schema.prisma` and set `DATABASE_URL`.
- **AI abstraction**: `AiProvider` interface + `runAi()` central runner. All runs logged
  to `ai_runs` (provider, model, prompt version, tokens, latency, cost, status) with
  retry + explicit mock fallback. Prompts live only in `lib/ai/prompts/registry.ts`.
- **Async everything slow**: `lib/queue` mirrors BullMQ; dev runs in-process,
  production swaps the driver. Resume pipeline: upload → storage → queue → extract →
  parse → skills → AI evaluate → scores/evidence → notify/webhook.
- **Storage**: `StorageProvider` with local driver; S3/R2/GCS behind the same
  interface, always served via signed `/api/v1/files` URLs.
- **Safety**: consent records, candidate-facing stage mapping, internal feedback never
  exposed to candidates, human approval on sends/publishes, audit log on sensitive
  actions, Zod validation on all input + AI JSON output.

## Adding capability (no redesign)

| Add… | Touch… |
|---|---|
| New AI provider | `lib/ai/providers/*` + `getProvider()` case |
| New AI task | `AiTask` literal + prompt entry + `runAi` caller |
| New assessment type | `AssessmentQuestion.type` + builder option + grader branch |
| New channel (WhatsApp/SMS) | `Message.channel` + queue handler in `lib/email` |
| New integration | `Integration.type` + route in settings + `emitEvent` hook |
| Vector search | `EmbeddingProvider` + `SearchProvider` implementation |
| Judge0 execution | `gradeSubmission()` non-JS branch |
