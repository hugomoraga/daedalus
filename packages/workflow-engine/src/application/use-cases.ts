// Use-case registry — names → invokers.
// Composition roots (engine CLI, tests) build the registry once at boot.
// The engine resolves `transition.actions[i].useCase` against this map at
// runtime (Spec 008 R2 — mismatches fail closed at boot).
//
// Why invokers return void: Core's use cases append events to `deps.eventStore`
// directly. The engine wraps the event store in a CapturingEventStore
// (see ./capturing-store.ts) to observe what the actions emitted without
// changing their signatures.

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

export type UseCaseInvoker = (command: Record<string, unknown>) => Promise<void>;
export type UseCaseRegistry = Record<string, UseCaseInvoker>;

// Build a registry of every Core use case for v0. Phase 2+ may add module
// use cases here (e.g. revenue-visibility's confirmRevenueUseCase) — those
// will require module-side opt-in and a future spec.
export function coreUseCases(deps: CoreDeps): UseCaseRegistry {
  return {
    createLeadUseCase: (cmd) =>
      createLeadUseCase(deps, cmd as Parameters<typeof createLeadUseCase>[1]).then(() => undefined),
    qualifyLeadUseCase: (cmd) =>
      qualifyLeadUseCase(deps, cmd as Parameters<typeof qualifyLeadUseCase>[1]).then(() => undefined),
    discardLeadUseCase: (cmd) =>
      discardLeadUseCase(deps, cmd as Parameters<typeof discardLeadUseCase>[1]).then(() => undefined),
    submitProposalUseCase: (cmd) =>
      submitProposalUseCase(deps, cmd as Parameters<typeof submitProposalUseCase>[1]).then(() => undefined),
    rejectProposalUseCase: (cmd) =>
      rejectProposalUseCase(deps, cmd as Parameters<typeof rejectProposalUseCase>[1]).then(() => undefined),
    approveProposalUseCase: (cmd) =>
      approveProposalUseCase(deps, cmd as Parameters<typeof approveProposalUseCase>[1]).then(() => undefined),
    recordPaymentReceivedUseCase: (cmd) =>
      recordPaymentReceivedUseCase(
        deps,
        cmd as Parameters<typeof recordPaymentReceivedUseCase>[1],
      ).then(() => undefined),
    createProjectUseCase: (cmd) =>
      createProjectUseCase(deps, cmd as Parameters<typeof createProjectUseCase>[1]).then(() => undefined),
    markProjectDeliveredUseCase: (cmd) =>
      markProjectDeliveredUseCase(
        deps,
        cmd as Parameters<typeof markProjectDeliveredUseCase>[1],
      ).then(() => undefined),
    closeProjectUseCase: (cmd) =>
      closeProjectUseCase(deps, cmd as Parameters<typeof closeProjectUseCase>[1]).then(() => undefined),
    issueInvoiceUseCase: (cmd) =>
      issueInvoiceUseCase(deps, cmd as Parameters<typeof issueInvoiceUseCase>[1]).then(() => undefined),
    sendInvoiceUseCase: (cmd) =>
      sendInvoiceUseCase(deps, cmd as Parameters<typeof sendInvoiceUseCase>[1]).then(() => undefined),
    payInvoiceUseCase: (cmd) =>
      payInvoiceUseCase(deps, cmd as Parameters<typeof payInvoiceUseCase>[1]).then(() => undefined),
    markInvoiceOverdueUseCase: (cmd) =>
      markInvoiceOverdueUseCase(
        deps,
        cmd as Parameters<typeof markInvoiceOverdueUseCase>[1],
      ).then(() => undefined),
  };
}

// Fail closed at boot if a workflow references an unknown use case. Surfaces
// typos and missing registrations before the engine ever dispatches an event.
export function assertRegistryClosed(registry: UseCaseRegistry, required: string[]): void {
  const missing = required.filter((name) => !(name in registry));
  if (missing.length > 0) {
    throw new Error(
      `use-case registry missing required names: ${missing.join(", ")}`,
    );
  }
}