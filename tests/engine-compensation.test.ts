// AC-5 (Spec 008): single-step compensation.
// Given an instance in `approved` with a previous transition ProjectCreated -> created,
// When an action throws,
// Then the engine invokes the compensating action of the prior transition, emits the
// corresponding cancellation event, and emits WorkflowInstanceCompensated.

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
  WorkflowInstanceCompensated,
  WorkflowTransitionFired,
  type EngineDeps,
  type UseCaseInvoker,
} from "@daedalus/workflow-engine";
import type { CoreDeps } from "@daedalus/core";

test("AC-5: action throw triggers compensate action + WorkflowInstanceCompensated", async () => {
  const baseDir = mkdtempSync(join(tmpdir(), "daedalus-ac5-"));
  const tenantId = "tenant-0";
  mkdirSync(join(baseDir, "blueprints", "workflows"), { recursive: true });
  mkdirSync(join(baseDir, "config", "tenants", tenantId), { recursive: true });

  // Custom workflow: ready -> {on:Start} -> worked -> {on:Break} -> broken (terminal)
  // `worked` has an action that throws. `ready` -> worked transition has a
  // compensate: `emitBreakageRecorded` (a registered invoker that appends a
  // synthetic cancellation event for the test).
  writeFileSync(
    join(baseDir, "blueprints", "workflows", "ac5.json"),
    JSON.stringify({
      name: "ac5",
      version: "0.1.0",
      initial: "ready",
      terminal: ["broken"],
      contexts: {},
      states: {
        ready: {
          on: {
            Start: [{ id: "ready-to-worked", target: "worked" }],
          },
        },
        worked: {
          on: {
            Break: [
              {
                id: "worked-to-broken",
                target: "broken",
                actions: [{ useCase: "explodeUseCase", args: {} }],
                compensate: { useCase: "recordBreakageUseCase", args: {} },
              },
            ],
          },
        },
        broken: {},
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

  // Test use cases: explode throws; recordBreakage emits a synthetic event.
  const explode: UseCaseInvoker = async () => {
    throw new Error("intentional test failure");
  };
  const recordBreakage: UseCaseInvoker = async (_cmd, runtime) => {
    await runtime.eventStore.append({
      eventId: `comp-${++counter}`,
      type: "BreakageRecorded",
      tenantId,
      occurredAt: "2026-06-13T00:00:00.000Z",
      actor: "test",
      causationId: null,
      correlationId: "flow-1",
      payload: {},
    });
  };

  const deps: EngineDeps = {
    ...core,
    policy: noOpPolicy,
    workflowStore: new JsonlWorkflowStoreAdapter(baseDir),
    instanceStore: new JsonlInstanceStoreAdapter(baseDir),
    useCases: { ...coreUseCases(core), explodeUseCase: explode, recordBreakageUseCase: recordBreakage },
  };

  await eventStore.append({
    eventId: "start",
    type: "Start",
    tenantId,
    occurredAt: "2026-06-13T00:00:00.000Z",
    actor: "test",
    causationId: null,
    correlationId: "flow-1",
    payload: {},
  });
  await eventStore.append({
    eventId: "break",
    type: "Break",
    tenantId,
    occurredAt: "2026-06-13T00:00:01.000Z",
    actor: "test",
    causationId: "start",
    correlationId: "flow-1",
    payload: {},
  });

  const handle = runEngine(deps, tenantId, { pollMs: 10 });
  await new Promise((r) => setTimeout(r, 250));
  handle.stop();
  await new Promise((r) => setTimeout(r, 50));

  const events = await eventStore.readStream(tenantId);
  const breakage = events.find((x) => x.type === "BreakageRecorded");
  assert.ok(breakage, "compensate action invoked and BreakageRecorded emitted");
  const compensated = events.find((x) => x.type === WorkflowInstanceCompensated);
  assert.ok(compensated, "WorkflowInstanceCompensated emitted");
  assert.equal(compensated!.payload.failingTransitionId, "worked-to-broken");
  assert.match(compensated!.payload.failureReason, /intentional test failure/);
  // The transition never fired (it threw); the compensation fired instead.
  const fired = events.find(
    (x) => x.type === WorkflowTransitionFired && x.payload.transitionId === "worked-to-broken",
  );
  assert.equal(fired, undefined, "failed transition did not emit WorkflowTransitionFired");
});