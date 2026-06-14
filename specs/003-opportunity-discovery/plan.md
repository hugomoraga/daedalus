# Plan — Opportunity Discovery v0 (implementation)

**Status:** Draft · implementation plan for [Spec 003](./spec.md)
**Goal:** Build the leanest **hexagonal** slice that resolves the §11 open boundary for v0 and validates the upstream module pattern — a module that both enriches and produces Core domain events.
**Conforms to:** [Technical Principles](../../memory/technical-principles.md), [ADR-003](../../governance/decisions/ADR-003-modular-monorepo.md), [ADR-004](../../governance/decisions/ADR-004-export-discipline-and-lineage.md)
**Version:** 0.1.0
**Last updated:** 2026-06-14

> **§11 boundary resolution (v0).** The spec deliberately leaves open whether this is one bounded context or two (Discovery vs Engagement/Qualification). Per the spec's own decision rule — "settled by implementation evidence, not more modeling" — this v0 resolves it as **one module** with a simplified lifecycle: `Opportunity` with states `surfaced → qualified | dismissed`. The rationale:
>
> - Tenant 0 is a solo commercial founder. The Discovery/Engagement distinction is immaterial at this stage — the founder records an opportunity and qualifies or dismisses it manually.
> - The spec names event types as provisional ("names provisional, final event set settled at implementation"). This v0 uses `OpportunitySurfaced`, `OpportunityEnriched`, `OpportunityQualified`, `OpportunityDismissed` — aligning with the Event Catalog rather than the provisional §6 names.
> - If a second tenant (community/creative) makes the models diverge, the split into two contexts is cheap because the module boundary is already hexagonal.
> - The §12 privacy flag is respected: only mock/synthetic data in this phase. No PII.

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
packages/core/                          # @daedalus/core (CHANGES: +LeadDiscarded, +opportunityId on LeadCreated)
  src/domain/value-chain.ts             #   + LeadDiscarded constant
  src/domain/lead.ts                    #   + discardLead(), LeadState:"discarded", optional opportunityId
  src/application/projections.ts        #   + handle LeadDiscarded
  src/application/discard-lead.ts       #   new use case
  src/index.ts                           #   + LeadDiscarded export
packages/opportunity-discovery/          # @daedalus/opportunity-discovery (depends on @daedalus/core)
  src/domain/events.ts                  #   OpportunitySurfaced, OpportunityEnriched, OpportunityQualified, OpportunityDismissed
  src/domain/opportunity.ts             #   opportunity aggregate (surfaced/qualified/dismissed)
  src/application/surface-opportunity.ts #   use case
  src/application/enrich-opportunity.ts #   use case
  src/application/qualify-opportunity.ts #   use case (module milestone + Core handoff)
  src/application/dismiss-opportunity.ts #   use case
  src/application/projections.ts        #   pipeline projection (read-model)
  src/application/ports/opportunity-store.ts  #   OpportunityStorePort (work-area)
  src/application/deps.ts              #   OpportunityDiscoveryDeps = CoreDeps & { opportunityStore }
  src/index.ts                         #   public contract
  src/adapters/json-opportunity-store.ts #   adapter
  src/adapters/index.ts                 #   adapter barrel
apps/cli/src/index.ts                   #   + opportunity commands, + lead:discard
config/tenants/tenant-0.ts             #   + "opportunity-discovery" in enabledModules
```

### §11 boundary resolution — v0 simplification

The spec identifies two halves: **Discovery** (evaluate/prioritize) and **Engagement/Qualification** (contact/qualify). For Tenant 0 (a solo commercial founder where manual entry is the only source), these collapse into a single lifecycle:

```
surfaced ──(enrich: event)──► surfaced
    │ qualify                              │ dismiss
    ▼                                      ▼
qualified (→ Core LeadCreated + LeadQualified)   dismissed (with reason)
```

- `OpportunitySurfaced` covers both `EntityDiscovered` and `EntityPrioritized` — in v0, recording an entity *is* prioritizing it (manual, face value).
- `OpportunityEnriched` covers the engagement half — recording what was known when the founder updated the opportunity's context.
- `OpportunityQualified` covers `InterestDetected` + the Core handoff.
- `OpportunityDismissed` covers the negative outcome (no explicit equivalent in the provisional §6 table; it's "the decision not to pursue").

This simplification is **evidence-based per the spec's own rule**: build one module, split when a second tenant makes the models diverge.

### Lineage (the key pattern: module → Core production)

```
OpportunitySurfaced(correlationId=C, eventId=O1, payload={opportunityId, label, source})
   └─ enrich → OpportunityEnriched(correlationId=C, causationId=O?, payload={opportunityId, description, contact})
   └─ qualify → OpportunityQualified(correlationId=C, payload={opportunityId, leadId})
                  + LeadCreated      (correlationId=C, payload={leadId, customer, opportunityId})
                  + LeadQualified    (correlationId=C, causationId=leadCreated.eventId, payload={leadId})
```

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
| `lead:discard --tenant t0 --lead <id> --reason <r>` | discard-lead | `LeadDiscarded` (Core addition) |

---

## 4. Acceptance-criteria → test mapping

| Spec 003 AC | Covered by |
|---|---|
| AC-1 (surface: event emitted, appears in pipeline) | Domain + use case + projection tests |
| AC-2 (enrich: event emitted; closed state rejected) | Domain + use case tests |
| AC-3 (qualify: module + Core events with lineage; idempotent rejection) | Use case tests (the key composition test) |
| AC-4 (handoff: no Core entity beyond Lead) | AC-3 produces LeadCreated + LeadQualified; no new Core entity |
| AC-5 (auditability: lineage on every event) | All tests verify lineage fields |
| AC-6 (isolation: tenant-scoped) | Separate tenant tests |
| Dismissal (negative outcome) | Use case tests |

Plus: existing Core + Proposal Generation + Revenue Visibility tests stay green.

---

## 5. The evidence we capture

A recorded end-to-end session (synthetic data only):

```
opportunity:surface t0 "ACME consulting" --source referral   -> OpportunitySurfaced
opportunity:enrich t0 <oppId> --description "Infra review" --contact "cto@acme.com"
                                                            -> OpportunityEnriched
opportunity:qualify t0 <oppId>                             -> OpportunityQualified + LeadCreated + LeadQualified
opportunity:pipeline t0                                    -> pipeline summary
opportunity:surface t0 "Beta Corp" --source cold           -> OpportunitySurfaced
opportunity:dismiss t0 <oppId2> --reason "bad fit"      -> OpportunityDismissed
opportunity:pipeline t0                                    -> 1 qualified, 1 dismissed
proposal:start t0 <leadId> --template standard             -> ProposalDraftCreated (cross-module)
events t0                                                  -> full audit trail with lineage
```

Demonstrates the bidirectional composition: Proposal Generation *consumes* Core events; Opportunity Discovery *produces* them. A Lead from Opportunity Discovery flows into Proposal Generation without friction.

---

## 6. Definition of done (v0)

- The canonical chain `Command → Use Case → Aggregate → Domain Events → Event Store Port → JSONL Adapter → CLI` runs cleanly for Opportunity Discovery.
- All acceptance-criteria tests pass (`node --test`).
- Qualification emits exactly one `OpportunityQualified` + one `LeadCreated` + one `LeadQualified`, all sharing a `correlationId`.
- State is reconstructable by replaying the JSONL log; two tenants show zero cross-leakage.
- Existing tests (Core, Proposal Generation, Revenue Visibility) remain green.
- CLI contains no business logic; domain knows nothing of JSONL.
- `.data/` gitignored; no PII in the repo.
- The §11 boundary is resolved for v0 (documented above). The split into two contexts remains cheap if evidence demands it.

---

*Subordinate to [Spec 003](./spec.md), the [Constitution](../../memory/constitution.md), and [Technical Principles](../../memory/technical-principles.md). Implementation plan — the build is the next step.*