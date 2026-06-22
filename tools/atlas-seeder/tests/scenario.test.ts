// Tests for tools/atlas-seeder (Spec 013).
// Run: node --test tools/atlas-seeder/tests/*.test.ts
//
// All tests use mkdtemp() — never the repo's .data/. Per AGENTS.md, .data/ is
// gitignored and per-worktree; tests must not write into the real .data/.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { buildSeedEvents } from "../src/seed.ts";
import { deterministicId } from "../src/deterministic-id.ts";
import { SCENARIO } from "../src/scenario.ts";

describe("atlas-seeder — scenario", () => {
  it("produces at least 15 events", () => {
    const { events } = buildSeedEvents({ tenantId: "tenant-demo" });
    assert.ok(events.length >= 15, `expected ≥15, got ${events.length}`);
  });

  it("covers at least one full Lead → ProjectClosed arc", () => {
    const { events } = buildSeedEvents({ tenantId: "tenant-demo" });
    const types = events.map((e) => e.type);
    const required = [
      "LeadCreated",
      "LeadQualified",
      "ProposalGenerated",
      "ProposalSubmitted",
      "ProposalApproved",
      "ProjectCreated",
      "ProjectDelivered",
      "InvoiceIssued",
      "InvoiceSent",
      "PaymentReceived",
      "InvoicePaid",
      "ProjectClosed",
    ];
    for (const t of required) {
      assert.ok(types.includes(t), `scenario missing ${t}`);
    }
  });

  it("includes a RevenueEstimateCreated derived from ProposalApproved (followFrom)", () => {
    const { events } = buildSeedEvents({ tenantId: "tenant-demo" });
    const approved = events.find((e) => e.type === "ProposalApproved");
    const estimate = events.find((e) => e.type === "RevenueEstimateCreated");
    assert.ok(approved !== undefined, "ProposalApproved must exist");
    assert.ok(estimate !== undefined, "RevenueEstimateCreated must exist");
    assert.equal(estimate!.causationId, approved!.eventId, "estimate must derive from ProposalApproved");
    assert.equal(estimate!.correlationId, approved!.correlationId, "estimate must share correlation");
  });

  it("includes a FinancialRiskFlagged", () => {
    const { events } = buildSeedEvents({ tenantId: "tenant-demo" });
    const flagged = events.find((e) => e.type === "FinancialRiskFlagged");
    assert.ok(flagged !== undefined, "FinancialRiskFlagged must exist");
    assert.equal(flagged!.payload.ruleId, "revenue_concentration");
  });

  it("includes a LeadDiscarded", () => {
    const { events } = buildSeedEvents({ tenantId: "tenant-demo" });
    assert.ok(events.some((e) => e.type === "LeadDiscarded"));
  });

  it("every event has full lineage fields populated", () => {
    const { events } = buildSeedEvents({ tenantId: "tenant-demo" });
    for (const e of events) {
      assert.ok(e.eventId.length > 0, `eventId empty on ${e.type}`);
      assert.ok(e.tenantId === "tenant-demo", `wrong tenantId on ${e.type}`);
      assert.ok(e.occurredAt.length > 0, `occurredAt empty on ${e.type}`);
      assert.ok(e.actor.length > 0, `actor empty on ${e.type}`);
      assert.ok(e.correlationId.length > 0, `correlationId empty on ${e.type}`);
      assert.ok(e.causationId === null || typeof e.causationId === "string");
    }
  });

  it("scenario references are consistent (every cause resolves)", () => {
    const { events } = buildSeedEvents({ tenantId: "tenant-demo" });
    assert.equal(events.length, SCENARIO.length, "1:1 between scenario entries and emitted events");
  });
});

describe("atlas-seeder — deterministic id", () => {
  it("produces a valid v4-shaped UUID", () => {
    const id = deterministicId("test-seed", 0);
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("is stable: same seed+counter → same id", () => {
    const a = deterministicId("seed", 7);
    const b = deterministicId("seed", 7);
    assert.equal(a, b);
  });

  it("varies by counter", () => {
    const a = deterministicId("seed", 0);
    const b = deterministicId("seed", 1);
    assert.notEqual(a, b);
  });

  it("varies by seed", () => {
    const a = deterministicId("seed-a", 0);
    const b = deterministicId("seed-b", 0);
    assert.notEqual(a, b);
  });
});

describe("atlas-seeder — CLI", () => {
  it("produces byte-identical JSONL across two runs into separate temp dirs", () => {
    const dirA = mkdtempSync(join(tmpdir(), "seed-a-"));
    const dirB = mkdtempSync(join(tmpdir(), "seed-b-"));
    const cli = join(process.cwd(), "tools/atlas-seeder/src/cli.ts");
    const a = spawnSync("node", [cli, "seed", "--tenant", "tenant-demo", "--data-dir", dirA], { encoding: "utf8" });
    const b = spawnSync("node", [cli, "seed", "--tenant", "tenant-demo", "--data-dir", dirB], { encoding: "utf8" });
    assert.equal(a.status, 0, `run A failed: ${a.stderr}`);
    assert.equal(b.status, 0, `run B failed: ${b.stderr}`);
    const fa = readFileSync(join(dirA, "tenants/tenant-demo/events.jsonl"), "utf8");
    const fb = readFileSync(join(dirB, "tenants/tenant-demo/events.jsonl"), "utf8");
    assert.equal(fa, fb, "two runs of seed must produce byte-identical files");
  });

  it("refuses to seed --tenant tenant-0 (exit 4, no file written)", () => {
    const dir = mkdtempSync(join(tmpdir(), "seed-forbidden-"));
    const cli = join(process.cwd(), "tools/atlas-seeder/src/cli.ts");
    const res = spawnSync("node", [cli, "seed", "--tenant", "tenant-0", "--data-dir", dir], { encoding: "utf8" });
    assert.equal(res.status, 4, `expected exit 4, got ${res.status}; stderr: ${res.stderr}`);
    assert.equal(existsSync(join(dir, "tenants/tenant-0/events.jsonl")), false, "tenant-0 must NOT have a file");
  });

  it("--help exits 0 and prints usage", () => {
    const cli = join(process.cwd(), "tools/atlas-seeder/src/cli.ts");
    const res = spawnSync("node", [cli, "--help"], { encoding: "utf8" });
    assert.equal(res.status, 0);
    assert.match(res.stdout, /Usage:/);
  });
});

// Smoke that the built seed file is valid JSONL end-to-end.
describe("atlas-seeder — JSONL round-trip", () => {
  it("every line in the produced JSONL parses to a DomainEvent-shaped object", () => {
    const dir = mkdtempSync(join(tmpdir(), "seed-roundtrip-"));
    const cli = join(process.cwd(), "tools/atlas-seeder/src/cli.ts");
    const res = spawnSync("node", [cli, "seed", "--tenant", "tenant-demo", "--data-dir", dir], { encoding: "utf8" });
    assert.equal(res.status, 0);
    const file = join(dir, "tenants/tenant-demo/events.jsonl");
    const lines = readFileSync(file, "utf8").split("\n").filter((l) => l.trim().length > 0);
    for (const line of lines) {
      const e = JSON.parse(line) as Record<string, unknown>;
      for (const f of ["eventId", "type", "tenantId", "occurredAt", "actor", "causationId", "correlationId", "payload"]) {
        assert.ok(f in e, `field ${f} missing in ${line.slice(0, 60)}…`);
      }
    }
  });
});
