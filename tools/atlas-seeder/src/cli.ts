#!/usr/bin/env node
// Atlas demo seeder — CLI entry point.
// Usage:
//   node tools/atlas-seeder/src/cli.ts seed [--tenant <id>] [--data-dir <path>]
//   node tools/atlas-seeder/src/cli.ts check [--tenant <id>]
//   node tools/atlas-seeder/src/cli.ts --help
//
// Default tenant: "tenant-demo". Refuses to seed "tenant-0" (Constitution P6).

import { parseArgs } from "node:util";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { JsonlEventStoreAdapter } from "@daedalus/jsonl-event-store";
import { buildSeedEvents } from "./seed.ts";

const FORBIDDEN_TENANTS = new Set(["tenant-0"]);
const DEFAULT_TENANT = "tenant-demo";
const DEFAULT_DATA_DIR = ".data";

type Mode = "seed" | "check" | "help";

function parseCli(argv: readonly string[]): { mode: Mode; tenant: string; dataDir: string } {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      tenant: { type: "string" },
      "data-dir": { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help === true) return { mode: "help", tenant: DEFAULT_TENANT, dataDir: DEFAULT_DATA_DIR };
  const command = positionals[0];
  if (command === undefined || command === "help") return { mode: "help", tenant: DEFAULT_TENANT, dataDir: DEFAULT_DATA_DIR };
  if (command !== "seed" && command !== "check") {
    console.error(`error: unknown command "${command}". Use 'seed', 'check', or --help.`);
    process.exitCode = 2;
    return { mode: "help", tenant: DEFAULT_TENANT, dataDir: DEFAULT_DATA_DIR };
  }
  return {
    mode: command,
    tenant: values.tenant ?? DEFAULT_TENANT,
    dataDir: values["data-dir"] ?? DEFAULT_DATA_DIR,
  };
}

function usage(): void {
  console.log(
    [
      "atlas-seeder — populate a tenant JSONL with the demo scenario (Spec 013).",
      "",
      "Usage:",
      "  node tools/atlas-seeder/src/cli.ts seed [--tenant <id>] [--data-dir <path>]",
      "  node tools/atlas-seeder/src/cli.ts check [--tenant <id>]",
      "  node tools/atlas-seeder/src/cli.ts --help",
      "",
      "Defaults:",
      `  --tenant    ${DEFAULT_TENANT}`,
      `  --data-dir  ${DEFAULT_DATA_DIR}`,
      "",
      "Refuses to seed: " + [...FORBIDDEN_TENANTS].join(", ") + " (Constitution P6).",
      "",
      "Examples:",
      `  node tools/atlas-seeder/src/cli.ts seed`,
      `  node tools/atlas-seeder/src/cli.ts check`,
    ].join("\n"),
  );
}

async function runSeed(tenant: string, dataDir: string): Promise<void> {
  if (FORBIDDEN_TENANTS.has(tenant)) {
    console.error(`error: refusing to seed "${tenant}" (Constitution Principle 6 — Tenant Isolation).`);
    console.error(`       This tenant belongs to the founder's real professional activity.`);
    console.error(`       Use --tenant ${DEFAULT_TENANT} (the dev fixture).`);
    process.exitCode = 4;
    return;
  }
  const tenantDir = join(dataDir, "tenants", tenant);
  // Idempotent: clear the tenant's event log before writing. Other tenants in
  // the same .data/ directory are untouched.
  await rm(tenantDir, { recursive: true, force: true });

  const { events } = buildSeedEvents({ tenantId: tenant });
  const store = new JsonlEventStoreAdapter(dataDir);
  for (const e of events) {
    await store.append(e);
  }

  const last = events[events.length - 1];
  console.log(`✓ seeded ${events.length} events for tenant "${tenant}"`);
  console.log(`  path:  ${tenantDir}/events.jsonl`);
  if (last !== undefined) {
    console.log(`  last:  ${last.type} @ ${last.occurredAt}`);
  }
  console.log(`  start Atlas:  node apps/atlas/src/cli.ts serve`);
  console.log(`  then open:    http://127.0.0.1:8788/t/${tenant}/welcome`);
}

async function runCheck(tenant: string): Promise<void> {
  if (FORBIDDEN_TENANTS.has(tenant)) {
    console.error(`error: refusing to check "${tenant}".`);
    process.exitCode = 4;
    return;
  }
  const { events } = buildSeedEvents({ tenantId: tenant });
  const byType = new Map<string, number>();
  for (const e of events) {
    byType.set(e.type, (byType.get(e.type) ?? 0) + 1);
  }
  console.log(`scenario check for tenant "${tenant}"`);
  console.log(`  total events: ${events.length}`);
  for (const [type, count] of byType) {
    console.log(`  - ${type.padEnd(28)} ${count}`);
  }
  // Lineage invariants
  const corrStart = events.filter((e) => e.causationId === null).length;
  const derived = events.filter((e) => e.causationId !== null).length;
  console.log(`  correlations started: ${corrStart}`);
  console.log(`  derived events:       ${derived}`);
}

async function main(): Promise<void> {
  const { mode, tenant, dataDir } = parseCli(process.argv.slice(2));
  switch (mode) {
    case "help":
      usage();
      return;
    case "seed":
      await runSeed(tenant, dataDir);
      return;
    case "check":
      await runCheck(tenant);
      return;
  }
}

main().catch((err: unknown) => {
  console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
