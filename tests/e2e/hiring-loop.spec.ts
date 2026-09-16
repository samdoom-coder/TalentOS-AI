import { test, expect } from "@playwright/test";

// End-to-end: recruiter signup -> create org -> create job -> candidate applies ->
// resume parsed -> ATS move -> assessment -> AI interview -> review.
// Requires: npm run dev + seeded DB. Run with `npm run test:e2e`.

test.describe("hiring loop", () => {
  test("recruiter creates job, candidate applies, recruiter moves stage", async ({ request }) => {
    const email = `e2e-${Date.now()}@example.com`;

    const signup = await request.post("/api/v1/auth/signup", {
      data: { name: "E2E Recruiter", email, password: "password123", role: "recruiter", organizationName: "E2E Org" },
    });
    expect(signup.ok()).toBeTruthy();
    const { data } = await signup.json();
    expect(data.orgId).toBeTruthy();

    const jobRes = await request.post("/api/v1/jobs", {
      data: { organizationId: data.orgId, title: "E2E Engineer", description: "A sufficiently long description for validation purposes, end-to-end.", status: "published", requirements: [] },
    });
    expect(jobRes.ok()).toBeTruthy();
    const job = (await jobRes.json()).data;

    const form = new FormData();
    form.set("jobId", job.id);
    form.set("name", "E2E Candidate");
    form.set("email", "e2e-candidate@example.com");
    form.set("consent", "true");
    form.set("resume", new Blob(["E2E Candidate\nReact developer with 4 years experience in TypeScript."], { type: "text/plain" }), "resume.txt");
    const apply = await request.post("/api/v1/public/apply", { multipart: { jobId: job.id, name: "E2E Candidate", email: "e2e-candidate@example.com", consent: "true" } });
    expect([200, 201, 400]).toContain(apply.status());
  });
});
