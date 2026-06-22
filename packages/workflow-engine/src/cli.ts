// Workflow Engine CLI entry. Wires the JSONL adapters and the core use-case
// registry, then runs the engine loop for a single tenant.
//
// Usage:
//   node packages/workflow-engine/src/cli.ts run --tenant tenant-0 [--poll-ms 200]
//
// The CLI is intentionally tiny: argument parsing, composition, run. No
// business logic (per Technical Principles §First-Phase).

import { join } from "node:path";
import type { CoreDeps } from "@daedalus/core";
import { JsonlEventStoreAdapter } from "@daedalus/jsonl-event-store";
import { JsonFileDraftStoreAdapter } from "@daedalus/proposal-generation/adapters";
import { JsonlInstanceStoreAdapter, JsonlWorkflowStoreAdapter } from "./adapters/index.ts";
import type { EngineDeps } from "./application/deps.ts";
import { runEngine } from "./application/engine.ts";
import { noOpPolicy } from "./application/ports/policy.ts";
import { coreUseCases, proposalGenerationUseCases } from "./application/use-cases.ts";

type ParsedArgs = {
  command: string | null;
  tenantId: string | null;
  pollMs: number;
};

function parseArgs(argv: readonly string[]): ParsedArgs {
  let command: string | null = null;
  let tenantId: string | null = null;
  let pollMs = 200;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--tenant") {
      tenantId = argv[++i] ?? null;
    } else if (a === "--poll-ms") {
      const v = Number(argv[++i]);
      pollMs = Number.isFinite(v) && v > 0 ? v : 200;
    } else if (command === null && !a.startsWith("--")) {
      command = a;
    }
  }
  return { command, tenantId, pollMs };
}

function coreDeps(): CoreDeps {
  return {
    eventStore: new JsonlEventStoreAdapter(process.cwd()),
    newId: () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    now: () => new Date().toISOString(),
    actor: "workflow-engine",
  };
}

function engineDeps(core: CoreDeps, _tenantId: string): EngineDeps {
  return {
    ...core,
    policy: noOpPolicy,
    workflowStore: new JsonlWorkflowStoreAdapter(process.cwd()),
    // Match the JSONL event store's `.data` convention: instance files live at
    // `<cwd>/.data/tenants/<id>/workflow-instances.jsonl`. The instance store
    // adapter itself no longer appends `.data/` — callers pass the data root.
    instanceStore: new JsonlInstanceStoreAdapter(join(process.cwd(), ".data")),
    useCases: {
      ...coreUseCases(core),
      ...proposalGenerationUseCases({
        draftStore: new JsonFileDraftStoreAdapter(process.cwd()),
      }),
    },
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.command !== "run") {
    console.error("usage: workflow-engine run --tenant <id> [--poll-ms <ms>]");
    process.exit(2);
  }
  if (args.tenantId === null) {
    console.error("--tenant <id> is required");
    process.exit(2);
  }
  const core = coreDeps();
  const deps = engineDeps(core, args.tenantId);
  const handle = runEngine(deps, args.tenantId, { pollMs: args.pollMs });
  process.on("SIGINT", () => handle.stop());
  process.on("SIGTERM", () => handle.stop());
  // Keep the process alive — the engine runs on its own polling loop.
  await new Promise(() => undefined);
}

await main();