// AC-3 (Spec 008): action invocation + lineage capture.
// Given a transition ProposalApproved -> approved with action createProjectUseCase,
// When a ProposalApproved event arrives,
// Then the engine invokes the use case (capturing ProjectCreated in lineage) and
// emits WorkflowTransitionFired with the project creation referenced in its payload.

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
  WorkflowTransitionFired,
  type EngineDeps,
} from "@daedalus/workflow-engine";
import type { CoreDeps } from "@daedalus/core";

test("AC-3: action invocation + lineage capture", async () => {
  const baseDir = mkdtempSync(join(tmpdir(), "daedalus-ac3-"));
  const tenantId = "tenant-0";
  mkdirSync(join(baseDir, "blueprints", "workflows"), { recursive: true });
  mkdirSync(join(baseDir, "config", "tenants", tenantId), { recursive: true });

  // Custom workflow: draft -> {on:LeadQualified} -> qualified -> {on:ProposalApproved} -> approved
  // (the approved transition invokes createProjectUseCase).
  writeFileSync(
    join(baseDir, "blueprints", "workflows", "ac3.json"),
    JSON.stringify({
      name: "ac3",
      version: "0.1.0",
      initial: "draft",
      terminal: ["approved"],
      contexts: {},
      states: {
        draft: {
          on: {
            LeadQualified: [{ id: "d-to-q", target: "qualified" }],
          },
        },
        qualified: {
          on: {
            ProposalApproved: [
              {
                id: "q-to-a",
                target: "approved",
                actions: [
                  {
                    useCase: "createProjectUseCase",
                    args: { _event: true },
                  },
                ],
              },
            ],
          },
        },
        approved: {},
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

  // Seed: lead + proposal + proposal approved events.
  // createProjectUseCase requires a ProposalApproved event with proposalId in
  // payload; and it reads prior events to verify state.
  await eventStore.append({
    eventId: "lead-c",
    type: "LeadCreated",
    tenantId,
    occurredAt: "2026-06-13T00:00:00.000Z",
    actor: "test",
    causationId: null,
    correlationId: "flow-1",
    payload: { leadId: "lead-1", customer: "Acme" },
  });
  await eventStore.append({
    eventId: "lead-q",
    type: "LeadQualified",
    tenantId,
    occurredAt: "2026-06-13T00:00:01.000Z",
    actor: "test",
    causationId: "lead-c",
    correlationId: "flow-1",
    payload: { leadId: "lead-1" },
  });
  await eventStore.append({
    eventId: "prop-g",
    type: "ProposalGenerated",
    tenantId,
    occurredAt: "2026-06-13T00:00:02.000Z",
    actor: "test",
    causationId: "lead-q",
    correlationId: "flow-1",
    payload: {
      proposalId: "prop-1",
      leadId: "lead-1",
      expectedValue: { amount: 6000, currency: "USD" },
    },
  });
  await eventStore.append({
    eventId: "prop-a",
    type: "ProposalApproved",
    tenantId,
    occurredAt: "2026-06-13T00:00:03.000Z",
    actor: "test",
    causationId: "prop-g",
    correlationId: "flow-1",
    payload: { proposalId: "prop-1" },
  });

  const handle = runEngine(deps, tenantId, { pollMs: 10 });
  await new Promise((r) => setTimeout(r, 250));
  handle.stop();
  await new Promise((r) => setTimeout(r, 50));

  const events = await eventStore.readStream(tenantId);
  const projectCreated = events.find((x) => x.type === "ProjectCreated");
  assert.ok(projectCreated, "createProjectUseCase was invoked");

  const fired = events.find(
    (x) => x.type === WorkflowTransitionFired && x.payload.transitionId === "q-to-a",
  );
  assert.ok(fired, "WorkflowTransitionFired for q-to-a emitted");
  assert.deepEqual(fired!.payload.actionEventIds, [projectCreated!.eventId]);
  assert.deepEqual(fired!.payload.actionEventTypes, ["ProjectCreated"]);
  assert.equal(fired!.payload.transitionId, "q-to-a");
  assert.equal(fired!.payload.toState, "approved");
});