# agents/

Bounded executors. Agents perform tasks *within* policy and workflow boundaries — they never define organizational behavior.

## Constitutional limits (Article IV)
An agent **may** execute tasks authorized by an active policy, read data within its tenant scope, emit events, and propose actions for human approval.

An agent **must not** define or modify policy, take irreversible actions without authorization (and human approval where required), act outside its tenant scope, act without producing a traceable event, escalate its own privileges, or make strategic decisions reserved for humans.

Every agent action carries its lineage — authorizing policy, triggering cause, agent identity, tenant scope — or it does not run. Every action emits `AgentActionExecuted` (see [Event Catalog](../docs/event-catalog.md)).

## What belongs here
- Agent definitions and their bounded capabilities.
- The mapping from each agent to the policies that authorize it.

*Activated in Phase 4 (Agent Runtime). Empty scaffolding in Phase 0 — agents come last by design, after policy and workflow exist to govern them.*
