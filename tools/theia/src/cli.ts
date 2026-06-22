// Theia (Spec 012) — CLI entry point (PR 8).
//
// `serve` starts the HTTP server on 127.0.0.1 (default 8789, env
// THEIA_PORT, flag --port). Rejects 0.0.0.0 (binding security).
// `check` parses the repo and prints a summary to stdout (no server).
// Default command (no args) prints HELP.
//
// Both commands accept `--root <path>` to override the repo root
// (defaults to cwd).

import { parseArgs } from "node:util";
import { parseRepo } from "./parser.ts";
import { createTheiaServer } from "./server.ts";

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
  "PRs 2–7 wired: specs + ADRs + phases + inventory + useCases +",
  "blockers + diff + test runner. PR 8 wires the HTTP server +",
  "Atlas-token-reusing views.",
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
  if (h === "0.0.0.0" || h === "::") {
    throw new Error(`Theia binds to 127.0.0.1 only. Rejecting ${h}.`);
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
  const server = await createTheiaServer({ port, host, root });
  await server.listen();
  console.log(`theia serve  listening on http://${host}:${port}  root=${root}`);
  console.log("(refresh = re-request; Tests panel updates without restart)");
  // Keep the process alive until SIGINT.
  await new Promise<void>((resolve) => {
    const onSigInt = () => {
      server.close().finally(() => resolve());
    };
    process.once("SIGINT", onSigInt);
    process.once("SIGTERM", onSigInt);
  });
}

async function check(values: Record<string, string | undefined>): Promise<void> {
  const root = readRoot(values);
  const result = await parseRepo(root);
  const state = result.state;
  console.log(`theia check  root=${root}  computedAt=${state.computedAt}`);
  console.log(`  specs=${state.specs.length}  adrs=${state.adrs.length}  useCases=${state.useCases.length}`);
  console.log(`  codeInventory=${state.codeInventory.length}  phases=${state.phases.length}  activePhase=${state.activePhase}`);
  console.log(`  diffAvailable=${state.diff.available}  testsRunning=${state.tests.running}`);
  console.log("(PRs 2–8 wired: specs + ADRs + phases + inventory + useCases + blockers + diff + test runner + server + views.)");
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