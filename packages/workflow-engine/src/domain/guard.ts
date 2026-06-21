// Pure guard evaluator. No I/O, no side effects, no globals.
// A guard decides whether a transition fires when its trigger event arrives.
// v0 supports a small tagged union; richer DSLs are explicit future work.

import type { DomainEvent } from "@daedalus/core";
import type { Instance } from "./instance.ts";
import type { GuardExpr, StateRef } from "./workflow.ts";

// Read a dotted field path from an arbitrary object. Returns undefined for
// any miss (missing segment, null intermediate, non-object terminal).
function readPath(obj: unknown, path: string): unknown {
  if (obj == null || typeof obj !== "object") return undefined;
  let cur: unknown = obj;
  for (const segment of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[segment];
  }
  return cur;
}

export function evaluateGuard(
  guard: GuardExpr | undefined,
  event: DomainEvent,
  instance: Instance,
): boolean {
  if (!guard) return true;
  switch (guard.kind) {
    case "always":
      return true;
    case "payloadEquals":
      return readPath(event.payload, guard.field) === guard.value;
    case "stateIn": {
      const allowed = new Set<StateRef>(guard.states);
      return allowed.has(instance.currentState);
    }
  }
}