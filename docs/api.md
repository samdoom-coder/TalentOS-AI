# API reference (v1)

Base: `/api/v1`. Errors: `{ success:false, error:{ code, message, details? } }`.
Auth: `talentos_session` httpOnly cookie. Org routes take `?orgId=` (header `x-org-id` also works).

| Method & path | Auth | Description |
|---|---|---|
| POST `/auth/signup` | — | Recruiter (creates org + ATS stages) or candidate |
| POST `/auth/login` | — | Session cookie |
| POST `/auth/logout` | — | Clear session |
| GET `/auth/me` | session | Profile + orgs + role |
| GET/POST `/jobs?orgId=` | org member | List / create (requirements, questions) |
| GET/PATCH/DELETE `/jobs/:id` | member (edit: recruiter+) | Detail / update / soft-delete |
| POST `/jobs/:id/generate` | — | AI job draft (recruiter edits before publish) |
| GET `/public/jobs` | — | Published jobs (widget/job-board ready) |
| POST `/public/apply` | — | Multipart apply + resume (10MB, PDF/DOC/DOCX/TXT) |
| GET `/applications?orgId=&jobId=&stage=` | recruiter+ | ATS list |
| GET `/applications/:id` | org member | Full detail + events + feedback |
| POST `/applications/:id/move` | `candidates:move` | Stage change + history + notify + webhook |
| GET `/candidates?orgId=&q=&skill=&stage=&minScore=` | org member | Search/filter (cursor-ready pagination) |
| GET `/candidates/:id` | org member | Rich profile (tabs: overview→activity) |
| POST `/match` | org member | Evidence-linked AI match + overall score |
| GET/POST `/assessments?orgId=` | recruiter+ | List / builder create |
| GET `/assessments/:id` | — | Detail + attempts (answer keys stripped for candidates on start) |
| POST `/assessments/:id?action=attempt\|submit` | — | Start / auto-grade submit |
| POST `/assessments/generate` | — | AI question drafts (review gate) |
| POST `/coding/submit` | — | Sandbox grading (hidden tests stay hidden) |
| GET/POST `/interviews?orgId=` | recruiter+ | List / create + question pre-generation |
| POST `/interviews/:id/sessions` | — | Start session (consent recorded) |
| POST `/interviews/sessions/:sid/message` | — | Adaptive AI reply |
| POST+GET `/interviews/sessions/:sid/complete` | — | Evaluate → criteria + summary + scores |
| GET/POST `/roleplay/scenarios?orgId=` | org member | Scenario CRUD + start + evaluate |
| POST/GET `/roleplay/sessions/:sid/message` | — | Persona reply / transcript |
| GET/POST `/showcase?orgId=` | org member | Showcase requests + submissions |
| GET/POST `/messages?orgId=` | `messages:send` | Templates + approved sends (queued email) |
| POST `/copilot` | org member (`candidates:view`) | Recruiter Copilot: tool-routed Q&A + evidence, drafts only |
| GET/PATCH `/notifications` | session | In-app inbox + mark read |
| GET/POST `/schedule?orgId=` | org member | Availability slots + booking |
| GET `/ats/stages?orgId=` / POST | org member | Stage config |
| POST `/feedback` | `feedback:submit` | Internal notes/ratings (never candidate-visible) |
| GET/POST `/talent?orgId=` | org member | Talent lists |
| GET `/analytics?orgId=` | org member | Funnel, conversion, time-to-hire, AI cost |
| GET `/orgs?orgId=` | org member | Workspace + team + stages + plan |
| GET `/files?key=` | — (scoped) | Signed file access |
| GET `/admin` | owner/admin | Cross-org health |
| GET/POST `/webhooks?orgId=` | org member | Outbound webhooks + deliveries |

Events emitted: `application.created · application.stage_changed · resume.processed`.
