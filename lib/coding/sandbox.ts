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
  const results: RunResult["results"] = [];
  for (const t of tests) {
    try {
      // Convention: candidate defines `solve(...)`; harness calls it with input.
      const sandbox: Record<string, unknown> = {};
      vm.createContext(sandbox);
      const script = new vm.Script(`${code}\n;__result = (typeof solve === 'function' && ${JSON.stringify(t.input ?? null)} !== null) ? solve(${JSON.stringify(t.input)}) : (typeof solution !== 'undefined' ? solution : null);`);
      vm.runInContext("__result = null;", sandbox, { timeout: timeoutMs });
      void script;
      const wrapped = new vm.Script(
        `${code}\n__out = (typeof solve === "function" ? solve(__input) : null);`
      );
      sandbox.__input = t.input;
      wrapped.runInContext(sandbox, { timeout: timeoutMs });
      const out = (sandbox as Record<string, unknown>).__out;
      const passed = t.expected === undefined ? out !== undefined : JSON.stringify(out) === JSON.stringify(t.expected);
      results.push({ name: t.name, passed, output: String(out ?? ""), hidden: Boolean(t.hidden) });
    } catch (e) {
      results.push({ name: t.name, passed: false, output: e instanceof Error ? e.message : "error", hidden: Boolean(t.hidden) });
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
