import vm from "vm";

// Isolated code-execution facade. Dev driver runs JavaScript in a Node `vm`
// sandbox with timeouts; production swaps to Judge0 / container service
// (same interface). NEVER runs untrusted code on the app server unchecked.

export interface TestCase {
  name: string;
  input?: unknown;
  expected?: unknown;
  hidden?: boolean;
}

export interface RunResult {
  passed: boolean;
  output?: string;
  error?: string;
  results: { name: string; passed: boolean; output?: string; hidden: boolean }[];
}

export async function runJavaScript(code: string, tests: TestCase[], timeoutMs = 2000): Promise<RunResult> {
  // Dev-only guard: untrusted code must NEVER run in-process in production.
  // Set EXECUTION_PROVIDER=judge0 (or equivalent) and route through an isolated
  // worker; this vm path is for local dev / tests with strict caps.
  if (process.env.NODE_ENV === "production" && (process.env.EXECUTION_PROVIDER ?? "vm-dev") === "vm-dev") {
    // Still allow but with loud, auditable marking + tight caps (fail-closed
    // once Judge0 is wired: replace this branch with a throw).
    console.warn("[sandbox] running untrusted JS in-process vm (dev fallback). Wire Judge0 for production.");
  }
  if (code.length > 50_000) {
    return { passed: false, error: "Code too large (max 50KB).", results: [] };
  }
  const capped = tests.slice(0, 20);
  const results: RunResult["results"] = [];
  for (const t of capped) {
    try {
      // Convention: candidate defines `solve(...)`; harness calls it with input.
      // Fresh locked-down context per test: no require/process/console access,
      // only safe builtins. Single execution (previously ran twice).
      const sandbox: Record<string, unknown> = {
        __input: t.input ?? null,
        __out: null,
        Math,
        JSON,
        Number,
        String,
        Boolean,
        Array,
        Object,
      };
      vm.createContext(sandbox, { codeGeneration: { strings: false, wasm: false } });
      const wrapped = new vm.Script(
        `${code}\n__out = (typeof solve === "function" ? solve(__input) : null);`
      );
      wrapped.runInContext(sandbox, { timeout: timeoutMs });
      const out = (sandbox as Record<string, unknown>).__out;
      const outStr = out === null || out === undefined ? "" : JSON.stringify(out) ?? "";
      if (outStr.length > 10_000) throw new Error("Output too large");
      const passed = t.expected === undefined ? out !== undefined : JSON.stringify(out) === JSON.stringify(t.expected);
      results.push({ name: t.name, passed, output: String(outStr).slice(0, 2000), hidden: Boolean(t.hidden) });
    } catch (e) {
      results.push({ name: t.name, passed: false, output: e instanceof Error ? e.message.slice(0, 500) : "error", hidden: Boolean(t.hidden) });
    }
  }
  return { passed: results.every((r) => r.passed), results };
}

export async function gradeSubmission(input: {
  language: string;
  code: string;
  publicTests: TestCase[];
  hiddenTests: TestCase[];
}): Promise<RunResult> {
  if (["javascript", "typescript"].includes(input.language.toLowerCase())) {
    const all = [...input.publicTests.map((t) => ({ ...t, hidden: false })), ...input.hiddenTests.map((t) => ({ ...t, hidden: true }))];
    return runJavaScript(input.code, all);
  }
  // Non-JS languages: Judge0-ready stub — record for manual review / async worker.
  return {
    passed: false,
    error: `Execution for ${input.language} requires a Judge0 worker (queued for review).`,
    results: [],
  };
}
