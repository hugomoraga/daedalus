# Plan — Opportunity Discovery v0 (implementation)

**Status:** Draft · implementation plan for [Spec 003](./spec.md)
**Goal:** Build the leanest **hexagonal** slice that validates the upstream module pattern — a module that produces Core domain events on handoff, proving the bidirectional composition: Proposal Generation *consumes* Core events; Opportunity Discovery *produces* them.
**Conforms to:** [Technical Principles](../../memory/technical-principles.md), [ADR-003](../../governance/decisions/ADR-003-modular-monorepo.md), [ADR-004](../../governance/decisions/ADR-004-export-discipline-and-lineage.md)
**Version:** 0.1.0
**Last updated:** 2026-06-14

> The `/plan` step: *how* we build Opportunity Discovery v0. The spec defines *what*. We build the leanest slice that exercises the canonical chain **and** a new pattern: module → Core event production (qualification handoff).

---

## 1. Technical context (per the framework)

| Decision | Choice | Source |
|---|---|---|
| Language / runtime | TypeScript on Node.js | confirmed |
| Architecture | **Hexagonal** — Domain / Application / Ports / Adapters | Technical Principles §2 |
| Interface | **CLI** as first driving adapter, **no business logic** | Technical Principles · First-Phase |
| Persistence | **JSONL append-only** (events) + **JSON file** (opportunity work-area) behind ports | Technical Principles · First-Phase |
| Event store | **`EventStorePort`** + **`JsonlEventStoreAdapter`** | Technical Principles · First-Phase |
| Dependencies | Minimal / zero external (`fs`, `node:test`, `node:util`) | Simplicity First |
| Testing | `node:test` encoding Spec 003 acceptance criteria | — |

---

## 2. Architecture — hexagonal in a modular monorepo

```
packages/core/                          # @daedalus/core (CHANGES: add LeadDiscarded event, OpportunityStorePort removed — module owns it)
  src/domain/value-chain.ts             #   + LeadDiscarded constant
  src/application/projections.ts        #   + projectLead handles LeadDiscarded
  src/index.ts                           #   + LeadDiscarded export
packages/opportunity-discovery/          # @daedalus/opportunity-discovery (depends on @daedalus/core)
  src/domain/events.ts                  #   OpportunitySurfaced, OpportunityEnriched, OpportunityQualified, OpportunityDismissed
  src/domain/opportunity.ts             #   opportunity aggregate (surfaced/qualified/dismissed)
  src/application/surface-opportunity.ts #   use case
  src/application/enrich-opportunity.ts #   use case
  src/application/qualify-opportunity.ts #   use case (module milestone + Core handoff)
  src/application/dismiss-opportunity.ts#   use case
  src/application/projections.ts        #   pipeline projection (read-model)
  src/application/ports/opportunity-store.ts  #   OpportunityStorePort (work-area, like DraftStorePort)
  src/application/deps.ts              #   OpportunityDiscoveryDeps = CoreDeps & { opportunityStore }
  src/index.ts                         #   public contract
  src/adapters/json-opportunity-store.ts #   adapter
  src/adapters/index.ts                 #   adapter barrel
apps/cli/src/index.ts                   #   + opportunity commands
config/tenants/tenant-0.ts             #   + "opportunity-discovery" in enabledModules
```

### Core change: `LeadDiscarded` + optional `opportunityId` on `LeadCreated`

The **smallest generic change** to Core:
1. Add `LeadDiscarded` to `value-chain.ts` — the Event Catalog already lists it.
2. Add `opportunityId` as an **optional** field to the `LeadCreated` payload — when the Lead originates from Opportunity Discovery, it carries the lineage. Direct `lead:create` still works without it.
3. Update `projectLead` to handle `LeadDiscarded` (transitions `Lead` to `discarded` state, a new state added to `LeadState`).

### The opportunity work-area (like ProposalDraft)

Consistent with Spec 002 §6 and Technical Principles: the **live state of a surfaced opportunity** is a mutable work-area behind a port. Only the four milestone transitions (`surfaced`, `enriched`, `qualified`, `dismissed`) emit events. Day-to-day enrichment mutates the work-area but also emits `OpportunityEnriched` (per Spec 003 §6 decision: enrichment records what was known at decision time).

### Lineage (the key pattern: module → Core production)

```
OpportunitySurfaced(correlationId=C, eventId=O1, payload={opportunityId, label, source})
   └─ enrich → OpportunityEnriched(correlationId=C, causationId=O1, payload={opportunityId, description, contact})
   └─ qualify → OpportunityQualified(correlationId=C, causationId=O?, payload={opportunityId})
                  + LeadCreated      (correlationId=C, payload={leadId, customer, opportunityId})
                  + LeadQualified    (correlationId=C, causationId=leadCreated.eventId)
```

The qualification use case shares one `correlationId` across the module milestone and the Core handoff events, exactly mirroring the `ProposalDraftFinalized` + `ProposalGenerated` pattern from Spec 002.

---

## 3. CLI commands (v0)

| Command | Use case | Emits / does |
|---|---|---|
| `opportunity:surface --tenant t0 --label <l> --source <s>` | surface-opportunity | `OpportunitySurfaced`; creates work-area |
| `opportunity:enrich --tenant t0 --opportunity <id> [--description <d>] [--contact <c>]` | enrich-opportunity | `OpportunityEnriched`; mutates work-area |
| `opportunity:qualify --tenant t0 --opportunity <id>` | qualify-opportunity | `OpportunityQualified` + `LeadCreated` + `LeadQualified` |
| `opportunity:dismiss --tenant t0 --opportunity <id> --reason <r>` | dismiss-opportunity | `OpportunityDismissed` |
| `opportunity:show --tenant t0 --opportunity <id>` | (read) | print opportunity work-area |
| `opportunity:pipeline --tenant t0` | (read) | print pipeline by state (surfaced/qualified/dismissed) |
| `lead:discard --tenant t0 --lead <id>` | discard-lead | `LeadDiscarded` (Core addition) |

> **`lead:discard`** is added to Core and the CLI to complete the Lead lifecycle per the Event Catalog. It is a small, necessary addition — not scope creep from Opportunity Discovery.

---

## 4. Build steps (lean, inside-out per hexagonal)

1. **Core: add `LeadDiscarded`** — event type constant, update `LeadState` to `"unqualified" | "qualified" | "discarded"`, implement `discardLead`, update `projectLead`, add `discardLeadUseCase`, update Core barrel. Update `createLead` to accept optional `opportunityId` in payload.

2. **Domain events** — define `OpportunitySurfaced`, `OpportunityEnriched`, `OpportunityQualified`, `OpportunityDismissed` in `domain/events.ts`.

3. **Opportunity aggregate** — `Opportunity` type, `OpportunityState` (`"surfaced" | "qualified" | "dismissed"`), factory functions: `surfaceOpportunity`, `enrichOpportunity`, `qualifyOpportunity`, `dismissOpportunity`. Only surface/enrich/qualify/dismiss are state transitions; `qualified` and `dismissed` are terminal.

4. **Ports** — `OpportunityStorePort` (load/save, same pattern as `DraftStorePort`), `OpportunityDiscoveryDeps = CoreDeps & { opportunityStore, leadStore }`.

5. **JSON adapter** — `JsonOpportunityStoreAdapter` (mirrors `JsonFileDraftStoreAdapter` pattern).

6. **Use cases** — `surfaceOpportunityUseCase`, `enrichOpportunityUseCase`, `qualifyOpportunityUseCase`, `dismissOpportunityUseCase`. The qualify use case is the critical one: it emits the module milestone + Core event pair with shared lineage.

7. **Pipeline projection** — `projectPipeline(events)`: returns `{ surfaced, qualified, dismissed }` with counts and opportunity summaries, derived by replay.

8. **CLI** — add all `opportunity:*` and `lead:discard` commands to the CLI driving adapter.

9. **Tests** — `node:test` encoding all AC from Spec 003 plus the existing tests.

10. **Evidence run** — scripted E2E session.

11. **`.gitignore`** — already has `.data/`; no changes needed.

---

## 5. Acceptance-criteria → test mapping

| Spec 003 AC | Covered by |
|---|---|
| AC-1 (surface: event emitted, appears in pipeline) | Steps 2-3 + 6-7 |
| AC-2 (enrich: event emitted; closed state rejected) | Steps 3 + 6 |
| AC-3 (qualify: module + Core events with lineage; idempotent rejection) | Steps 3 + 6 (the key composition test) |
| AC-4 (dismiss: event with reason; closed state rejected) | Steps 3 + 6 |
| AC-5 (pipeline projection: grouped by state, no event on read) | Steps 7-8 |
| AC-6 (state reconstructable from event stream) | Steps 7 + 9 |
| AC-7 (auditability: lineage on every event) | Steps 6 + 9 |
| AC-8 (tenant isolation) | Step 9 |

Plus: existing Core + Proposal Generation + Revenue Visibility tests stay green.

---

## 6. The evidence we capture

A recorded end-to-end session (synthetic data only):

```
opportunity:surface t0 "ACME consulting" --source referral  -> OpportunitySurfaced
opportunity:enrich t0 <oppId> --description "Infrastructure review" --contact "cxo@acme.com"
                                                          -> OpportunityEnriched
opportunity:qualify t0 <oppId>                           -> OpportunityQualified + LeadCreated + LeadQualified
opportunity:pipeline t0                                  -> pipeline summary
opportunity:surface t0 "Beta Corp" --source cold         -> OpportunitySurfaced
opportunity:dismiss t0 <oppId2> --reason "bad fit"      -> OpportunityDismissed
opportunity:pipeline t0                                  -> 1 qualified, 1 dismissed
proposal:start t0 <leadId> --template standard             -> ProposalDraftCreated (cross-module: qualified lead → proposal)
events t0                                                -> full audit trail with lineage
```

This demonstrates:
1. The full canonical chain for Opportunity Discovery (surface → enrich → qualify → Lead handoff).
2. The bidirectional module pattern: Proposal Generation *consumes* Core events; Opportunity Discovery *produces* them.
3. The dismiss path (negative audit trail).
4. Cross-module composition: a Lead produced by Opportunity Discovery flows into Proposal Generation without friction.

---

## 7. Package export discipline

Per [ADR-004](../../governance/decisions/ADR-004-export-discipline-and-lineage.md) and Technical Principles:

- `@daedalus/opportunity-discovery` exposes `.` (public contract: use cases, command types, domain types needed to consume them).
- Adapters behind `./adapters` subpath.
- No deep imports. The `exports` block in `package.json` enforces this.

---

## 8. Scope guardrails (do NOT build in v0)

- No automated prospecting, scoring, or AI assistance.
- No multi-step qualification workflows.
- No integration with external sources (email, CRM, social).
- No pipeline alerts or health signals (deferred per §9 of the spec).
- No UI, API, or database.
- No replacement for `lead:create` / `lead:qualify` (those stay in Core for direct use).
- From the framework's "avoid" list: no CQRS, sagas, DI framework, relational DB, event bus, etc.

---

## 9. Definition of done (v0)

- The canonical chain `Command → Use Case → Aggregate → Domain Events → Event Store Port → JSONL Adapter → CLI` runs cleanly for Opportunity Discovery.
- All acceptance-criteria tests pass (`node --test`).
- Qualification emits exactly one `OpportunityQualified` + one `LeadCreated` + one `LeadQualified`, all sharing a `correlationId`.
- State is reconstructable by replaying the JSONL log; two tenants show zero cross-leakage.
- Existing tests (Core, Proposal Generation, Revenue Visibility) remain green.
- CLI contains no business logic; domain knows nothing of JSONL.
- `.data/` gitignored; no PII in the repo.

---

*Subordinate to [Spec 003](./spec.md), the [Constitution](../../memory/constitution.md), and [Technical Principles](../../memory/technical-principles.md). Implementation plan — the build is the next step.*