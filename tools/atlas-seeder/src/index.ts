// Public surface for @daedalus/atlas-seeder.
// Re-exports the seeder's pure helpers (scenario, lineage, jsonl builder).
// The CLI itself lives at src/cli.ts and is invoked via `node` — no `bin`
// shim is needed (per ADR-007 pattern: tools/theia uses the same shape).

export { SCENARIO, type ScenarioEvent } from "./scenario.ts";
export { buildSeedEvents, buildSeedJsonl, SEED, todayUtcMidnight, type SeedOptions, type SeedResult } from "./seed.ts";
export { deterministicId } from "./deterministic-id.ts";
