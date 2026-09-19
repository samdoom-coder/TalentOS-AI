// Judge0 isolated execution (no dep, fetch-based).
// Env: JUDGE0_URL (e.g. https://judge0.example.com or RapidAPI host),
//      JUDGE0_KEY (optional), JUDGE0_HOST (for RapidAPI).
// Language map covers spec §23: JS/TS/Python/Java/C++/Go.

import { fetchWithTimeout } from "@/lib/security/fetch";
import type { RunResult, TestCase } from "./sandbox";

const LANG_ID: Record<string, number> = {
  javascript: 63,
  typescript: 74,
  python: 71,
  java: 62,
  "c++": 54,
  cpp: 54,
  go: 60,
};

export function judge0Configured(): boolean {
  return Boolean(process.env.JUDGE0_URL);
}

function wrap(code: string, input: unknown): string {
  // Judge0 runs whole programs: inject solve() + harness printing __out JSON.
  return `${code}\n;try { const __res = (typeof solve === "function" ? solve(${JSON.stringify(input ?? null)} ?? null) : null); console.log("__OUT__" + JSON.stringify(__res)); } catch (e) { console.error("__ERR__" + (e && e.message || e)); }`;
}

export async function runViaJudge0(language: string, code: string, tests: TestCase[], timeoutMs = 5000): Promise<RunResult> {
  const base = (process.env.JUDGE0_URL ?? "").replace(/\/$/, "");
  const id = LANG_ID[language.toLowerCase()];
  if (!id) throw new Error(`Judge0: unsupported language ${language}`);
  const results: RunResult["results"] = [];
  for (const t of tests.slice(0, 20)) {
    const res = await fetchWithTimeout(`${base}/submissions?base64_encoded=false&wait=true`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.JUDGE0_KEY ? { "X-RapidAPI-Key": process.env.JUDGE0_KEY } : {}),
        ...(process.env.JUDGE0_HOST ? { "X-RapidAPI-Host": process.env.JUDGE0_HOST } : {}),
      },
      body: JSON.stringify({
        language_id: id,
        source_code: Buffer.from(wrap(code, t.input)).toString("base64") ? wrap(code, t.input) : wrap(code, t.input),
        stdin: "",
        cpu_time_limit: Math.max(1, Math.min(10, timeoutMs / 1000)),
      }),
    }, 20000);
    if (!res.ok) throw new Error(`Judge0 ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json() as { stdout?: string; stderr?: string; status?: { description?: string } };
    const out = `${data.stdout ?? ""}${data.stderr ?? ""}`;
    const m = out.match(/__OUT__(.*)/);
    let parsed: unknown = undefined;
    if (m) {
      try { parsed = JSON.parse(m[1]); } catch { parsed = m[1]; }
    }
    const passed = t.expected === undefined ? parsed !== undefined : JSON.stringify(parsed) === JSON.stringify(t.expected);
    results.push({ name: t.name, passed, output: String(m?.[1] ?? out).slice(0, 2000), hidden: Boolean(t.hidden) });
  }
  return { passed: results.every((r) => r.passed), results };
}
