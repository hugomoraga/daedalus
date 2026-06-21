# ADR-005 — Add ATLAS as a read-only mission-control driving adapter

**Status:** Proposed
**Date:** 2026-06-20
**Deciders:** Stewards
**Trigger:** [Spec 007](../../specs/007-atlas-ui/spec.md) ratified (PR #16); [Roadmap](../../docs/roadmap.md) Phase 1 closed.
**Related:** [Constitution](../../memory/constitution.md), [Technical Principles](../../memory/technical-principles.md), [Identity](../../docs/identity.md), [Roadmap](../../docs/roadmap.md), [ADR-002](./ADR-002-adopt-technical-framework.md), [ADR-003](./ADR-003-modular-monorepo.md), [ADR-004](./ADR-004-export-discipline-and-lineage.md)

---

## Context

Daedalus's Phase 1 (Organizational Core) is shipped. The Core exposes its value chain `Lead → Payment` as 14 events and five projections; three modules (Proposal Generation, Revenue Visibility, Opportunity Discovery) add derived read-models over the same stream. The event store is replayable, tenant-scoped, and auditable.

The Technical Principles §"Avoid for now" list includes **"Web UI"** — placed there to prevent premature UI adoption before the platform's value chain, events, and projection surfaces were real.

That condition has now flipped. With live projections and a closed value chain, the operator (Tenant 0's founder) is the bottleneck of inspection: every view of state requires CLI commands. There is no **read-only mission-control surface** — only the CLI, which is the right tool for writes but the wrong tool for sustained observability.

Spec 007 (PR #16, merged) defines **ATLAS** as a second driving adapter parallel to `apps/cli/`. Its design is intentionally constrained: read-only, multi-tenant by default, zero external runtime dependencies, no business logic, no writes, no auth in v0, no charts library, no glassmorphism or neon. Sections without backing read-models are **absent**, not placeholders. Visual identity is encoded as design tokens, not screenshots.

This ADR records the architectural decision: **ATLAS is admitted as a driving adapter**, and the "Web UI" item in the Avoid-for-now list is **conditionally retired** — only for ATLAS as specified.

---

## Decision

1. **Add ATLAS as a second driving adapter**, parallel to `apps/cli/`. It is a composition root; it contains no business logic. It is a **read-only consumer** of Core projections and module read-models.

2. **Conditionally retire the "Web UI" item** in [Technical Principles §"Avoid for now"](../../memory/technical-principles.md). The retirement applies **only** to ATLAS as defined in [Spec 007](../../specs/007-atlas-ui/spec.md). The general principle against premature UI work stands; this is a named exception, not a blanket reversal.

3. **No new Core primitives.** ATLAS consumes existing projections and the event stream. It introduces no new aggregates, events, ports, projections, or read models. If a future panel needs data not already projected, that panel waits — it does not invent a Core primitive.

4. **Multi-tenant by construction.** ATLAS is tenant-scoped on every query. The tenant switcher is explicit and confirmed; cross-tenant state never persists.

5. **Zero external runtime dependencies.** `apps/atlas/package.json` declares no `dependencies`. Fonts are static assets in `apps/atlas/assets/fonts/`. Visualizations are hand-authored SVG using tokens. No charts library, no UI framework, no CDN.

6. **Token discipline is enforced in CI.** A token linter test fails the build if any source file outside `tokens.ts` contains a raw color literal, a font-family outside the trio (`Inter Tight`, `Inter`, `JetBrains Mono`), or a numeric spacing outside the scale.

7. **Sections activate as their backing models land.** ~6 of 11 sections are viable today (Welcome, Events, Activity, Logs, System Health, plus v1 Throughput/Monitoring). The remaining four (Active Processes, Queue Status, Workflow Metrics, Integrations) activate with Phase 2 (workflow engine) and Phase 5 (agent runtime + integrations). Until they activate, they are **absent**, not empty (AC-6 in Spec 007).

8. **Phase 1+ placement.** ATLAS appears as a Phase 1 milestone in the [Roadmap](../../docs/roadmap.md) — after the two module milestones (Proposal Generation, Revenue Visibility) — because it consumes their projections.

---

## Consequences

**Positive**

- Operator visibility without rewriting or forking the read layer: ATLAS is pure consumer.
- Reuses Canon discipline (hexagonal layers, export discipline per ADR-004, lineage per ADR-004). No new patterns introduced.
- Design tokens + linter prevent the most common failure mode of UI work: drift toward marketing aesthetics.
- Section viability rule (AC-6) prevents premature-placeholder UI pollution.
- Read-only contract protects Principle 4 (Auditability by Default): the operator's window onto the audit trail is honest, not an alternate write surface.

**Negative / risks**

- *Mission-control creep.* A future contributor adds animations, glassmorphism, or chart libraries chasing the design brief's hero aesthetic. **Mitigation:** Spec 007 §9 non-goals are binding; token linter catches the most visible drift; Constitution Principle 9 (*Simplicity First*) is the cultural guardrail.
- *Write-path drift.* Someone builds "Approve here" because the UX demands it. **Mitigation:** AC-1 in Spec 007 (every non-`GET`/`HEAD` request returns 405 with the equivalent CLI command surfaced). Tested in `tests/atlas-readonly.test.ts`.
- *Tenant leakage.* The read layer is the most likely place to break isolation. **Mitigation:** AC-2 + a dedicated two-tenant isolation test (`tests/atlas-tenant-isolation.test.ts`).
- *Token drift.* Hotfix introduces a hex literal. **Mitigation:** AC-5 — token linter runs in CI.
- *Scope creep into Phase 2/5 sections.* Implementing Active Processes, Queue, Workflow Metrics, Integrations before their backing engines exist. **Mitigation:** panel viability rule (AC-6); sections are absent until the projection exists.

**Cost**

- `apps/atlas/` adds a Node 22 SSR process. No new build step, no new infra.
- Static font assets (~3 WOFF2 files per family × 3 families ≈ a few hundred KB) shipped once.
- 8 acceptance-criteria tests added; existing 88 stay green.

---

## What this ADR does NOT do

- Does **not** authorize any new Core event, aggregate, projection, or port.
- Does **not** authorize write paths in ATLAS (writes continue to flow through the CLI until Phase 4 Agent Runtime).
- Does **not** authorize authentication, real-time push (SSE/WebSocket), PDF export, dark theme, mobile-first, i18n, or charts libraries.
- Does **not** introduce a read-API server. ATLAS reads JSONL server-side via existing Core ports; the browser never receives raw JSONL.
- Does **not** change the Constitution, the [Identity](../../docs/identity.md) document, the [Domain Model](../../docs/domain-model.md), or any ratified spec's intent.
- Does **not** retire "Web UI" from the Avoid-for-now list in general. The list keeps its teeth for any UI work that does not match ATLAS's constraints.

---

## Acceptance (gate for steward ratification)

This ADR moves ATLAS into the roadmap only when **all** of the following hold:

1. **Spec 007 is ratified.** *(Done — merged in PR #16.)*
2. **An ADR exists moving ATLAS into the roadmap.** *(This ADR; pending steward ratification.)*
3. **The founder (Tenant 0) confirms the v0 panel list** (Welcome, Events, Activity, Logs, System Health, plus v1 Throughput/Monitoring) matches their operator needs.

T-01…T-16 in [Spec 007 tasks](../../specs/007-atlas-ui/tasks.md) may begin only after these three are satisfied.

---

## Companion change: Roadmap amendment

This ADR ships together with a minimal amendment to the [Roadmap](../../docs/roadmap.md):

- Add ATLAS v0 as a Phase 1 milestone, after Proposal Generation v0 and Revenue Visibility v0.
- Add ATLAS v1 (Throughput + Monitoring) as a Phase 1+ follow-on, dependent on Revenue Visibility v1's projections being stable.

No other sections of the roadmap change. Phase 2, 3, 4, 5 are unaffected.

---

*Subordinate to the [Constitution](../../memory/constitution.md) and [Technical Principles](../../memory/technical-principles.md). A named exception to the "Avoid for now" list, not a reversal of the principle.*