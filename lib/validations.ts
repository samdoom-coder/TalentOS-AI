import { z } from "zod";

// Shared typed API contracts. Every route validates external input with these.

export const signupSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  organizationName: z.string().min(2).max(100).optional(),
  role: z.enum(["recruiter", "candidate"]).default("recruiter"),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const jobSchema = z.object({
  title: z.string().min(3).max(200),
  department: z.string().optional(),
  location: z.string().optional(),
  workMode: z.enum(["remote", "hybrid", "onsite"]).default("onsite"),
  employmentType: z.string().default("full_time"),
  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
  description: z.string().min(20),
  responsibilities: z.string().optional(),
  status: z.enum(["draft", "published", "closed", "archived"]).default("draft"),
  requirements: z
    .array(
      z.object({
        category: z.string(),
        label: z.string(),
        detail: z.string().optional(),
        importance: z.string().default("important"),
        isRequired: z.boolean().default(false),
        evaluationMethod: z.string().default("resume"),
        weight: z.number().min(0).max(100).default(10),
      })
    )
    .default([]),
  questions: z.array(z.object({ question: z.string(), type: z.string().default("short_answer"), required: z.boolean().default(false) })).default([]),
});

export const applicationSchema = z.object({
  jobId: z.string(),
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  location: z.string().optional(),
  title: z.string().optional(),
  linkedinUrl: z.string().optional(),
  githubUrl: z.string().optional(),
  portfolioUrl: z.string().optional(),
  answers: z.record(z.string()).optional(),
  consent: z.boolean().refine((v) => v === true, { message: "Consent is required" }),
});

export const assessmentSchema = z.object({
  jobId: z.string().optional(),
  title: z.string().min(3),
  description: z.string().optional(),
  timeLimitMin: z.number().optional(),
  passingScore: z.number().min(0).max(100).optional(),
  maxAttempts: z.number().default(1),
  sections: z.array(
    z.object({
      title: z.string(),
      questions: z.array(
        z.object({
          type: z.string(),
          prompt: z.string(),
          options: z.unknown().optional(),
          answerKey: z.unknown().optional(),
          points: z.number().default(1),
        })
      ),
    })
  ),
});

export const interviewSchema = z.object({
  jobId: z.string().optional(),
  title: z.string().min(3),
  mode: z.enum(["text", "voice"]).default("text"),
  durationMin: z.number().default(15),
  difficulty: z.string().default("medium"),
  topics: z.array(z.string()).default([]),
  questionCount: z.number().default(5),
  criteria: z.array(z.string()).default(["Technical Knowledge", "Communication", "Problem Solving"]),
});

export const moveStageSchema = z.object({
  applicationId: z.string(),
  toStage: z.string(),
  note: z.string().optional(),
});

export type SignupInput = z.infer<typeof signupSchema>;
