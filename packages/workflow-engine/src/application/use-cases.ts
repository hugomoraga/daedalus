// Use-case registry — the seam by which the engine invokes Core / module use
// cases. Workflows reference use cases by name (string). The composition root
// (engine CLI / tests) constructs the registry; the engine resolves names
// against it at runtime (Spec 008 R2 — mismatches fail closed at boot).

import type { DomainEvent, Lineage } from "@daedalus/core";

// A use-case invoker: takes a command-shaped object, returns the events
// emitted by that use case. The engine does not know use case internals.
export type UseCaseInvoker = (
  command: Record<string, unknown>,
  lineage: Lineage,
) => Promise<DomainEvent[]>;

export type UseCaseRegistry = Record<string, UseCaseInvoker>;