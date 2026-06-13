# policies/

First-class policies — the source of organizational behavior.

**Policy before Agent** (Principle 2): policies define what is and is not allowed; agents only execute within these boundaries. A policy is a declarative statement evaluated *before* a governed action, separate from the workflow or agent that acts.

## Design lineage
Modeled on **Policy-as-Code** practice (e.g. Open Policy Agent / Rego): policies are versioned, testable, and evaluated as a decision distinct from enforcement. We adopt the *separation of decision from enforcement*, not necessarily a specific engine — that choice is deferred to Phase 3 (Policy Engine).

## What belongs here
- Versioned policy definitions, each traceable to a `PolicyDefined` / `PolicyAmended` event.
- Tests proving a policy decides as intended.

## Constitutional limits
- Policies are subordinate only to the [Constitution](../../memory/constitution.md) (decision hierarchy, Article III).
- No agent may define, modify, or reinterpret a policy (Article IV).

*Activated in Phase 3. Empty scaffolding in Phase 0.*
