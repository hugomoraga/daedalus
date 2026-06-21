// AC-6 (Spec 008): versioning.
// In-flight instances remain bound to their original (workflowName, version).
// New instances use the latest deployed version.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonlEventStoreAdapter } from "@daedalus/jsonl-event-store";
import { JsonlInstanceStoreAdapter, JsonlWorkflowStoreAdapter } from "@daedalus/workflow-engine/adapters";
import {
  coreUseCases,
  noOpPolicy,
  runEngine,
  WorkflowInstanceStarted,
  type EngineDeps,
} from "@daedalus/workflow-engine";
import type { CoreDeps } from "@daedalus/core";

test("AC-6: in-flight instances bind to their original version", async () => {
  const baseDir = mkdtempSync(join(tmpdir(), "daedalus-ac6-"));
  const tenantId = "tenant-0";
  mkdirSync(join(baseDir, "blueprints", "workflows"), { recursive: true });
  mkdirSync(join(baseDir, "config", "tenants", tenantId), { recursive: true });

  // v0.1.0: draft -> {on:LeadQualified} -> qualified -> terminal
  writeFileSync(
    join(baseDir, "blueprints", "workflows", "ver.json"),
    JSON.stringify({
      name: "ver",
      version: "0.1.0",
      initial: "draft",
      terminal: ["qualified"],
      contexts: {},
      states: {
        draft: { on: { LeadQualified: [{ id: "d-to-q", target: "qualified" }] } },
        qualified: {},
      },
    }) + "\n",
  );
  writeFileSync(join(baseDir, "config", "tenants", tenantId, "workflows.json"), "[]\n");

  let counter = 0;
  const eventStore = new JsonlEventStoreAdapter(baseDir);
  const core: CoreDeps = {
    eventStore,
    newId: () => `id-${++counter}`,
    now: () => "2026-06-13T00:00:00.000Z",
    actor: "test",
  };
  const deps: EngineDeps = {
    ...core,
    policy: noOpPolicy,
    workflowStore: new JsonlWorkflowStoreAdapter(baseDir),
    instanceStore: new JsonlInstanceStoreAdapter(baseDir),
    useCases: coreUseCases(core),
  };

  // Seed: start an instance under v0.1.0.
  await eventStore.append({
    eventId: "old-1",
    type: "LeadQualified",
    tenantId,
    occurredAt: "2026-06-13T00:00:00.000Z",
    actor: "test",
    causationId: null,
    correlationId: "flow-old",
    payload: {},
  });
  let handle = runEngine(deps, tenantId, { pollMs: 10 });
  await new Promise((r) => setTimeout(r, 150));
  handle.stop();
  await new Promise((r) => setTimeout(r, 30));

  // Now deploy v0.2.0 with an extra state in between.
  writeFileSync(
    join(baseDir, "blueprints", "workflows", "ver.v0.2.0.json"),
    JSON.stringify({
      name: "ver",
      version: "0.2.0",
      initial: "draft",
      terminal: ["qualified"],
      contexts: {},
      states: {
        draft: { on: { LeadQualified: [{ id: "d-to-i", target: "intermediate" }] } },
        intermediate: { on: { AutoAdvance: [{ id: "i-to-q", target: "qualified" }] } },
        qualified: {},
      },
    }) + "\n",
  );

  // Emit AutoAdvance for the existing instance — v0.1.0 doesn't have a
  // transition for AutoAdvance, so the instance must remain stuck under v0.1.0.
  await eventStore.append({
    eventId: "auto-1",
    type: "AutoAdvance",
    tenantId,
    occurredAt: "2026-06-13T00:00:01.000Z",
    actor: "test",
    causationId: null,
    correlationId: "flow-old",
    payload: {},
  });
  handle = runEngine(deps, tenantId, { pollMs: 10 });
  await new Promise((r) => setTimeout(r, 150));
  handle.stop();
  await new Promise((r) => setTimeout(r, 30));

  // Old instance stays on qualified/v0.1.0 (the AutoAdvance was ignored by v0.1.0).
  const oldInstance = (await deps.instanceStore.findByCorrelationId(tenantId, "flow-old")).find(
    (i) => i.workflowVersion === "0.1.0",
  );
  assert.ok(oldInstance, "old instance bound to v0.1.0");
  assert.equal(oldInstance!.currentState, "qualified");

  // New instance under v0.2.0 reaches intermediate on LeadQualified.
  await eventStore.append({
    eventId: "new-1",
    type: "LeadQualified",
    tenantId,
    occurredAt: "2026-06-13T00:00:02.000Z",
    actor: "test",
    causationId: null,
    correlationId: "flow-new",
    payload: {},
  });
  handle = runEngine(deps, tenantId, { pollMs: 10 });
  await new Promise((r) => setTimeout(r, 200));
  handle.stop();
  await new Promise((r) => setTimeout(r, 30));

  const allInstances = await deps.instanceStore.findByCorrelationId(tenantId, "flow-new");
  const newInstance = allInstances.find(
    (i) => i.workflowVersion === "0.2.0",
  );
  assert.ok(newInstance, "new instance bound to v0.2.0");
  assert.equal(newInstance!.currentState, "intermediate");
  // Started event for flow-new must reference v0.2.0.
  const events = await eventStore.readStream(tenantId);
  const newStart = events.find(
    (e) => e.type === WorkflowInstanceStarted && e.correlationId === "flow-new",
  );
  assert.equal(newStart!.payload.workflowVersion, "0.2.0");
});