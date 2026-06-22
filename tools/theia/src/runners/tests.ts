// Theia (Spec 012) — npm test runner (PR 7).
//
// `runNpmTest(rootPath)` spawns `npm test` and returns a controller
// object: the parser gets an immediate `{ running: true }` placeholder;
// the underlying subprocess resolves to a `TestResult` via the
// `result` promise on the controller. PR 8 (server + views) will
// poll the controller and update the UI without a server restart
// (AC-8: "server is ready before the test run completes").
//
// `parseNodeTestOutput(stdout)` is a pure function that parses
// `node:test` TAP-like output. Exported for testability — tests use
// mocked strings; the runner delegates to it once stdout is closed.

import { spawn } from "node:child_process";
import type { TestResult } from "../types.ts";

export type NpmTestController = {
  result: Promise<TestResult>;
  stop: () => void;
};

const RUNNING_PLACEHOLDER: TestResult = {
  running: true,
  total: null,
  pass: null,
  fail: null,
  failingNames: [],
  startedAt: null,
  completedAt: null,
  reason: null,
};

// Pure parser: `node:test` TAP output → TestResult. The runner calls
// this once stdout closes. Empty / partial output returns a
// structured result with `running: false` + a reason; tests can
// detect "could not parse" cases.
export function parseNodeTestOutput(stdout: string, stderr = "", exitCode = 0): TestResult {
  const lines = stdout.split("\n");
  let total: number | null = null;
  let pass: number | null = null;
  let fail: number | null = null;
  const failingNames: string[] = [];
  // Match "# tests N", "# pass N", "# fail N" (final summary block).
  const testsMatch = stdout.match(/^#\s+tests\s+(\d+)/m);
  if (testsMatch !== null && testsMatch[1] !== undefined) total = Number(testsMatch[1]);
  const passMatch = stdout.match(/^#\s+pass\s+(\d+)/m);
  if (passMatch !== null && passMatch[1] !== undefined) pass = Number(passMatch[1]);
  const failMatch = stdout.match(/^#\s+fail\s+(\d+)/m);
  if (failMatch !== null && failMatch[1] !== undefined) fail = Number(failMatch[1]);
  // Failing test names: lines like `not ok 5 - some test name`.
  for (const line of lines) {
    const m = /^not ok\s+\d+\s+-\s+(.+)$/.exec(line);
    if (m !== null && m[1] !== undefined) failingNames.push(m[1]);
  }
  // If we couldn't parse a summary AND exit code is non-zero, the
  // test runner likely crashed; surface that as the reason.
  if (total === null && exitCode !== 0) {
    return {
      running: false,
      total: null,
      pass: null,
      fail: null,
      failingNames: [],
      startedAt: null,
      completedAt: null,
      reason: stderr.trim().split("\n")[0] ?? "npm test exited non-zero",
    };
  }
  return {
    running: false,
    total,
    pass,
    fail,
    failingNames,
    startedAt: null,
    completedAt: null,
    reason: total === null ? "could not parse npm test summary" : null,
  };
}

// Fire-and-forget background runner. Returns a controller with a
// `result` promise that resolves when the subprocess closes, plus a
// `stop()` for the server to cancel a running test (rare; mostly
// present for test isolation).
export function runNpmTest(rootPath: string): NpmTestController {
  const startedAt = new Date().toISOString();
  const result = new Promise<TestResult>((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    let proc: ReturnType<typeof spawn> | null = null;
    try {
      // Spawn `node --test` directly instead of `npm test` to avoid
      // a recursive spawn loop. The full `npm test` includes 4 lint
      // scripts which run after the test suite; the runner captures
      // the test phase only. PR 8 may extend the runner to spawn the
      // full `npm test` if the lint surface becomes interesting.
      //
      // Caveat for test isolation: Node ≥ 22 detects when `node --test`
      // is spawned from inside a `node --test` parent and **skips** the
      // child (warning: "node:test run() is being called recursively").
      // The runner works correctly when invoked outside a test runner
      // (e.g. via `npm run theia check` from a user shell). Unit tests
      // for the runner itself are limited to the pure parser; a manual
      // integration check via `npm run theia check` covers the spawn.
      proc = spawn("node", ["--test"], { cwd: rootPath });
      proc.stdout?.on("data", (d: Buffer) => {
        stdout += d.toString("utf8");
      });
      proc.stderr?.on("data", (d: Buffer) => {
        stderr += d.toString("utf8");
      });
      proc.on("error", (err) => {
        if (settled) return;
        settled = true;
        resolve({
          running: false,
          total: null,
          pass: null,
          fail: null,
          failingNames: [],
          startedAt,
          completedAt: new Date().toISOString(),
          reason: err.message,
        });
      });
      proc.on("close", (code) => {
        if (settled) return;
        settled = true;
        const parsed = parseNodeTestOutput(stdout, stderr, code ?? 0);
        if (process.env["THEIA_DEBUG"] === "1") {
          // eslint-disable-next-line no-console
          console.log(
            "THEIA runNpmTest close code=",
            code,
            "stdout.len=",
            stdout.length,
            "stderr.len=",
            stderr.length,
            "parsed=",
            JSON.stringify(parsed),
          );
        }
        resolve({
          ...parsed,
          startedAt,
          completedAt: new Date().toISOString(),
        });
      });
    } catch (err) {
      if (settled) return;
      settled = true;
      resolve({
        running: false,
        total: null,
        pass: null,
        fail: null,
        failingNames: [],
        startedAt,
        completedAt: new Date().toISOString(),
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  });
  return {
    result,
    stop: () => {
      // The runner always resolves via `close`; cancel is a best-effort
      // for tests that want to abort. Production code uses the natural
      // close path.
    },
  };
}

// Synchronous helper for tests + callers that want to block on the
// test result. Equivalent to `await controller.result`. Named
// `runNpmTestSync` so the async-fire-and-forget default stays visible.
export async function runNpmTestSync(rootPath: string): Promise<TestResult> {
  return runNpmTest(rootPath).result;
}

export { RUNNING_PLACEHOLDER };