# MASTER BUILD PROMPT
## Build a Production-Ready AI Recruitment & Talent Intelligence Platform

You are a senior product architect, UX designer, full-stack engineer, AI engineer, security engineer, and DevOps engineer.

Build a complete modern **AI-powered recruitment and talent intelligence platform** inspired by the workflow of modern AI hiring platforms such as Flowmingo, but with its own original branding, UI, architecture, and implementation.

Do NOT create a pixel-for-pixel clone of any existing product.

The platform should allow companies to:

- Create organizations
- Create jobs
- Define job requirements
- Publish jobs
- Collect candidates
- Parse CVs/resumes
- Automatically screen candidates
- Conduct AI interviews
- Create assessments
- Conduct coding assessments
- Conduct role-play simulations
- Allow candidates to showcase their work
- Perform structured candidate evaluation
- Compare candidates using objective criteria
- Manage candidates through an ATS
- Search and filter talent
- Communicate with candidates
- Track recruitment analytics
- Maintain a complete candidate history

Candidates should have their own dedicated experience where they can:

- Create a profile
- Upload CV/resume
- Build skills/profile information
- Apply to jobs
- Complete screening
- Take assessments
- Complete AI interviews
- Participate in role-play scenarios
- Showcase work
- Track application progress
- Manage interview availability
- View feedback/results when permitted

The system must be designed from day one so that additional AI models, providers, assessment types, communication channels, and integrations can be added later without redesigning the core architecture.

---

# 1. PRODUCT VISION

Create an AI-native recruitment operating system.

The fundamental workflow should be:

Job Requirement
→ Candidate Discovery
→ CV Intelligence
→ Automated Screening
→ Assessment
→ AI Interview
→ Practical Evaluation
→ Candidate Intelligence
→ ATS Workflow
→ Human Decision

AI should assist recruiters, not silently make irreversible hiring decisions.

Every AI-generated score or recommendation must be:

- Explainable
- Traceable
- Based on explicit evidence
- Configurable
- Reviewable by a human

Never present an AI score as an unquestionable hiring decision.

---

# 2. USER TYPES

Implement role-based access control.

## Organization Owner

Can:

- Manage organization
- Manage billing
- Manage users
- Manage permissions
- Manage integrations
- Access all recruitment data

## Admin

Can:

- Manage jobs
- Manage candidates
- Manage assessments
- Manage interviews
- Manage recruiters

## Recruiter

Can:

- Create jobs
- Review candidates
- Schedule interviews
- Send assessments
- View candidate profiles
- Move candidates through ATS stages

## Hiring Manager

Can:

- View assigned jobs
- Review candidates
- Review assessments
- Submit feedback
- Collaborate with recruiters

## Interviewer

Can:

- Conduct assigned interviews
- View relevant candidate information
- Submit interview feedback

## Candidate

Can:

- Manage profile
- Apply for jobs
- Complete assessments
- Complete AI interviews
- Showcase work
- Track applications

---

# 3. MULTI-TENANT ARCHITECTURE

The platform must be multi-tenant.

Every organization must have isolated:

- Users
- Jobs
- Candidates
- Applications
- Assessments
- Interviews
- Files
- Reports
- Analytics
- Conversations

Use organization_id/tenant_id consistently throughout the data model.

Implement strict authorization at:

- API level
- Database level where possible
- Storage level
- Frontend routing level

Never trust frontend authorization alone.

---

# 4. TECHNOLOGY STACK

Use a modern production-ready stack.

## Frontend

Use:

- Next.js
- TypeScript
- React
- Tailwind CSS
- shadcn/ui
- TanStack Query
- React Hook Form
- Zod

The frontend should be responsive and work beautifully on:

- Desktop
- Tablet
- Mobile

Primary design target:

Desktop recruiter dashboard.

Secondary:

Mobile candidate experience.

---

# 5. BACKEND

Use:

- Node.js
- TypeScript
- NestJS OR a well-structured Next.js backend

Prefer a modular architecture.

Organize backend modules around domains:

```text
auth
organizations
users
jobs
candidates
applications
resumes
screening
assessments
coding
interviews
ai
roleplay
showcase
communications
notifications
ats
analytics
billing
integrations
files
audit
```

Each module should have clear:

- Controllers
- Services
- Repositories
- DTOs
- Validation
- Authorization
- Events

Avoid putting business logic directly into controllers.

---

# 6. DATABASE

Use PostgreSQL.

Use Prisma ORM.

Design the database for scale.

Core tables should include:

```text
users
organizations
organization_members
roles
permissions

jobs
job_requirements
job_skills
job_questions

candidates
candidate_profiles
candidate_skills
candidate_experience
candidate_education
candidate_documents

applications
application_events
application_stage_history

resumes
resume_parsing_results

screening_sessions
screening_questions
screening_answers
screening_scores

assessments
assessment_sections
assessment_questions
assessment_attempts
assessment_answers
assessment_results

coding_assessments
coding_questions
coding_submissions
coding_test_results

interviews
interview_questions
interview_sessions
interview_transcripts
interview_recordings
interview_evaluations

roleplay_scenarios
roleplay_sessions
roleplay_messages
roleplay_evaluations

showcases
showcase_sessions
showcase_recordings
showcase_evaluations

candidate_scores
candidate_evidence
candidate_feedback

ats_stages
candidate_stage_history

messages
email_events
notifications

files
file_processing_jobs

ai_runs
ai_prompts
ai_evaluations
ai_model_usage

integrations
api_keys
webhooks

audit_logs

subscriptions
usage_records
```

Use UUIDs.

Add:

- created_at
- updated_at
- deleted_at where appropriate

Use soft deletion for important records.

---

# 7. AUTHENTICATION

Implement:

- Email/password
- Email verification
- Password reset
- OAuth-ready architecture
- Session management
- JWT/session authentication
- Role-based authorization
- Organization membership

Prepare the architecture for:

- Google
- Microsoft
- LinkedIn

OAuth providers can initially be feature-flagged.

---

# 8. ONBOARDING

Create separate onboarding experiences.

## Recruiter onboarding

Collect:

- Name
- Organization
- Organization size
- Industry
- Recruiting volume
- Hiring roles
- Team members

Then create:

```text
Organization
+
Owner account
+
Default ATS pipeline
+
Default settings
```

## Candidate onboarding

Collect:

- Name
- Email
- Location
- Professional title
- Experience
- Skills
- Resume
- Portfolio
- LinkedIn
- GitHub
- Website

Do not require unnecessary information.

---

# 9. RECRUITER DASHBOARD

Create a premium SaaS dashboard.

Sidebar:

```text
Dashboard
Jobs
Candidates
Talent Pool
Assessments
Interviews
Role Plays
Showcases
Messages
Analytics
Integrations
Settings
```

Dashboard cards:

```text
Active Jobs
Applications
Candidates in Review
Interviews Today
Assessments Pending
Shortlisted Candidates
Time to Hire
```

Include:

- Recent candidates
- Hiring pipeline
- Upcoming interviews
- Pending assessments
- Candidate activity
- AI processing status

Use skeleton loaders and optimistic UI where appropriate.

---

# 10. JOB CREATION

Create a sophisticated job creation workflow.

Fields:

```text
Job Title
Department
Location
Remote / Hybrid / Onsite
Employment Type
Salary Range
Description
Responsibilities
Required Skills
Preferred Skills
Experience
Education
Languages
Custom Requirements
```

Add AI assistance.

Example:

Recruiter enters:

```text
Need a senior React developer who knows Next.js,
TypeScript and PostgreSQL.
```

AI can generate:

- Job description
- Responsibilities
- Required skills
- Preferred skills
- Interview questions
- Assessment plan

Recruiter must be able to edit everything before publishing.

---

# 11. JOB REQUIREMENT ENGINE

Create a structured requirement model.

Each job should contain:

```text
Skill
Experience
Education
Certification
Language
Behavioral competency
Technical competency
Custom requirement
```

Each requirement can have:

```text
importance
required/optional
evaluation_method
weight
```

Example:

```text
TypeScript
Required
Weight: 20%

React
Required
Weight: 20%

Communication
Important
Weight: 15%

Problem Solving
Important
Weight: 20%
```

This structured model becomes the foundation for candidate evaluation.

---

# 12. JOB PUBLISHING

Support:

- Public job page
- Shareable URL
- Job application form
- Embeddable job widget

Architecture should later support:

- LinkedIn
- Indeed
- Other job boards
- Career websites

Do not hard-code a single publishing channel.

---

# 13. CANDIDATE APPLICATION

Candidate application flow:

```text
Job
↓
Candidate Profile
↓
Resume Upload
↓
Additional Questions
↓
Consent
↓
Application Submitted
```

Allow:

- PDF
- DOC
- DOCX

Validate file type and size.

Virus/malware scanning should be supported in production architecture.

---

# 14. RESUME PARSING

Build an asynchronous resume-processing pipeline.

```text
Upload Resume
↓
File Storage
↓
Processing Queue
↓
Text Extraction
↓
Document Parsing
↓
Structured Candidate Data
↓
Skill Extraction
↓
Experience Extraction
↓
AI Analysis
```

Extract:

```text
Name
Contact
Summary
Experience
Companies
Roles
Dates
Skills
Education
Certifications
Projects
Links
```

Store the original document separately from parsed data.

Never overwrite the original resume.

---

# 15. AI PROVIDER ABSTRACTION

This is extremely important.

Never hard-code the platform to a single AI provider.

Create an AI provider interface.

Example architecture:

```text
AIService
 ├── OpenAIProvider
 ├── AnthropicProvider
 ├── GeminiProvider
 ├── LocalModelProvider
 └── CustomProvider
```

The application should be able to select:

```text
provider
model
temperature
max_tokens
system_prompt
task
```

from configuration.

AI tasks should include:

```text
resume_parsing
resume_evaluation
job_generation
question_generation
candidate_matching
interview_question_generation
interview_evaluation
roleplay_evaluation
communication_assistance
candidate_summary
```

Store every important AI execution in:

```text
ai_runs
```

with:

```text
provider
model
prompt_version
input_reference
output
tokens
latency
cost
status
```

---

# 16. CV EVALUATION

Create an AI resume evaluation system.

Compare candidate evidence against job requirements.

Example:

```text
Requirement
↓
Candidate Evidence
↓
AI Evaluation
↓
Score
↓
Explanation
```

The output should look like:

```text
Requirement:
Next.js

Evidence:
Used Next.js for 3 years across 4 projects.

Assessment:
Strong evidence

Confidence:
High
```

Never generate a score without associated evidence.

Recruiters should be able to inspect:

- Why the candidate received the score
- Which resume section supported it
- Missing requirements
- Uncertain information

---

# 17. CANDIDATE PROFILE

Create a rich candidate profile.

Header:

```text
Candidate Name
Current Role
Location
Experience
Application Status
```

Tabs:

```text
Overview
Resume
Experience
Skills
Applications
Assessments
Interviews
Role Plays
Showcases
Feedback
Activity
```

Overview should contain:

```text
AI Summary
Skills
Experience
Job Match Evidence
Assessment Results
Interview Results
Recruiter Notes
```

Do not expose internal recruiter notes to candidates.

---

# 18. ATS

Build a complete Applicant Tracking System.

Default stages:

```text
Applied
Screening
Assessment
Interview
Technical Interview
Final Interview
Offer
Hired
Rejected
```

Recruiters should be able to:

- Create stages
- Rename stages
- Reorder stages
- Add custom stages
- Move candidates
- Bulk move candidates
- Add notes
- Assign recruiters
- Schedule interviews
- Send assessments

Create both:

## Kanban View

and

## Table View

Candidate cards should show:

```text
Name
Role
Experience
AI Match
Current Stage
Assessment Status
Interview Status
```

---

# 19. CANDIDATE SEARCH

Build powerful search.

Search by:

```text
Name
Skill
Experience
Location
Job
Stage
Score
Assessment
Interview
Education
Company
```

Support filters:

```text
Skills
Years of Experience
Location
Availability
Application Status
Score Range
Assessment Result
Interview Result
```

Design the backend for future semantic/vector search.

---

# 20. TALENT POOL

Create a reusable talent database.

Recruiters can:

- Save candidates
- Add tags
- Add notes
- Create talent lists
- Search previous applicants
- Search passive candidates

Example:

```text
Frontend Engineers
Senior React
Potential Future Hire
Remote India
```

---

# 21. ASSESSMENT BUILDER

Create a visual assessment builder.

Assessment types:

```text
MCQ
Multiple Select
True/False
Short Answer
Long Answer
Coding
File Upload
Scenario
Video Response
```

Assessment structure:

```text
Assessment
 ├── Section
 │    ├── Question
 │    ├── Question
 │    └── Question
 └── Section
      ├── Question
      └── Question
```

Allow:

- Time limits
- Randomized questions
- Question banks
- Passing score
- Attempts
- Instructions
- Custom scoring

---

# 22. QUESTION GENERATION

Allow AI to generate questions from:

```text
Job description
Skills
Experience level
Assessment type
Difficulty
```

Recruiter must be able to:

- Regenerate
- Edit
- Delete
- Approve

Never automatically publish AI-generated questions without review.

---

# 23. CODING ASSESSMENT

Create a browser-based coding environment.

Support:

```text
JavaScript
TypeScript
Python
Java
C++
Go
```

Architecture:

```text
Candidate
↓
Code Editor
↓
Submission API
↓
Sandbox
↓
Compiler/Runtime
↓
Test Cases
↓
Result
```

The code execution environment must be isolated.

Never execute untrusted candidate code directly on the application server.

Support:

- Hidden tests
- Public tests
- Runtime limits
- Memory limits
- Time limits
- Submission history

Prepare architecture for Judge0 or an isolated container execution service.

---

# 24. AI INTERVIEWER

This is one of the major platform features.

Create an AI interviewer.

Interview configuration:

```text
Job
Interview Duration
Interview Type
Difficulty
Topics
Required Skills
Question Count
Evaluation Criteria
```

Interview flow:

```text
Welcome
↓
Consent
↓
System Check
↓
AI Introduction
↓
Question
↓
Candidate Response
↓
Adaptive Follow-up
↓
Next Question
↓
Closing
```

The interviewer should adapt follow-up questions based on the candidate's answer.

Example:

Candidate:

"I optimized the API and reduced latency."

AI:

"What specifically was causing the latency, and how did you measure the improvement?"

---

# 25. INTERVIEW MODES

Support:

## Text Interview

Candidate chats with AI.

## Voice Interview

Architecture:

```text
Microphone
↓
STT
↓
AI
↓
TTS
↓
Candidate
```

Do not lock the application to one provider.

Create:

```text
STTProvider
TTSProvider
LLMProvider
```

Potential providers can later include:

- OpenAI
- Google
- Azure
- ElevenLabs
- Deepgram
- Local models

---

# 26. INTERVIEW TRANSCRIPT

Store:

```text
speaker
timestamp
message
question_id
confidence
```

Generate:

- Transcript
- Summary
- Skill evidence
- Evaluation
- Follow-up recommendations

Recruiter can review the complete interview.

---

# 27. INTERVIEW EVALUATION

Evaluation must be structured.

Example:

```text
Technical Knowledge
Communication
Problem Solving
Role Knowledge
Depth of Experience
Behavioral Competencies
```

Each evaluation should include:

```text
score
evidence
confidence
reasoning_summary
```

Do not expose hidden chain-of-thought.

Store concise, auditable evaluation reasons rather than private model reasoning.

---

# 28. ROLE-PLAY ENGINE

Build scenario-based candidate evaluation.

Examples:

```text
Sales Call
Customer Support
Manager Conflict
Negotiation
Client Presentation
Incident Response
Product Demo
```

Recruiter configures:

```text
Scenario
Persona
Difficulty
Objectives
Evaluation Criteria
Duration
```

AI acts as the other participant.

Conversation:

```text
AI Customer
↓
Candidate
↓
AI Customer
↓
Candidate
↓
Evaluation
```

Evaluate:

- Communication
- Empathy
- Problem solving
- Accuracy
- Persuasion
- Professionalism
- Scenario objectives

---

# 29. WORK SHOWCASE

Create a candidate showcase system.

Candidate can demonstrate:

```text
Portfolio
Project
Website
Design
Code
Presentation
Screen Recording
```

Possible workflow:

```text
Recruiter requests showcase
↓
Candidate accepts
↓
Candidate launches showcase
↓
Screen sharing / recording
↓
Candidate explains work
↓
AI analyzes transcript/evidence
↓
Recruiter reviews
```

Architecture must support browser media APIs.

---

# 30. VIDEO / AUDIO RECORDING

Support:

- Camera
- Microphone
- Screen capture

Use browser APIs such as:

```text
MediaRecorder
getUserMedia
getDisplayMedia
```

Upload recordings asynchronously.

Do not keep huge media files in PostgreSQL.

Use object storage.

Prepare support for:

- S3
- Cloudflare R2
- GCS

---

# 31. COMMUNICATION SYSTEM

Build a unified communication system.

Support:

```text
Email
In-app notifications
Candidate messages
```

Architecture should later support:

```text
WhatsApp
SMS
Slack
Teams
```

Create message templates:

```text
Application Received
Assessment Invitation
Interview Invitation
Reminder
Rejection
Offer
Custom
```

Allow AI-assisted drafting but require recruiter approval before sending important candidate communications.

---

# 32. INTERVIEW SCHEDULING

Build scheduling.

Recruiter can:

- Create availability
- Select interview duration
- Invite candidate
- Reschedule
- Cancel

Candidate can:

- View available slots
- Select slot
- Receive confirmation

Prepare integration architecture for:

```text
Google Calendar
Microsoft Calendar
Zoom
Google Meet
Microsoft Teams
```

---

# 33. NOTIFICATIONS

Support:

```text
Email
In-app
Push-ready architecture
```

Notification events:

```text
New application
Assessment assigned
Assessment completed
Interview scheduled
Interview reminder
Candidate response
Recruiter assignment
System alert
```

Use background jobs.

---

# 34. BACKGROUND JOB SYSTEM

Use Redis + BullMQ or equivalent.

Queues:

```text
resume-processing
ai-processing
email
notifications
video-processing
assessment-processing
analytics
webhooks
```

Every long-running operation must be asynchronous.

Frontend should display:

```text
Queued
Processing
Completed
Failed
```

with retry support.

---

# 35. FILE STORAGE

Use object storage.

Recommended abstraction:

```text
StorageProvider
 ├── S3Provider
 ├── R2Provider
 └── GCSProvider
```

Store:

- Resumes
- Documents
- Recordings
- Candidate uploads
- Assessment files

Use signed URLs.

Never expose private object-storage URLs directly.

---

# 36. ANALYTICS

Recruiter analytics:

```text
Applications
Screening Rate
Assessment Completion
Interview Completion
Candidate Conversion
Time to Hire
Time in Stage
Source Performance
```

Job analytics:

```text
Views
Applications
Qualified Candidates
Assessment Completion
Interview Completion
Hires
```

AI analytics:

```text
AI Runs
Tokens
Latency
Estimated Cost
Success Rate
```

---

# 37. AI CANDIDATE MATCHING

Create a matching engine.

Inputs:

```text
Job Requirements
Candidate Profile
Resume
Assessments
Interview Evidence
Showcase Evidence
```

Output:

```text
Requirement
Candidate Evidence
Evaluation
Confidence
```

Allow recruiters to configure weights.

Example:

```text
Technical Skills 40%
Experience 20%
Assessment 20%
Interview 15%
Communication 5%
```

Never make the system automatically reject a candidate solely because of an AI score.

---

# 38. EXPLAINABLE AI

Every important AI output should have:

```text
Result
Evidence
Confidence
Source
Timestamp
Model
```

Example UI:

```text
React
████████░░ 82%

Evidence
"Built React applications for 4 years."

Source
Resume → Experience → ABC Company

Confidence
High
```

---

# 39. AI AUDITABILITY

Create:

```text
AI Evaluation ID
Model
Provider
Prompt Version
Timestamp
Input Reference
Output
Confidence
```

If a model changes, previous evaluations must remain reproducible/auditable.

Never silently replace historical AI results.

---

# 40. FAIRNESS / RESPONSIBLE HIRING

Build safeguards.

Do not use protected characteristics as hiring criteria.

Do not allow AI to infer sensitive attributes from:

- Face
- Voice
- Name
- Accent
- Background
- Demographics

Do not generate personality/mental-health judgments.

Clearly label AI-generated assessments.

Recruiters must retain human review.

Add configurable:

```text
AI assistance enabled
AI scoring enabled
Human approval required
```

---

# 41. CONSENT

Before:

- Recording
- Screen sharing
- AI interview
- Voice processing

show clear consent.

Store:

```text
consent_type
timestamp
version
candidate_id
```

Candidate must be able to understand what is being collected and why.

---

# 42. PRIVACY

Implement:

- Data minimization
- Encryption in transit
- Encryption at rest where supported
- Access controls
- Audit logs
- Data retention policies
- Account deletion
- Candidate data export

Prepare architecture for privacy regulations applicable to the deployment jurisdictions.

---

# 43. AUDIT LOG

Track sensitive actions.

Examples:

```text
Candidate viewed
Candidate moved
Candidate rejected
Assessment created
Assessment modified
Interview viewed
Recording accessed
Candidate deleted
AI evaluation generated
```

Store:

```text
actor
organization
action
resource
timestamp
metadata
IP/device information where appropriate
```

---

# 44. BILLING

Create subscription architecture even if billing is initially disabled.

Plans:

```text
Free
Starter
Growth
Enterprise
```

Potential usage metrics:

```text
Active Jobs
Candidates
AI Interviews
Assessments
AI Tokens
Storage
Video Minutes
```

Use a billing abstraction so Stripe can be integrated later.

---

# 45. DESIGN SYSTEM

The UI should feel like a premium modern SaaS product.

Design principles:

- Clean
- Professional
- Spacious
- Fast
- Minimal
- Data-rich
- Accessible

Avoid:

- Generic bootstrap-looking UI
- Excessive gradients
- Excessive glassmorphism
- Clutter
- Huge decorative elements

Use:

- Rounded cards
- Subtle borders
- Clear typography
- Strong information hierarchy
- Contextual actions
- Command palette
- Keyboard shortcuts

Recruiter dashboard should feel closer to:

```text
Linear
Notion
Vercel
Modern enterprise SaaS
```

than a traditional HR application.

---

# 46. CANDIDATE UI

Candidate interface should be completely different from recruiter dashboard.

Candidate experience should be:

- Friendly
- Focused
- Minimal
- Mobile-first
- Low cognitive load

Example:

```text
Application
   ↓
Resume
   ↓
Screening
   ↓
Assessment
   ↓
Interview
   ↓
Complete
```

Show progress clearly.

---

# 47. LANDING PAGE

Create a polished marketing website.

Sections:

```text
Hero
How It Works
AI Interviews
Assessments
Candidate Intelligence
ATS
Role Play
Showcase
Analytics
Security
Pricing
FAQ
CTA
Footer
```

Hero message should communicate:

AI-powered evaluation + human hiring.

Include interactive product previews rather than generic stock imagery.

---

# 48. RESPONSIVE DESIGN

Desktop:

```text
1440px+
```

Tablet:

```text
768px+
```

Mobile:

```text
320px+
```

Candidate flows must work exceptionally well on mobile.

Recruiter dashboard should remain functional on smaller screens.

---

# 49. ACCESSIBILITY

Implement:

- Semantic HTML
- Keyboard navigation
- Focus states
- ARIA labels
- Color contrast
- Screen-reader support
- Reduced motion support

Target WCAG 2.1 AA where practical.

---

# 50. ERROR HANDLING

Every API must return structured errors.

Example:

```json
{
  "success": false,
  "error": {
    "code": "ASSESSMENT_NOT_FOUND",
    "message": "Assessment could not be found."
  }
}
```

Frontend must display useful error states.

Never show raw stack traces.

---

# 51. API DESIGN

Use versioned APIs.

Example:

```text
/api/v1/auth
/api/v1/organizations
/api/v1/jobs
/api/v1/candidates
/api/v1/applications
/api/v1/assessments
/api/v1/interviews
/api/v1/analytics
```

Document APIs using OpenAPI/Swagger.

---

# 52. REAL-TIME FEATURES

Use WebSockets/SSE where appropriate.

Real-time features:

```text
AI interview responses
Candidate status
Assessment processing
Notifications
Background processing
Recruiter collaboration
```

Do not use WebSockets for functionality that can be handled efficiently with normal HTTP.

---

# 53. SEARCH ARCHITECTURE

Start with PostgreSQL search.

Design interfaces for future:

```text
SearchProvider
```

Potential future implementation:

```text
OpenSearch
Elasticsearch
Meilisearch
Vector Database
```

Do not tightly couple business logic to one search engine.

---

# 54. VECTOR / SEMANTIC SEARCH

Prepare for embeddings.

Possible future searches:

```text
Find candidates similar to this profile.

Find candidates with experience equivalent to this requirement.

Find candidates matching this job even when wording differs.
```

Create an embedding abstraction:

```text
EmbeddingProvider
```

Do not make vector search mandatory for the initial MVP.

---

# 55. EVENT-DRIVEN ARCHITECTURE

Create domain events.

Examples:

```text
CandidateApplied
ResumeUploaded
ResumeProcessed
AssessmentAssigned
AssessmentCompleted
InterviewStarted
InterviewCompleted
CandidateMoved
CandidateHired
```

Allow subscribers to trigger:

- Notifications
- Analytics
- AI processing
- Emails
- Webhooks

---

# 56. WEBHOOK SYSTEM

Build outbound webhooks.

Example:

```text
candidate.created
candidate.updated
application.created
application.stage_changed
assessment.completed
interview.completed
```

Allow:

- Signing secret
- Retry
- Delivery logs
- Disable/enable

---

# 57. INTEGRATIONS

Create integration architecture.

Potential integrations:

```text
Google Workspace
Microsoft 365
Google Calendar
Microsoft Calendar
Slack
Teams
Zoom
Google Meet
LinkedIn
Job Boards
ATS exports
HRIS
```

Implement only a few initially, but make the architecture extensible.

---

# 58. ADMIN PANEL

Create platform-level admin dashboard.

Admin can inspect:

```text
Organizations
Users
Jobs
Candidates
AI Usage
System Health
Errors
Queues
Storage
Subscriptions
```

Never expose this dashboard to normal organization users.

---

# 59. OBSERVABILITY

Implement:

- Structured logging
- Error tracking
- Request tracing
- Queue monitoring
- AI usage monitoring
- Database monitoring

Prepare for:

```text
Sentry
OpenTelemetry
Prometheus
Grafana
```

---

# 60. SECURITY

Implement:

- Input validation
- Rate limiting
- CSRF protection where applicable
- XSS protection
- SQL injection prevention through ORM
- Secure headers
- File validation
- Upload limits
- Signed URLs
- Secret management
- Password hashing
- Session security
- API authorization

Never expose:

```text
API keys
database credentials
service credentials
AI provider keys
storage secrets
```

to the frontend.

---

# 61. ENVIRONMENT CONFIGURATION

Create:

```text
.env.example
```

Example:

```text
DATABASE_URL=
REDIS_URL=

AUTH_SECRET=

AI_PROVIDER=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_AI_API_KEY=

STORAGE_PROVIDER=
S3_ENDPOINT=
S3_BUCKET=
S3_ACCESS_KEY=
S3_SECRET_KEY=

EMAIL_PROVIDER=
EMAIL_API_KEY=

STRIPE_SECRET_KEY=

NEXT_PUBLIC_APP_URL=
```

Never commit real secrets.

---

# 62. DEVELOPMENT ENVIRONMENT

Create Docker configuration.

Services:

```text
frontend
backend
postgres
redis
worker
```

Use Docker Compose for local development.

The application should be runnable with a simple documented setup.

---

# 63. TESTING

Implement:

## Unit tests

For:

- Services
- Utility functions
- AI scoring logic
- Validation

## Integration tests

For:

- Authentication
- Jobs
- Applications
- Assessments
- Interviews

## End-to-end tests

Use Playwright.

Test:

```text
Recruiter signup
Create organization
Create job
Candidate applies
Resume parsed
Candidate enters ATS
Assessment assigned
Candidate completes assessment
Interview scheduled
AI interview completed
Recruiter reviews candidate
Candidate moved to next stage
```

---

# 64. SEED DATA

Create realistic demo data.

Include:

```text
3 organizations
10 recruiters
30 candidates
5 jobs
3 assessments
5 interviews
multiple ATS stages
sample AI evaluations
```

Create demo accounts for development.

Do not use fake credentials in production documentation.

---

# 65. PROJECT STRUCTURE

Use a maintainable monorepo.

Example:

```text
/apps
  /web
  /api
  /worker

/packages
  /ui
  /database
  /auth
  /ai
  /storage
  /config
  /types
  /eslint-config
  /typescript-config

/infrastructure
  /docker
  /terraform

/docs
```

Keep reusable logic in packages.

---

# 66. FEATURE FLAGS

Implement feature flags.

Examples:

```text
AI_INTERVIEW
VOICE_INTERVIEW
CODING_ASSESSMENT
ROLEPLAY
SHOWCASE
SEMANTIC_SEARCH
BILLING
WHATSAPP
```

This allows gradual rollout.

---

# 67. AI PROMPT MANAGEMENT

Never scatter prompts throughout the codebase.

Create a prompt registry.

Example:

```text
prompts/
  resume/
  interview/
  screening/
  roleplay/
  matching/
```

Each prompt should have:

```text
name
version
description
system_prompt
output_schema
model_preferences
```

Support versioning.

---

# 68. STRUCTURED AI OUTPUT

Whenever possible, AI must return structured JSON validated with Zod.

Example:

```json
{
  "criteria": [
    {
      "name": "React",
      "score": 85,
      "confidence": "high",
      "evidence": [
        "Candidate reports 4 years of React experience."
      ]
    }
  ]
}
```

Never rely on fragile free-form text parsing.

---

# 69. AI FAILURE HANDLING

AI can fail.

Handle:

```text
Timeout
Rate limit
Invalid response
Provider outage
Malformed JSON
Token limit
Network failure
```

Implement:

```text
Retry
Fallback provider
Dead-letter queue
Manual retry
Failure status
```

Do not silently fabricate an AI result when the model fails.

---

# 70. COST CONTROL

AI operations can become expensive.

Implement:

- Token tracking
- Usage limits
- Model selection
- Prompt caching where supported
- Maximum interview duration
- Maximum recording duration
- Queue limits

Show administrators:

```text
AI Usage
Estimated Cost
Tokens
Minutes
```

---

# 71. PERFORMANCE

Optimize for:

```text
Fast initial page load
Pagination
Lazy loading
Virtualized candidate lists
Background processing
Caching
Database indexes
Connection pooling
```

Never load thousands of candidates into the browser at once.

---

# 72. DATABASE INDEXING

Add indexes for common queries:

```text
organization_id
job_id
candidate_id
application_id
status
stage
created_at
email
```

Use compound indexes where useful.

Analyze slow queries.

---

# 73. PAGINATION

All large datasets must use pagination.

Implement cursor pagination where appropriate.

Examples:

```text
Candidates
Applications
Audit logs
AI runs
Messages
Notifications
```

---

# 74. SEARCH UX

Candidate search should feel instant.

UI:

```text
Search candidates...
```

Filters should update without requiring a full page reload.

Allow saved searches.

---

# 75. COMMAND PALETTE

Add:

```text
Ctrl/Cmd + K
```

Commands:

```text
Create Job
Search Candidate
Create Assessment
Schedule Interview
Open Analytics
Open Settings
```

---

# 76. KEYBOARD SHORTCUTS

Support useful recruiter shortcuts.

Examples:

```text
G then J → Jobs
G then C → Candidates
G then A → Assessments
```

Document shortcuts inside the UI.

---

# 77. CANDIDATE COMPARISON

Allow recruiters to select multiple candidates.

Comparison view:

```text
Candidate A
Candidate B
Candidate C
```

Compare:

```text
Experience
Skills
Assessment
Interview
Evidence
Availability
```

Do not hide important uncertainty behind a single composite number.

---

# 78. CANDIDATE TIMELINE

Create an activity timeline:

```text
Applied
Resume uploaded
Resume processed
Screening completed
Assessment sent
Assessment completed
Interview scheduled
Interview completed
Moved to Interview
Recruiter note added
```

This becomes the candidate's complete recruitment history.

---

# 79. RECRUITER COLLABORATION

Support:

- Notes
- Mentions
- Assignments
- Feedback
- Internal comments

Example:

```text
@Rahul please review the technical assessment.
```

Prepare architecture for real-time collaboration.

---

# 80. EMAIL TEMPLATE BUILDER

Create templates with variables:

```text
{{candidate_name}}
{{job_title}}
{{company_name}}
{{interview_date}}
{{assessment_link}}
```

Validate variables before sending.

---

# 81. CANDIDATE STATUS PRIVACY

Candidates should only see appropriate statuses.

Internal stages such as:

```text
Recruiter Review
Internal Review
Hiring Manager Review
```

may remain hidden.

Candidate-facing statuses can be:

```text
Application Received
Under Review
Assessment
Interview
Decision
```

---

# 82. PUBLIC CANDIDATE PROFILE

Allow candidates to optionally create a public talent profile.

Possible fields:

```text
Professional title
Skills
Experience
Projects
Portfolio
GitHub
Resume
Availability
```

Privacy controls:

```text
Public
Recruiter-only
Private
```

---

# 83. TALENT DISCOVERY

Recruiters can search opted-in public candidate profiles.

Candidate must explicitly enable discoverability.

Search:

```text
React Developer
Data Scientist
Product Designer
Backend Engineer
```

Do not expose private candidate data.

---

# 84. AI CANDIDATE SUMMARY

Generate concise summaries.

Example structure:

```text
Overview
Strengths
Relevant Experience
Potential Gaps
Evidence
Recommended Follow-up Questions
```

Clearly mark it:

```text
AI-generated summary
```

---

# 85. RECRUITER COPILOT

Add a future-ready recruiter assistant.

It can answer:

```text
Show me candidates for this job.
Summarize candidate X.
What requirements are missing?
What should I ask in the next interview?
Draft an interview invitation.
Show candidates waiting for review.
```

The assistant must use permission-aware tools.

Never allow it to access data outside the recruiter's organization.

---

# 86. AI TOOL ARCHITECTURE

Use a tool-based architecture:

```text
RecruiterAgent
 ├── searchCandidates()
 ├── getCandidate()
 ├── getJob()
 ├── createAssessment()
 ├── scheduleInterview()
 ├── draftEmail()
 └── getAnalytics()
```

All tools must enforce authorization.

Destructive actions require confirmation.

---

# 87. INTERNATIONALIZATION

Prepare for i18n.

Initial language:

```text
English
```

Architecture should support:

```text
Hindi
Spanish
French
German
Arabic
```

Do not hard-code user-facing strings inside business logic.

---

# 88. TIME ZONES

Store timestamps in UTC.

Display using user/organization timezone.

Interview scheduling must correctly handle:

```text
India
US
Europe
Australia
```

---

# 89. DATE HANDLING

Use a reliable date library.

Never manually manipulate timezone offsets.

Calendar events should store:

```text
start
end
timezone
```

---

# 90. MOBILE CANDIDATE EXPERIENCE

Candidate mobile flow must support:

```text
Job Application
Resume Upload
Assessment
Text Interview
Voice Interview
Notifications
Scheduling
```

For complex coding assessments, show a clear desktop recommendation but do not break the mobile experience.

---

# 91. EMPTY STATES

Every major screen needs a useful empty state.

Example:

```text
No candidates yet.

Once candidates apply, you'll see them here.
```

Include appropriate CTA.

---

# 92. LOADING STATES

Use:

- Skeleton loaders
- Progress indicators
- Streaming indicators
- Background job status

Never freeze the interface while AI processing occurs.

---

# 93. AI INTERVIEW LIVE UI

Create a premium interview interface.

Candidate sees:

```text
AI Interviewer
──────────────────

Question

[AI response]

Your response

[Microphone]

00:42 / 15:00
```

Show:

- Recording status
- Microphone state
- Connection status
- Progress
- Exit control

Do not overwhelm the candidate with scoring information during the interview.

---

# 94. RECRUITER INTERVIEW REVIEW UI

Show:

```text
Candidate
Interview Scorecard
Transcript
Audio/Video
Question-by-question analysis
Evidence
Recruiter notes
```

Allow recruiters to jump from an evaluation to the relevant transcript segment.

---

# 95. ASSESSMENT REVIEW UI

Show:

```text
Score
Passed/Failed
Question performance
Time spent
Code submissions
AI evaluation
Manual reviewer feedback
```

---

# 96. ROLEPLAY REVIEW UI

Show:

```text
Scenario
Conversation
Objective completion
Evaluation
Candidate strengths
Improvement areas
```

---

# 97. SHOWCASE REVIEW UI

Show:

```text
Recording
Candidate explanation
Project information
Transcript
Evaluation
Recruiter notes
```

---

# 98. EXPORTS

Allow recruiters to export:

```text
Candidate profile
Candidate comparison
Assessment results
Interview report
Analytics
```

Formats:

```text
PDF
CSV
JSON
```

---

# 99. API KEYS

Organizations should eventually be able to create API keys.

Support:

```text
Name
Created
Last Used
Permissions
Revoked
```

Never display a secret after creation.

---

# 100. ENTERPRISE READINESS

Prepare for:

- SSO
- SAML
- SCIM
- Custom retention
- Advanced RBAC
- Audit exports
- Dedicated infrastructure
- Data residency
- Enterprise integrations

Do not implement all of these in MVP, but avoid architecture that prevents them.

---

# 101. MVP SCOPE

Do NOT attempt to build everything simultaneously.

The initial MVP should contain:

```text
Authentication
Organizations
Recruiter Dashboard
Candidate Profiles
Job Creation
Public Job Page
Applications
Resume Upload
Resume Parsing
Basic AI Screening
ATS Kanban
Assessment Builder
Basic MCQ Assessment
AI Text Interview
Interview Transcript
Candidate Evaluation
Email Notifications
Basic Analytics
```

This should be fully functional before adding advanced features.

---

# 102. PHASE 2

After MVP:

```text
Voice AI Interview
Coding Assessment
Advanced Candidate Matching
Talent Pool
Candidate Comparison
Calendar Scheduling
Role Play
```

---

# 103. PHASE 3

Then:

```text
Showcase
Screen Recording
Advanced Analytics
Semantic Search
Recruiter Copilot
AI Question Generation
Advanced AI Evaluation
```

---

# 104. PHASE 4

Then:

```text
Integrations
WhatsApp
Slack
Teams
Zoom
Google Calendar
Microsoft Calendar
Job Boards
Webhooks
API
```

---

# 105. PHASE 5

Enterprise:

```text
SSO
SAML
SCIM
Advanced RBAC
Enterprise Billing
Data Residency
Advanced Compliance
Dedicated Infrastructure
```

---

# 106. IMPLEMENTATION ORDER

Follow this exact order.

## STEP 1

Initialize repository and monorepo.

## STEP 2

Set up:

```text
Next.js
TypeScript
Tailwind
shadcn/ui
PostgreSQL
Prisma
Redis
Docker
```

## STEP 3

Implement authentication.

## STEP 4

Implement organizations and RBAC.

## STEP 5

Implement recruiter dashboard.

## STEP 6

Implement jobs.

## STEP 7

Implement public job pages.

## STEP 8

Implement candidate onboarding.

## STEP 9

Implement resume uploads.

## STEP 10

Implement asynchronous resume processing.

## STEP 11

Implement AI provider abstraction.

## STEP 12

Implement AI resume evaluation.

## STEP 13

Implement ATS.

## STEP 14

Implement assessment builder.

## STEP 15

Implement assessment candidate flow.

## STEP 16

Implement AI text interviews.

## STEP 17

Implement interview evaluation.

## STEP 18

Implement candidate comparison.

## STEP 19

Implement notifications.

## STEP 20

Implement analytics.

## STEP 21

Implement security/audit logging.

## STEP 22

Implement tests.

## STEP 23

Implement Docker production configuration.

## STEP 24

Implement CI/CD.

Only after all of the above is stable should advanced features be added.

---

# 107. CODE QUALITY RULES

Write production-quality code.

Rules:

- Strict TypeScript
- No unnecessary `any`
- No duplicated business logic
- No giant components
- No giant services
- No hard-coded secrets
- No hard-coded AI provider
- No direct database queries from UI
- Validate all external input
- Validate AI output
- Use reusable components
- Use typed API contracts
- Use meaningful names
- Add comments only where they provide useful context

---

# 108. UX RULE

Do not build screens merely because they are listed above.

Every feature must have:

```text
Loading state
Empty state
Error state
Success state
Permission state
Mobile behavior
```

The UI must feel like one coherent product.

---

# 109. ORIGINAL BRANDING

Do not copy Flowmingo branding.

Create an original product identity.

Use a temporary working name:

# TalentOS AI

The branding must feel:

```text
Intelligent
Professional
Modern
Trustworthy
Human-centered
```

Keep the branding system easy to replace later.

---

# 110. FINAL PRODUCT STRUCTURE

The final platform should conceptually look like:

```text
                    TALENTOS AI
                         │
          ┌──────────────┴──────────────┐
          │                             │
      RECRUITER                     CANDIDATE
          │                             │
          ▼                             ▼
       JOBS                         PROFILE
          │                             │
          ▼                             ▼
    APPLICATION                    APPLICATION
          │                             │
          ▼                             ▼
     CV INTELLIGENCE                SCREENING
          │                             │
          ▼                             ▼
      ASSESSMENT                    ASSESSMENT
          │                             │
          ▼                             ▼
     AI INTERVIEW                  AI INTERVIEW
          │                             │
          ▼                             ▼
      ROLE PLAY                    SHOWCASE
          │                             │
          └──────────────┬──────────────┘
                         ▼
                 CANDIDATE INTELLIGENCE
                         │
                         ▼
                       ATS
                         │
                         ▼
                 HUMAN DECISION
```

---

# 111. DEFINITION OF DONE

The project is NOT considered complete when the UI looks good.

A feature is complete only when:

```text
UI
+
API
+
Database
+
Validation
+
Authorization
+
Loading/Error States
+
Tests
+
Auditability
+
Responsive Design
+
Documentation
```

are implemented.

---

# 112. FIRST DEVELOPMENT TASK

Do NOT immediately implement all features.

Start with:

```text
1. Project architecture
2. Monorepo
3. Docker
4. PostgreSQL
5. Prisma
6. Redis
7. Authentication
8. Organization model
9. RBAC
10. Base design system
11. Recruiter dashboard shell
12. Candidate dashboard shell
```

Then stop and verify the foundation.

After the foundation is stable, implement the MVP in the exact order specified above.

At every phase:

1. Explain what will be implemented.
2. Implement it completely.
3. Run linting.
4. Run type checking.
5. Run tests.
6. Verify database migrations.
7. Verify API endpoints.
8. Verify responsive UI.
9. Fix errors.
10. Only then move to the next phase.

Never mark a feature as complete merely because the UI has been created.

The end result must be a **real, working, extensible AI recruitment platform**, not a static prototype.