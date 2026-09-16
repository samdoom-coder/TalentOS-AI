import { describe, it, expect } from "vitest";
import { parseResumeText, experienceYears } from "@/lib/resumes/parse";
import { weightedOverall, heuristicEvaluate } from "@/lib/matching/evaluate";
import { renderTemplate, validateTemplateVars } from "@/lib/email/email";
import { can } from "@/lib/auth/rbac";
import { candidateFacingStage } from "@/lib/utils";

describe("resume parsing", () => {
  it("extracts email, skills and experience", () => {
    const text = "Jane Doe\njane@example.com\n+91 98765 43210\nSenior React developer with 5 years experience in TypeScript and PostgreSQL.\nWorked at Acme 2020 - 2023 building dashboards.";
    const parsed = parseResumeText(text);
    expect(parsed.email).toBe("jane@example.com");
    expect(parsed.skills).toContain("react");
    expect(experienceYears(text)).toBeGreaterThanOrEqual(3);
  });
});

describe("matching engine", () => {
  it("computes weighted overall", () => {
    expect(weightedOverall([{ score: 80, weight: 50 }, { score: 60, weight: 50 }])).toBe(70);
    expect(weightedOverall([])).toBe(0);
  });

  it("never scores without evidence text", () => {
    const out = heuristicEvaluate([{ label: "Go", category: "skill", weight: 20, isRequired: true }], "React developer resume");
    expect(out[0].evidence.length).toBeGreaterThan(0);
    expect(out[0].score).toBeLessThan(50);
  });
});

describe("templates", () => {
  it("renders variables and reports missing ones", () => {
    expect(renderTemplate("Hi {{candidate_name}}", { candidate_name: "Ava" })).toBe("Hi Ava");
    expect(validateTemplateVars("Hi {{candidate_name}} for {{job_title}}", { candidate_name: "Ava" })).toEqual(["job_title"]);
  });
});

describe("rbac", () => {
  it("enforces recruiter vs candidate permissions", () => {
    expect(can("recruiter", "candidates:move")).toBe(true);
    expect(can("candidate", "candidates:move")).toBe(false);
    expect(can("interviewer", "interviews:conduct")).toBe(true);
    expect(can(undefined, "jobs:view")).toBe(false);
  });
});

describe("stage mapping", () => {
  it("hides internal stages from candidates", () => {
    expect(candidateFacingStage("hiring_manager_review" as string)).toBe("Under Review");
    expect(candidateFacingStage("interview")).toBe("Interview");
  });
});
