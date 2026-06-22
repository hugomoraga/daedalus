// Use-case registry — names → invokers.
// Composition roots (engine CLI, tests) build the registry once at boot.
// The engine resolves `transition.actions[i].useCase` against this map at
// runtime (Spec 008 R2 — mismatches fail closed at boot).
//
// Invokers take `runtimeDeps` at call time, not closure time. The engine
// wraps the event store in a CapturingEventStore before each dispatch tick;
// use cases must use the wrapped store so the engine can capture the events
// the actions emit and reference them in WorkflowTransitionFired's lineage
// (Spec 008 AC-3).

import type { CoreDeps } from "@daedalus/core";
import {
  approveProposalUseCase,
  closeProjectUseCase,
  createLeadUseCase,
  createProjectUseCase,
  discardLeadUseCase,
  issueInvoiceUseCase,
  markInvoiceOverdueUseCase,
  payInvoiceUseCase,
  qualifyLeadUseCase,
  recordPaymentReceivedUseCase,
  rejectProposalUseCase,
  sendInvoiceUseCase,
  submitProposalUseCase,
} from "@daedalus/core";
import { startDraftUseCase } from "@daedalus/proposal-generation";

export type UseCaseInvoker = (
  command: Record<string, unknown>,
  runtimeDeps: CoreDeps,
) => Promise<void>;
export type UseCaseRegistry = Record<string, UseCaseInvoker>;

// Build a registry of every Core use case for v0. Phase 2+ may add module
// use cases here (e.g. revenue-visibility's confirmRevenueUseCase) — those
// will require module-side opt-in and a future spec.
//
// The `deps` argument here is only used to satisfy Core's static signatures
// (which require deps on construction); the runtime deps (with the wrapped
// event store) are passed by the engine at call time. We forward runtime
// deps — closure-captured `deps` is intentionally unused inside each invoker.
export function coreUseCases(_deps: CoreDeps): UseCaseRegistry {
  void _deps;
  return {
    createLeadUseCase: (cmd, runtime) =>
      createLeadUseCase(runtime, cmd as Parameters<typeof createLeadUseCase>[1]).then(() => undefined),
    qualifyLeadUseCase: (cmd, runtime) =>
      qualifyLeadUseCase(runtime, cmd as Parameters<typeof qualifyLeadUseCase>[1]).then(() => undefined),
    discardLeadUseCase: (cmd, runtime) =>
      discardLeadUseCase(runtime, cmd as Parameters<typeof discardLeadUseCase>[1]).then(() => undefined),
    submitProposalUseCase: (cmd, runtime) =>
      submitProposalUseCase(runtime, cmd as Parameters<typeof submitProposalUseCase>[1]).then(() => undefined),
    rejectProposalUseCase: (cmd, runtime) =>
      rejectProposalUseCase(runtime, cmd as Parameters<typeof rejectProposalUseCase>[1]).then(() => undefined),
    approveProposalUseCase: (cmd, runtime) =>
      approveProposalUseCase(runtime, cmd as Parameters<typeof approveProposalUseCase>[1]).then(() => undefined),
    recordPaymentReceivedUseCase: (cmd, runtime) =>
      recordPaymentReceivedUseCase(
        runtime,
        cmd as Parameters<typeof recordPaymentReceivedUseCase>[1],
      ).then(() => undefined),
    createProjectUseCase: (cmd, runtime) =>
      createProjectUseCase(runtime, cmd as Parameters<typeof createProjectUseCase>[1]).then(() => undefined),
    markProjectDeliveredUseCase: (cmd, runtime) =>
      markProjectDeliveredUseCase(
        runtime,
        cmd as Parameters<typeof markProjectDeliveredUseCase>[1],
      ).then(() => undefined),
    closeProjectUseCase: (cmd, runtime) =>
      closeProjectUseCase(runtime, cmd as Parameters<typeof closeProjectUseCase>[1]).then(() => undefined),
    issueInvoiceUseCase: (cmd, runtime) =>
      issueInvoiceUseCase(runtime, cmd as Parameters<typeof issueInvoiceUseCase>[1]).then(() => undefined),
    sendInvoiceUseCase: (cmd, runtime) =>
      sendInvoiceUseCase(runtime, cmd as Parameters<typeof sendInvoiceUseCase>[1]).then(() => undefined),
    payInvoiceUseCase: (cmd, runtime) =>
      payInvoiceUseCase(runtime, cmd as Parameters<typeof payInvoiceUseCase>[1]).then(() => undefined),
    markInvoiceOverdueUseCase: (cmd, runtime) =>
      markInvoiceOverdueUseCase(
        runtime,
        cmd as Parameters<typeof markInvoiceOverdueUseCase>[1],
      ).then(() => undefined),
  };
}

// Fail closed at boot if a workflow references an unknown use case. Surfaces
// typos and missing registrations before the engine ever dispatches an event.
export function assertRegistryClosed(registry: UseCaseRegistry, required: string[]): void {
  const missing = required.filter((name) => !(name in registry));
  if (missing.length > 0) {
    throw new Error(`use-case registry missing required names: ${missing.join(", ")}`);
  }
}

// Build the module-specific use cases the workflow engine can invoke. The
// returned registry is meant to be merged with `coreUseCases(coreDeps)`.
//
// Spec 002 v1 enables `LeadQualified` → auto-start-draft via this registry.
// Future spec increments (Revenue Visibility v2, Opportunity Discovery v1)
// will append here with their own module deps.
//
// Invokers close over the module-specific deps (e.g. `draftStore`) at
// factory time but accept the engine's runtime `CoreDeps` per call, so the
// CapturingEventStore wrap is honored.
import type { DraftStorePort } from "@daedalus/proposal-generation";

export type ProposalGenerationModuleDeps = {
  draftStore: DraftStorePort;
};

export function proposalGenerationUseCases(
  moduleDeps: ProposalGenerationModuleDeps,
): UseCaseRegistry {
  return {
    startDraftUseCase: (cmd, runtime) => {
      // Compose Core + module deps at call time so the engine's capturing
      // event store is honored.
      const composed = { ...runtime, ...moduleDeps };
      return startDraftUseCase(
        composed as Parameters<typeof startDraftUseCase>[0],
        cmd as Parameters<typeof startDraftUseCase>[1],
      ).then(() => undefined);
    },
  };
}