import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { J } from "../lib/db/json";

const prisma = new PrismaClient();

const STAGES = [
  { name: "Applied", slug: "applied", candidateFacing: "Application Received" },
  { name: "Screening", slug: "screening", candidateFacing: "Under Review" },
  { name: "Assessment", slug: "assessment", candidateFacing: "Assessment" },
  { name: "Interview", slug: "interview", candidateFacing: "Interview" },
  { name: "Technical Interview", slug: "technical_interview", candidateFacing: "Interview" },
  { name: "Final Interview", slug: "final_interview", candidateFacing: "Interview" },
  { name: "Offer", slug: "offer", candidateFacing: "Decision" },
  { name: "Hired", slug: "hired", candidateFacing: "Decision" },
  { name: "Rejected", slug: "rejected", candidateFacing: "Decision" },
];

const FIRST = ["Ava", "Liam", "Maya", "Rahul", "Sofia", "Kenji", "Priya", "Diego", "Nora", "Omar", "Elena", "Vikram", "Hana", "Tom", "Aisha", "Marco", "Zara", "Felix", "Ivy", "Karan", "Lena", "Yuki", "Sam", "Nina", "Dev", "Rosa", "Ali", "Tara", "Leo", "Mia"];
const LAST = ["Sharma", "Khan", "Patel", "Garcia", "Kim", "Nguyen", "Singh", "Muller", "Rossi", "Dubey"];
const SKILLS = ["React", "TypeScript", "Next.js", "Node.js", "Python", "PostgreSQL", "Communication", "Problem Solving", "Sales", "Negotiation"];
const TITLES = ["Frontend Engineer", "Backend Engineer", "Full-Stack Developer", "Data Analyst", "Product Designer", "Account Executive"];

async function main() {
  console.log("Seeding TalentOS AI demo data…");
  const passwordHash = await hash("password123", 10);

  const orgDefs = [
    { name: "Acme AI", slug: "acme-ai", industry: "SaaS", size: "51-200" },
    { name: "Globex Labs", slug: "globex-labs", industry: "Fintech", size: "11-50" },
    { name: "Initech", slug: "initech", industry: "E-commerce", size: "201-500" },
  ];

  const orgs: { id: string }[] = [];
  for (const o of orgDefs) {
    const org = await prisma.organization.upsert({
      where: { slug: o.slug },
      update: {},
      create: {
        ...o,
        atsStages: { create: STAGES.map((s, i) => ({ ...s, sortOrder: i, isDefault: true })) },
        subscriptions: { create: { plan: "growth" } },
      },
    });
    orgs.push(org);
  }

  // 10 recruiters across orgs (first is the documented demo login)
  const recruiterDefs = [
    { name: "Ava Stone", email: "ava@acme.ai", org: 0, role: "owner" },
    { name: "Ben Carter", email: "ben@acme.ai", org: 0, role: "admin" },
    { name: "Cara Diaz", email: "cara@acme.ai", org: 0, role: "recruiter" },
    { name: "Dan Evans", email: "dan@acme.ai", org: 0, role: "hiring_manager" },
    { name: "Eli Ford", email: "eli@globex.ai", org: 1, role: "owner" },
    { name: "Fay Grant", email: "fay@globex.ai", org: 1, role: "recruiter" },
    { name: "Gus Hill", email: "gus@globex.ai", org: 1, role: "interviewer" },
    { name: "Hal Ivers", email: "hal@initech.ai", org: 2, role: "owner" },
    { name: "Ivy Jones", email: "ivy@initech.ai", org: 2, role: "recruiter" },
    { name: "Jay Klein", email: "jay@initech.ai", org: 2, role: "hiring_manager" },
  ];
  for (const r of recruiterDefs) {
    const user = await prisma.user.upsert({
      where: { email: r.email },
      update: {},
      create: { email: r.email, name: r.name, passwordHash, emailVerified: true, role: "recruiter" },
    });
    await prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: orgs[r.org].id, userId: user.id } },
      update: { role: r.role },
      create: { organizationId: orgs[r.org].id, userId: user.id, role: r.role },
    });
  }

  // Candidate login
  await prisma.user.upsert({
    where: { email: "candidate@example.com" },
    update: {},
    create: { email: "candidate@example.com", name: "Demo Candidate", passwordHash, emailVerified: true, role: "candidate" },
  });

  // 5 jobs (published) with weighted requirements
  const jobDefs = [
    { org: 0, title: "Senior Frontend Engineer", department: "Engineering", location: "Bengaluru · Hybrid", reqs: [["React", 20], ["TypeScript", 20], ["Next.js", 15], ["Communication", 15], ["Problem Solving", 20]] },
    { org: 0, title: "Backend Engineer (Node/Postgres)", department: "Engineering", location: "Remote", reqs: [["Node.js", 20], ["PostgreSQL", 20], ["TypeScript", 15], ["Problem Solving", 20], ["Communication", 10]] },
    { org: 1, title: "Account Executive", department: "Sales", location: "Mumbai · Onsite", reqs: [["Sales", 25], ["Negotiation", 20], ["Communication", 25], ["Problem Solving", 15]] },
    { org: 2, title: "Product Designer", department: "Design", location: "Remote", reqs: [["Communication", 20], ["Problem Solving", 25], ["React", 10], ["TypeScript", 10]] },
    { org: 2, title: "Data Analyst", department: "Data", location: "Hyderabad · Hybrid", reqs: [["Python", 20], ["PostgreSQL", 20], ["Communication", 15], ["Problem Solving", 20]] },
  ];
  const jobs = [];
  for (const [ji, j] of jobDefs.entries()) {
    const slug = `demo-${j.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${ji}`;
    const job = await prisma.job.upsert({
      where: { slug },
      update: {},
      create: {
        organizationId: orgs[j.org].id,
        title: j.title,
        department: j.department,
        location: j.location,
        workMode: "hybrid",
        description: `We are hiring a ${j.title} to own meaningful work end-to-end. You will collaborate with product and engineering, write tested code, and help shape how we hire fairly with AI assistance and human decisions.`,
        responsibilities: "Own features end-to-end\nWrite tested, reviewed code\nCollaborate across functions\nRaise the bar on quality",
        status: "published",
        slug,
        publishedAt: new Date(),
        requirements: {
          create: j.reqs.map(([label, weight]) => ({
            category: "skill",
            label: label as string,
            importance: (weight as number) >= 20 ? "required" : "important",
            isRequired: (weight as number) >= 20,
            evaluationMethod: "resume",
            weight: weight as number,
          })),
        },
      },
    });
    jobs.push(job);
  }

  // 30 candidates with applications spread across stages + scores/evidence
  const stageCycle = ["applied", "screening", "assessment", "interview", "offer", "hired", "rejected", "screening", "assessment", "interview"];
  for (let i = 0; i < 30; i++) {
    const name = `${FIRST[i % FIRST.length]} ${LAST[i % LAST.length]}`;
    const email = `candidate${i + 1}@example.com`;
    const orgIdx = i % 3;
    const job = jobs[i % jobs.length].organizationId === orgs[orgIdx].id ? jobs[i % jobs.length] : jobs.find((j) => j.organizationId === orgs[orgIdx].id)!;
    const candidate = await prisma.candidate.upsert({
      where: { id: `seed-candidate-${i + 1}` },
      update: {},
      create: {
        id: `seed-candidate-${i + 1}`,
        organizationId: orgs[orgIdx].id,
        name,
        email,
        location: ["Bengaluru", "Mumbai", "Remote", "Hyderabad", "Delhi"][i % 5],
        title: TITLES[i % TITLES.length],
        summary: `${TITLES[i % TITLES.length]} with ${2 + (i % 6)} years of experience across product teams.`,
        experienceYrs: 2 + (i % 6),
      },
    });
    const skillSample = [SKILLS[i % SKILLS.length], SKILLS[(i + 3) % SKILLS.length], SKILLS[(i + 5) % SKILLS.length]];
    for (const s of skillSample) {
      await prisma.candidateSkill.create({ data: { candidateId: candidate.id, skill: s, years: 1 + (i % 4) } }).catch(() => undefined);
    }
    const stage = stageCycle[i % stageCycle.length];
    const score = 45 + ((i * 7) % 50);
    const app = await prisma.application.upsert({
      where: { jobId_candidateId: { jobId: job.id, candidateId: candidate.id } },
      update: { stage, matchScore: score },
      create: {
        organizationId: job.organizationId,
        jobId: job.id,
        candidateId: candidate.id,
        stage,
        status: stage === "hired" ? "hired" : stage === "rejected" ? "rejected" : "active",
        matchScore: score,
        source: "seed",
        events: { create: { type: "applied", message: "Seeded application" } },
        stageHistory: { create: { toStage: stage } },
      },
    });
    await prisma.candidateScore.create({ data: { candidateId: candidate.id, jobId: job.id, scope: "overall", score, confidence: "medium", model: "mock-v1" } }).catch(() => undefined);
    await prisma.candidateEvidence.create({
      data: { candidateId: candidate.id, jobId: job.id, requirement: skillSample[0], evidence: `Seeded evidence: ${2 + (i % 4)} years of ${skillSample[0]} across projects.`, assessment: "Strong evidence", confidence: "medium", source: "resume", score },
    }).catch(() => undefined);
    void app;
  }

  // 3 assessments with sections/questions
  for (const [ai, title] of ["Frontend Screening", "Backend Fundamentals", "Sales Situational"].entries()) {
    const a = await prisma.assessment.create({
      data: {
        organizationId: orgs[ai % 3].id,
        title,
        description: `Seeded ${title} — MCQ + scenario.`,
        passingScore: 60,
        status: "published",
        sections: {
          create: [
            {
              title: "Core", sortOrder: 0,
              questions: {
                create: [
                  { type: "mcq", prompt: "Which hook memoizes a callback in React?", options: J(["useMemo", "useCallback", "useRef", "useEffect"]), answerKey: J({ value: "useCallback" }), points: 1, sortOrder: 0 },
                  { type: "true_false", prompt: "A covering index can speed up filtered queries.", options: J(["True", "False"]), answerKey: J({ value: "True" }), points: 1, sortOrder: 1 },
                  { type: "long_answer", prompt: "Describe a difficult bug you fixed and how you verified the fix.", points: 3, sortOrder: 2 },
                ],
              },
            },
          ],
        },
      },
    });
    void a;
  }

  // 5 AI interviews (text) with one evaluated session each on first org
  for (let i = 0; i < 5; i++) {
    const iv = await prisma.interview.create({
      data: {
        organizationId: orgs[i % 3].id,
        jobId: jobs[i % jobs.length].id,
        title: `${jobs[i % jobs.length].title} — AI Screen ${i + 1}`,
        mode: "text",
        durationMin: 15,
        difficulty: "medium",
        topics: J(["Experience", "Technical depth", "Communication"]),
        questionCount: 5,
        criteria: J(["Technical Knowledge", "Communication", "Problem Solving"]),
        status: "published",
        questions: { create: [{ prompt: "Tell me about a project you are proud of and your specific contribution.", sortOrder: 0 }, { prompt: "Describe a production issue you debugged end-to-end.", sortOrder: 1 }] },
      },
    });
    const sess = await prisma.interviewSession.create({ data: { interviewId: iv.id, status: "evaluated", startedAt: new Date(), endedAt: new Date(), summary: "Seeded summary: solid experience, verify depth in follow-up." } });
    await prisma.interviewTranscript.createMany({
      data: [
        { sessionId: sess.id, speaker: "ai", message: "Tell me about a project you are proud of." },
        { sessionId: sess.id, speaker: "candidate", message: "I led a checkout rewrite that cut P95 latency from 900ms to 180ms." },
        { sessionId: sess.id, speaker: "ai", message: "What specifically caused the latency, and how did you measure it?" },
      ],
    });
    await prisma.interviewEvaluation.createMany({
      data: [
        { sessionId: sess.id, criterion: "Technical Knowledge", score: 78, evidence: "Described index-level optimisation with metrics.", confidence: "medium", reasoningSummary: "Concrete, measured example.", model: "mock-v1" },
        { sessionId: sess.id, criterion: "Communication", score: 82, evidence: "Clear, structured answers.", confidence: "high", reasoningSummary: "Strong narrative.", model: "mock-v1" },
      ],
    });
  }

  // Sample AI runs for auditability demo
  const firstOrg = orgs[0];
  for (const task of ["resume_evaluation", "candidate_matching", "interview_evaluation"]) {
    await prisma.aiRun.create({
      data: { organizationId: firstOrg.id, task, provider: "mock", model: "mock-v1", promptVersion: "v1", output: J({ criteria: [] }), tokensIn: 1200, tokensOut: 300, latencyMs: 42, costUsd: 0, status: "succeeded" },
    });
  }

  console.log("Seed complete. Demo logins: ava@acme.ai / password123 (recruiter), candidate@example.com / password123.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
