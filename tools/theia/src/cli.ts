// Theia (Spec 012) — CLI entry stub.
//
// PR 1 ships `serve` + `check` + default-help dispatch. The handlers
// are minimal — they print and exit. PR 8 wires the real HTTP server
// and the parser-backed `check` summary.
//
// `serve` and `check` accept the same options PR 8 will accept, but
// most are no-ops in the stub. Port handling per Spec Q0 resolution:
//   THEIA_PORT env var → --port CLI flag → default 8789.

import { parseArgs } from "node:util";

const HELP = [
  "Theia — read-only project-state visualizer (Spec 012, ADR-007)",
  "",
  "Usage: node tools/theia/src/cli.ts <command> [--options]",
  "",
  "Commands:",
  "  serve   start the HTTP server on 127.0.0.1 (default port 8789)",
  "  check   parse the repo and print a summary to stdout (no server)",
  "",
  "Options:",
  "  --port <n>      override port (default: 8789; env: THEIA_PORT)",
  "  --host <h>      override host (default: 127.0.0.1; rejected if 0.0.0.0)",
  "  --root <path>   repo root to inspect (default: cwd)",
  "",
  "Status: stub. The parser returns an empty ProjectState. PR 2–7 wire",
  "        the spec/ADR/phase/code/blocker/diff/test parsing. PR 8",
  "        wires the HTTP server.",
].join("\n");

function readPort(values: Record<string, string | undefined>): number {
  const fromFlag = values.port !== undefined ? Number(values.port) : NaN;
  if (Number.isFinite(fromFlag) && fromFlag > 0) return fromFlag;
  const fromEnv = process.env["THEIA_PORT"];
  if (fromEnv !== undefined && fromEnv.length > 0) {
    const n = Number(fromEnv);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 8789;
}

function readHost(values: Record<string, string | undefined>): string {
  const h = values.host ?? "127.0.0.1";
  if (h === "0.0.0.0") {
    throw new Error("Theia binds to 127.0.0.1 only. Rejecting 0.0.0.0.");
  }
  return h;
}

function readRoot(values: Record<string, string | undefined>): string {
  return values.root ?? process.cwd();
}

async function serve(values: Record<string, string | undefined>): Promise<void> {
  const port = readPort(values);
  const host = readHost(values);
  const root = readRoot(values);
  // TODO PR-8: replace with createTheiaServer({ port, host }).listen().
  console.log(`theia serve  host=${host}  port=${port}  root=${root}`);
  console.log("(stub — HTTP server wired in PR 8)");
}

async function check(values: Record<string, string | undefined>): Promise<void> {
  const root = readRoot(values);
  // TODO PR-8: replace with parseRepo(root) + pretty summary render.
  const { parseRepo } = await import("./parser.ts");
  const state = parseRepo(root);
  console.log(`theia check  root=${root}  computedAt=${state.computedAt}`);
  console.log(`  specs=${state.specs.length}  adrs=${state.adrs.length}  useCases=${state.useCases.length}`);
  console.log(`  phases=${state.phases.length}  activePhase=${state.activePhase}  diffAvailable=${state.diff.available}`);
  console.log("(PRs 2–3 wired: specs + ADRs + phases. PRs 4–7 fill code/useCases/blockers/diff/tests.)");
}

export async function main(argv: readonly string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      port: { type: "string" },
      host: { type: "string" },
      root: { type: "string" },
    },
  });
  const command = positionals[0];
  if (command === undefined) {
    console.log(HELP);
    return 0;
  }
  if (command === "serve") {
    await serve(values);
    return 0;
  }
  if (command === "check") {
    await check(values);
    return 0;
  }
  console.log(HELP);
  return 1;
}

// Allow direct execution: `node tools/theia/src/cli.ts serve`.
if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (err: unknown) => {
      console.error(`theia: ${err instanceof Error ? err.message : String(err)}`);
      process.exitCode = 1;
    },
  );
}
