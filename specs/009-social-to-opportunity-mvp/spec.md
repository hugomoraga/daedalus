# Spec 009 — Inbound Discovery Agent (MVP)

**Status:** Draft · Phase 4 (planning — earliest buildable, gated on Phase 2 + Phase 3 + this ratification)
**Type:** Module slice + reusable capability — the first end-to-end agent scenario
**Owner:** Stewards
**Version:** 0.3.0 (forward-looking observations from the second architectural review)
**Last updated:** 2026-06-23

> **Method.** Spec-first (Constitution, Principle 8). Defines *what* the MVP does and *why*, not *how*. Conceptual — no JSON shapes, no code, no vendor selection, no API key handling.

> **Revision note (v0.3.0).** v0.2.0 was approved with no blockers. The architectural review raised five forward-looking observations that don't change v0 but are documented in §11 for future iterations: ownership of Signal/Match, event-driven promotion, the Workflow Engine choice, AC-12 fragility, and the strategic concept `Problem`. None are applied in v0.3.0.

> **Revision note (v0.2.0).** v0.1.0 leaked the LinkedIn platform into the domain language. The architectural review corrected this:
> - **LinkedIn is an adapter**, not a domain concept. The domain is platform-agnostic: `Offering`, `Signal`, `Match`, `Candidate`, `Opportunity`, `Channel`. The Channel has a `kind` discriminator; LinkedIn is one value of `kind`.
> - **`Candidate` is a projection**, not a first-class aggregate. Its lifecycle is encoded as events (`CandidateSurfaced` + `CandidatePromoted` | `CandidateDismissed`); its current state is reconstructed by replay.
> - **`Offering` is its own module** (`@daedalus/offering`), not agent-local. Opportunity Discovery, Proposal Generation, and future agents consume it.
> - **The MVP does not depend on LLM behavior.** The `LLMPort` seam exists for future use; v0 ships with deterministic keyword-based matching.

> **Context — the founder's actual pain (Tenant 0).** The founder wants to spend time on judgment, not on monitoring channels for potential clients. They want Daedalus to **read** inbound channels, **know what they sell**, and **surface candidates** for human triage. The MVP is the smallest slice that delivers this loop with full auditability, multi-tenant isolation, and Constitution Article IV compliance.

> **Why "MVP" and not "the full Phase 4".** Spec 009 scopes the *first* agent scenario that pays for itself. It deliberately defers multi-channel support, outbound actions, agent memory that learns, and the full Agent Runtime (Phase 4 in the [Roadmap](../../docs/roadmap.md)). The MVP is **the seed** that justifies the rest of Phase 4 by producing real usage evidence (per ADR-001's "learn by building" preference).

> **Canon tension — flagged early.** The Technical Principles §"Avoid for now" list includes **"Full Policy Engine"** and **"Agent Runtime"**. Both are Phase 3 / Phase 4 of the Roadmap. Spec 009 is the **first concrete instance** of Phase 4; it is gated on Phase 2 (Workflow Engine — Spec 008) and Phase 3 (Policy Engine — future spec). Until those land, this MVP runs in **explicit human-approval mode**: every surfaced candidate waits for `HumanApproved` before being promoted. That keeps Article V's "humans retain final authority" intact without a policy engine. The seam is wired for Phase 3.

---

## 1. Summary

The Inbound Discovery Agent MVP is a **bounded agent** that, for one tenant, on one or more **Channels** of one platform (LinkedIn for v0), runs a periodic poll, reads recent items the tenant can already see, **matches them against the tenant's Offering**, and **surfaces Candidates** for human triage. Each promoted candidate becomes a real `Opportunity` (Spec 003) and flows through the existing value chain (`Lead → Payment`). Each dismissed candidate is logged with a reason.

Three guarantees:

- **The agent reads; humans decide.** v0 has **zero write paths** beyond creating `Opportunity` events from promoted candidates. Outbound actions (DMs, comments, posts) are out of scope until a Policy engine gates them (Phase 3+).
- **Every agent action is auditable.** Each agent run is a `WorkflowInstance` (Spec 008); each surfaced candidate is a `CandidateSurfaced` event with full lineage; each human decision is an event with the agent's correlation.
- **Tenant-scoped, multi-tenant safe.** The agent never sees another tenant's channels. Tenant 0's offering, channel credentials, and run history live in Tenant 0's scope.

> **What this is NOT.** Not a general LLM integration. Not a multi-platform inbox. Not an outbound automation tool. Not an agent that learns from past decisions (memory is bounded, not learned). Not a LinkedIn-shaped domain.

---

## 2. Relation to the Daedalus canon

| Reference | How this spec relates |
|---|---|
| **[Constitution](../../memory/constitution.md)** | Obeys all ten principles. Key: **Article IV — Agent Limitations** is binding on every action this agent takes. **Article V — Human Responsibilities** is enforced by **explicit human approval per action** until Phase 3 ships. **Principle 6 (Tenant Isolation)** is preserved structurally (per-tenant channel credentials, per-tenant offering, per-tenant run history). **Principle 9 (Simplicity First)** — MVP ships one channel kind (LinkedIn); one poll cadence; one triage flow. |
| **[Technical Principles](../../memory/technical-principles.md)** | Respects hexagonal layering. The agent lives in a new package `packages/inbound-agent/` (peer to `@daedalus/revenue-visibility` and `@daedalus/offering`). It consumes Core + Spec 003 + the new Offering module through public contracts. It introduces **no** new Core primitives. **Conditionally retires** the "Agent Runtime" item from the Avoid-for-now list — for this MVP, in explicit human-approval mode, until Phase 3's policy engine generalizes the approval mechanism. |
| **[ADR-002](./ADR-002-adopt-technical-framework.md)** | Spec → Plan → Tasks → Implementation. No functionality outside this spec. |
| **[ADR-004](./ADR-004-export-discipline-and-lineage.md)** | Every event the agent emits carries full lineage. The agent's correlation is `corr-<runId>`. Its actions use `followFrom()` on the candidate's triggering event. |
| **[Roadmap](../../docs/roadmap.md)** | This is the **first concrete Phase 4 milestone**. It is gated on Phase 2 (Workflow Engine — Spec 008) and Phase 3 (Policy Engine — future spec). Until those land, the MVP runs in human-approval mode. |
| **[Spec 003 — Opportunity Discovery](../../specs/003-opportunity-discovery/spec.md)** | The agent **consumes** the `surfaceOpportunityUseCase` to convert promoted candidates into real `OpportunitySurfaced` events. Spec 003 v1 (the resolution of Discovery vs Engagement) is downstream; the MVP uses the existing surfaceOpportunityUseCase as a stand-in until that boundary is resolved. |
| **[Spec 008 — Workflow Engine](../../specs/008-workflow-engine/spec.md)** | Each agent run is a **workflow instance** under a new workflow `inbound-agent-run`. The engine loop runs the agent; the engine events (`WorkflowInstanceStarted`, `HumanApprovalRequired`, `WorkflowTransitionFired`, etc.) record the agent's activity. |
| **ATLAS** | The agent's events appear in ATLAS's existing `/events` and `/activity` panels. A new ATLAS panel `inbound-runs` (read-only, per-tenant) is a follow-on spec — not part of this MVP. |
| **NEW `@daedalus/offering` module** | This spec introduces a new module: `packages/offering/`. Owns the Offering concept, the JSON Schema, the validator, and the matching primitives. Consumed by the Inbound Agent (this spec), and **designed to be consumed** by Spec 003 (Opportunity Discovery) and Spec 002 (Proposal Generation) in follow-on specs. The Strategic Importance of Offering is documented in §11. |

---

## 3. Goals

1. **Free the founder from channel monitoring.** Tenant 0 configures their offering once; the agent does the polling.
2. **Surface real candidates, not noise.** Every surfaced candidate must trace to an actual signal. The agent does not invent candidates.
3. **Make triage a human act.** No candidate becomes an Opportunity without a human `CandidatePromoted` event. Every dismissal records a reason.
4. **Stay auditable.** Every agent run is a workflow instance with a full lineage chain. ATLAS can render it without poking the agent's internals.
5. **Stay bounded (Constitution Article IV).** The agent never modifies policy, never escalates its privileges, never takes an irreversible action.
6. **Stay tenant-scoped.** Tenant 0's channel credentials never reach another tenant's runs; another tenant's offering never reaches Tenant 0's runs.
7. **Stay simple (Principle 9).** One channel kind (LinkedIn) in v0. One poll cadence. One triage flow. No memory learning. No LLM dependency.
8. **Keep the domain platform-agnostic.** LinkedIn is one `kind` of `Channel`. The domain vocabulary never depends on a platform name.

---

## 4. Core / Module / Tenant / Agent split

| Layer | What lives there (this spec) |
|---|---|
| **Core** | No changes. The agent consumes existing use cases through public contracts. |
| **`@daedalus/offering`** (NEW module) | `packages/offering/` — peer to `@daedalus/revenue-visibility`. Owns: Offering type, JSON Schema, validator, and the `matchSignalAgainstOffering` use case (deterministic keyword-based in v0). **Designed to be consumed by other modules and agents**, not agent-local. |
| **`@daedalus/opportunity-discovery`** | Unchanged. The agent calls `surfaceOpportunityUseCase` for promoted candidates. |
| **`@daedalus/workflow-engine`** (Spec 008) | Provides the engine loop. Each agent run is a workflow instance. The agent's polling step is a workflow action. |
| **NEW `packages/inbound-agent/`** | The MVP. Peer to the other modules. Bounded executor. Imports from `@daedalus/offering` for matching. Imports from `@daedalus/opportunity-discovery` for promotion. Channel-kind-specific code (LinkedIn) lives behind a `ChannelAdapter` port. |
| **Tenant profile** | `config/tenants/<tenant>/offering.json` — what the tenant sells. New file. Lives in tenant config, not Core. |
| **Tenant secrets** | `config/tenants/<tenant>/channel-credentials.json` (gitignored) — OAuth tokens, API keys. **Never** in the repo. Loaded at runtime only. |
| **Tenant state** | `.data/tenants/<tenant>/inbound-agent-runs.jsonl` — per-run log (gitignored). |
| **Workflow artifact** | `blueprints/workflows/inbound-agent-run.v0.1.0.json` — describes the agent's lifecycle. |

> **Domain discipline.** The domain language (`Offering`, `Signal`, `Match`, `Candidate`, `Opportunity`, `Channel`) never mentions a platform. LinkedIn lives behind a `ChannelAdapter` and only the adapter's implementation file is named after the platform. The MVP ships one adapter; future specs add more.

---

## 5. Domain concepts (conceptual — no schema)

- **Offering.** A structured document that tells the agent (and other modules) *what the tenant sells*. Has: an elevator pitch, a list of services, target industries, deal-size range, positive keywords, negative keywords. Lives in `config/tenants/<tenant>/offering.json`. Versioned by mtime. Owned by `@daedalus/offering`.
- **Channel.** A connection through which inbound **Signals** arrive. Has: a `channelId`, a `kind` (e.g. `"linkedin"` for v0; future values like `"email"`, `"rss"` are follow-on specs), an OAuth scope, and a `lastSeenCursor` (so the agent doesn't re-process). The descriptor (id, kind, scope, connectedAt) lives in `config/tenants/<tenant>/channels.json` (committed). The credentials (tokens) live in `config/tenants/<tenant>/channel-credentials.json` (gitignored). The descriptor's `kind` selects which `ChannelAdapter` is wired at runtime.
- **Signal.** A raw item from a Channel: a post, a DM, a profile match. The agent never persists signals beyond the per-run log.
- **Match.** A `Signal` paired with the agent's reasoning about why it matches the Offering. Includes the matched keywords/services and a confidence score (low/medium/high — a coarse scalar; v0 does not expose model internals).
- **Candidate.** A `Match` that crossed a threshold (configurable; default = medium). What the human triages. **Candidate is a projection**, not a first-class aggregate: its lifecycle is encoded as the sequence of events `CandidateSurfaced` → (`CandidatePromoted` | `CandidateDismissed`). Its current state is reconstructed by replay.
- **Agent Run.** A bounded execution. Has: a `runId`, a `startedAt`, a `polledAt`, a list of `Match`es, a list of `Candidate`s surfaced, an outcome (`completed` | `failed` | `awaiting_human`). Lives as a workflow instance under `inbound-agent-run`.
- **Triage Decision.** A human's promotion or dismissal of a candidate. `promote` calls `surfaceOpportunityUseCase` (Spec 003); `dismiss` records the reason.
- **Agent Memory (bounded).** A tenant-scoped cache of `lastSeenCursor` per Channel + a set of `signalId`s already surfaced in this calendar window (default 30 days). The memory is **not** learned; it's a deterministic dedup. Reset is a manual CLI command.

> **Architectural-review note (v0.2.0).** Compared to v0.1.0:
> - `Channel` (was `SocialChannel`) is platform-agnostic; its `kind` discriminator selects the adapter at runtime.
> - `Candidate` is now a projection (was a first-class aggregate). The lifecycle events are preserved; the agent and Spec 003 communicate through events rather than a shared aggregate.
> - `Offering` has been extracted to its own module (`@daedalus/offering`). The agent imports from there, not from a local matcher.

---

## 6. Events

The MVP introduces **eight new value-chain events** that the agent emits, plus the engine events already in Spec 008's vocabulary. The eight are the first new value-chain events since Spec 006.

| Event | When emitted | Lineage |
|---|---|---|
| `ChannelConnected` | Tenant finishes OAuth and confirms a Channel. | `correlationId` = tenant scope. |
| `ChannelDisconnected` | Tenant disconnects a Channel. | `correlationId` = tenant scope. |
| `OfferingUpdated` | The tenant's `offering.json` changes (manual reload). | `correlationId` = tenant scope. |
| `AgentRunStarted` | A new agent run begins. | `correlationId` = `corr-<runId>`. |
| `CandidateSurfaced` | The agent surfaces a candidate (a `Match` that crossed threshold). | `correlationId` = `corr-<runId>`; `causationId` = the signal's reference (where the platform exposes one). |
| `CandidatePromoted` | A human promotes a candidate (was `CandidateAccepted` in v0.1.0; renamed for projection semantics). The next event in this lineage is `OpportunitySurfaced`. | `correlationId` = `corr-<runId>`; `causationId` = `CandidateSurfaced`. |
| `CandidateDismissed` | A human dismisses a candidate, with a reason (was `CandidateRejected` in v0.1.0; renamed for projection semantics). | Same as promoted. |
| `AgentRunCompleted` | The run finishes. | `correlationId` = `corr-<runId>`. |

Plus, the agent **emits** an `OpportunitySurfaced` event (via Spec 003's `surfaceOpportunityUseCase`) for each promoted candidate. **That is the only event the agent triggers that flows into the existing value chain.** All other agent events are agent-observability events.

> **Projection semantics.** "Pending candidates" — the inbox of surfaced candidates awaiting triage — is a **read-model** computed by replaying events:
> - A candidate is **pending** if its `CandidateSurfaced` exists and no `CandidatePromoted` or `CandidateDismissed` follows in the same `correlationId`.
> - A candidate is **promoted** if a `CandidatePromoted` follows its `CandidateSurfaced` in the same `correlationId`.
> - A candidate is **dismissed** if a `CandidateDismissed` follows its `CandidateSurfaced` in the same `correlationId`.
>
> The projection is what ATLAS renders in a follow-on `inbound-runs` panel; the agent does not maintain a candidate aggregate state.

> **No `AgentActionExecuted` event in v0.** Constitution Article IV calls for one, but in explicit human-approval mode every agent action is preceded by a `HumanApproved` event, so the lineage is already captured by the workflow engine. Phase 3 (Policy engine) generalizes this and emits `AgentActionExecuted` automatically when an action runs under policy.

---

## 7. The agent run lifecycle (binding)

A run is a workflow instance under `inbound-agent-run.v0.1.0`. Its lifecycle:

```
READY ─► POLLING ─► FETCHING ─► MATCHING ─► SURFACING ─► AWAITING_HUMAN ─► COMPLETED
                                                                       └► FAILED
                                                                       └► COMPENSATED
```

State transitions are gated by **workflow transitions** with `requiresHuman: true` on the AWAITING_HUMAN → COMPLETED step. The transitions:

1. **READY → POLLING.** Trigger: a scheduled tick (or a manual `agent:run --tenant <t>` CLI).
2. **POLLING → FETCHING.** Action: emit `AgentRunStarted`.
3. **FETCHING → MATCHING.** Action: read the Channel's `lastSeenCursor`; fetch Signals newer than the cursor.
4. **MATCHING → SURFACING.** Action: for each Signal, call `@daedalus/offering`'s `matchSignalAgainstOffering(Signal, Offering)` → `Match` (or `null`).
5. **SURFACING → AWAITING_HUMAN.** Action: filter Matches above threshold; emit `CandidateSurfaced` for each.
6. **AWAITING_HUMAN → COMPLETED.** Trigger: a `CandidatePromoted` or `CandidateDismissed` event arrives for one of this run's candidates. Per-candidate, the workflow advances.

If a step throws (e.g. the platform API is down), the workflow engine's compensation (Spec 008) walks back and emits `AgentRunFailed` + `WorkflowInstanceCompensated`.

**Bounded execution.** Each step has a timeout; the agent never runs longer than the poll cadence. If the step exceeds the budget, the run is marked `failed`.

**No write paths beyond Opportunity.** The agent **does not**:
- DM anyone.
- Comment on a post.
- Post anything.
- Modify the tenant offering.
- Modify its own memory (other than the deterministic cursor + dedup set).
- Escalate its own privileges.
- Modify any policy.

It **does** call `surfaceOpportunityUseCase` (Spec 003) on promoted candidates — that's the single write path. Article IV is honored.

---

## 8. Acceptance criteria

**AC-1 (Offering setup).**
- *Given* Tenant 0 has not configured `offering.json`,
- *When* the agent tries to run,
- *Then* it refuses to start and emits `HumanApprovalRequired` with reason `"offering not configured"`.

**AC-2 (Channel connect — platform-agnostic).**
- *Given* Tenant 0 has no Channel connected,
- *When* the user runs `agent:connect --tenant tenant-0 --kind linkedin`,
- *Then* the OAuth flow completes and `ChannelConnected` is emitted with the Channel id and `kind: "linkedin"`.

**AC-3 (Run lifecycle).**
- *Given* Tenant 0 has both offering and Channel,
- *When* the user runs `agent:run --tenant tenant-0`,
- *Then* the run goes `READY → POLLING → FETCHING → MATCHING → SURFACING → AWAITING_HUMAN` and emits `AgentRunStarted`, `CandidateSurfaced` (zero or more), and `HumanApprovalRequired`.

**AC-4 (Candidate surfacing).**
- *Given* a fetched Signal mentions a keyword in the Offering and does not mention any negative keyword,
- *When* the run's matching step evaluates it,
- *Then* a `CandidateSurfaced` event is emitted with the Signal's id, the matched keywords, and a confidence score.

**AC-5 (Triage promotes → real Opportunity).**
- *Given* a surfaced candidate awaiting triage,
- *When* the user runs `agent:promote --tenant tenant-0 --run <runId> --candidate <id>`,
- *Then* `CandidatePromoted` is emitted, `surfaceOpportunityUseCase` (Spec 003) is called, and an `OpportunitySurfaced` event lands in the stream (with `causationId` = `CandidatePromoted`).

**AC-6 (Triage dismisses → audited).**
- *Given* a surfaced candidate awaiting triage,
- *When* the user runs `agent:dismiss --tenant tenant-0 --run <runId> --candidate <id> --reason <r>`,
- *Then* `CandidateDismissed` is emitted with the reason. No Opportunity is created. The audit trail preserves the dismissal.

**AC-7 (No write path beyond Opportunity).**
- *Given* any agent run,
- *Then* the only value-chain events emitted are `ChannelConnected`/`Disconnected` (one-time setup), `OfferingUpdated` (manual reload), `CandidateSurfaced` (per candidate), `CandidatePromoted`/`Dismissed` (per triage), and `OpportunitySurfaced` (per promotion). The agent **never** emits a DM, comment, post, or any platform-mutating event.

**AC-8 (Bounded execution, Constitution Article IV).**
- *Given* a step exceeds its budget,
- *Then* the run is marked `failed` and emits `AgentRunFailed`. The agent never persists state outside the per-tenant run log. The agent never modifies its own memory beyond the deterministic cursor + dedup set. The agent never escalates its privileges.

**AC-9 (Tenant isolation).**
- *Given* two tenants with their own offerings and Channels,
- *When* each runs the agent,
- *Then* Tenant A's run never reads Tenant B's Channel; Tenant B's run never sees Tenant A's offering. Each run's events carry the right `tenantId` in lineage.

**AC-10 (Replayable audit).**
- *Given* the event stream,
- *When* an external tool replays the run,
- *Then* it reconstructs: the run's start time, the Signals fetched (count), the Matches computed (count), the Candidates surfaced (count + ids), and each triage decision with its reason. The "pending candidates" projection is computable.

**AC-11 (No new Core primitives).**
- *Given* the MVP is built,
- *Then* `@daedalus/core` is unchanged (no new events, aggregates, projections, ports). The agent consumes only existing use cases through public contracts.

**AC-12 (Domain is platform-agnostic).**
- *Given* the agent's source code,
- *When* `grep -r 'linkedin\|LinkedIn\|LINKEDIN' packages/inbound-agent/src/domain/` runs,
- *Then* **zero** matches. The domain directory contains no platform-named identifiers. Platform names appear only in `adapters/channels/linkedin-channel-adapter.ts`.

**AC-13 (Offering is a reusable module).**
- *Given* `@daedalus/offering` exists,
- *When* a future spec for Opportunity Discovery wants to qualify opportunities against the offering,
- *Then* it imports `matchSignalAgainstOffering` from `@daedalus/offering`'s public contract. The Inbound Agent does not own the matcher.

**AC-14 (MVP does not depend on LLM behavior).**
- *Given* the MVP is built with v0 keyword-based matching,
- *When* `grep -r 'LLMPort\|llm-port' packages/inbound-agent/src/` runs (excluding the seam interface declaration),
- *Then* **zero** production-code matches; the port is declared but no concrete LLM adapter is wired. The matching step is purely deterministic.

---

## 9. Non-goals (binding)

- **No multi-channel support in v0.** One Channel kind (LinkedIn) in v0. Other kinds (email, RSS, webhooks, etc.) are follow-on specs.
- **No outbound agent actions.** No DMs, comments, posts, follows, unfollows, likes, or any platform-mutating event. These are irreversible (Constitution Article IV) and require a Policy engine (Phase 3+).
- **No agent memory that learns.** The "memory" is a deterministic dedup set, not a learned model. Weights, preferences, and priors are not adjusted based on past decisions.
- **No LLM dependency in v0.** v0 ships with deterministic keyword-based matching. The `LLMPort` seam exists for future use; no concrete LLM adapter is wired in v0.
- **No model fine-tuning or training.** Even after Phase 3, the MVP's matching stays deterministic. LLM-driven matching is a follow-on spec with its own governance.
- **No webhooks.** Polling only. Webhooks are a Phase 5 concern (and require platform cooperation).
- **No scheduling beyond polling.** A simple interval (default 60 minutes, configurable per tenant). Cron-style scheduling is a future concern.
- **No multi-tenant shared agent.** Each tenant runs its own agent instance. There is no "Daedalus inbound agent" that operates across tenants.
- **No outbound notifications.** The agent does not email, SMS, or push notifications. Triage is via CLI (and via ATLAS read views once those exist).
- **No new Core events, aggregates, projections, or ports in Core.** The eight new events live in the agent's vocabulary, not in Core.
- **No LinkedIn-shaped domain.** The domain is platform-agnostic; LinkedIn lives behind a `ChannelAdapter` (AC-12).

---

## 10. Risks

- **R1 — Platform ToS.** LinkedIn's API restricts automated reading and forbids scraping. The MVP **requires the official LinkedIn API** with valid OAuth. Any implementation that bypasses this violates the platform's ToS and is out of scope. *Mitigation:* the spec's only allowed auth path is the official LinkedIn OAuth; the agent does **not** use scraping fallbacks. Documented as a binding constraint.
- **R2 — Agent drift.** A future contributor might add an action the spec doesn't authorize. *Mitigation:* AC-7 enumerates the only allowed value-chain events; AC-8 enforces boundedness; AC-12 protects the domain from platform-shape; a test greps for forbidden use cases.
- **R3 — PII exposure.** The agent sees real names, profile data, message content. None of this should leak to the audit trail beyond what the candidate needs to be triaged. *Mitigation:* the run log records `signalId` and a **summary**, not the raw Signal content (which can be PII). The summary is bounded (e.g. up to 280 characters, redact known sensitive patterns).
- **R4 — Policy gap (offering ambiguity).** If the tenant offering is sparse or contradictory, the agent's matching is unreliable. *Mitigation:* AC-1 refuses to run without a configured offering. If the offering changes mid-run, the run completes; the next run uses the new offering. The agent **never** invents criteria.
- **R5 — API rate limits / outages.** LinkedIn rate-limits aggressively. *Mitigation:* the run's FETCHING step has a budget; on 429 / 5xx, the run fails gracefully with `AgentRunFailed`. The next run retries.
- **R6 — Determinism vs recall.** Keyword-based matching is deterministic but may miss semantic matches. *Mitigation:* v0 ships deterministic; Phase 4+ adds optional LLM-backed matching under the `LLMPort` seam. The seam exists from day one but no LLM adapter is wired.
- **R7 — Confused-deputy on the platform.** An agent acting on Tenant 0's behalf must be unambiguously identified as such. *Mitigation:* OAuth scopes are read-only; the agent's User-Agent identifies it as `daedalus-inbound-agent/<version>`.
- **R8 — Tenant isolation in the run log.** A future bug might log Tenant A's run under Tenant B. *Mitigation:* AC-9 + a test that seeds two tenants' offerings and verifies each agent run reads only its own.
- **R9 — Channel-adapter portability.** Future channel kinds (email, RSS, etc.) must plug in without domain changes. *Mitigation:* AC-12 (the domain has no platform names); the `ChannelAdapter` interface is the only seam.
- **R10 — Offering module mis-scoping.** `@daedalus/offering` could grow scope creep. *Mitigation:* v0 ships the minimum: type, schema, validator, and `matchSignalAgainstOffering`. Other capabilities (proposal alignment, etc.) are separate specs that **import** from `@daedalus/offering`, never modify it without their own ADR.

---

## 11. Strategic importance of `@daedalus/offering`

The architectural review (PR #22 review) flagged that **Offering is strategically important** and may be consumed by other modules and agents. This section documents the strategic framing so future specs know what to expect.

**Why Offering is a module, not agent-local:**
- **Reusable across modules.** Opportunity Discovery (Spec 003) wants to qualify surfaced opportunities against the offering (do they fit?). Proposal Generation (Spec 002) wants to align draft proposals with the offering (does the proposal reflect what we sell?). Future agents will want to evaluate inbound signals against the offering (this MVP does exactly that).
- **Owned by the Core/Module layer, not by an agent.** Per Constitution Principle 10, tenant-specific things live in tenant profiles; reusable capabilities live in modules. Offering is a reusable capability — it describes *what a tenant sells* in a form that any module can consume.
- **Decoupled from the Inbound Agent's lifecycle.** The Inbound Agent reads the offering per run; Opportunity Discovery reads it per qualification; Proposal Generation reads it per draft. None of these depend on the Inbound Agent being installed or active.

**v0 scope of `@daedalus/offering` (deliberately small):**
- The `Offering` type (read-only).
- A JSON Schema (committed) with five fields: elevator, services, industries, dealSize, keywords, negativeKeywords.
- A validator that loads and validates `config/tenants/<tenant>/offering.json`.
- The `matchSignalAgainstOffering(Signal, Offering): Match | null` use case (deterministic keyword-based in v0).
- The `LLMPort` seam — declared, no concrete adapter wired in v0.

**Future scope (each is a separate spec, gated on its own evidence):**
- **Spec 003 v1** uses `@daedalus/offering` to qualify opportunities against the offering.
- **Spec 002 v1** uses `@daedalus/offering` to align draft proposals with the offering.
- A future "offering alignment" use case might evaluate a draft proposal against the offering.
- A future "offering evolution" use case might surface when the offering drifts from the actual portfolio of accepted opportunities.

Each of these is a separate spec with its own ADR; none modifies `@daedalus/offering` without going through the spec/ADR process.

---

## 11.1 Forward-looking architectural observations (from the v0.2.0 review)

The second architectural review of this spec (PR #23 comment) approved the direction with no blockers. Five forward-looking observations were raised. They are **documented here, not applied in v0.3.0**. Each is a candidate for a future spec/ADR when evidence justifies it.

### O-1 · Ownership of `Signal` and `Match`

**Observation.** v0.2.0 places `Signal` and `Match` in `@daedalus/offering`. Signal is inbound data — closer to the Opportunity Discovery space. Match depends on what you match against: against an Offering (then `Match` belongs in `@daedalus/offering`); against opportunity criteria (then it belongs in Opportunity Discovery).

**Direction.** For v0, keeping them together in `@daedalus/offering` is acceptable (low coupling, single owner, easy to evolve). The future direction is:
- `Signal` moves to Opportunity Discovery (or a generic "inbound" module).
- `Match` stays in `@daedalus/offering` for *offering-matching* and gets a parallel concept in Opportunity Discovery for *qualification-matching*.
- This split is a Spec 003 v1 concern, not a Spec 009 concern.

**Why deferred.** Splitting requires duplicating `Signal` or creating a shared "inbound types" package. Both are heavier than v0 warrants. Document and revisit when Spec 003 v1 lands.

### O-2 · Event-driven promotion

**Observation.** v0.2.0 has the Inbound Agent call `surfaceOpportunityUseCase` (Spec 003) directly to promote a candidate. The alternative is purely event-driven:

```
Inbound Agent → emits CandidatePromoted event
Opportunity Discovery (its own workflow) → reacts to CandidatePromoted → emits OpportunitySurfaced
```

This decouples the Inbound Agent from `@daedalus/opportunity-discovery`. The relationship becomes a stream subscription rather than a function call.

**Direction.** This is the event-first architecture's natural shape. The v0.2.0 direct call is **simpler** and **works** but couples modules. The future Spec 003 v1 should introduce a workflow artifact (`opportunity-from-candidate`) in Opportunity Discovery that listens for `CandidatePromoted` and runs `surfaceOpportunityUseCase`. The Inbound Agent then drops the direct import.

**Why deferred in v0.** Requires a workflow artifact in Opportunity Discovery, which is Spec 003 v1's scope. Spec 009 should not pre-empt that.

### O-3 · Workflow Engine as a hard dependency

**Observation.** v0.2.0 makes the Inbound Agent a workflow instance under `inbound-agent-run.v0.1.0`, requiring the Workflow Engine (Spec 008). The flow (poll → match → surface → human review) could potentially be a single bounded use case with internal state management — without the Workflow Engine.

**Position (canonical).** Workflow Engine is the right substrate for v0 because:
- The agent is intrinsically event-driven (reacts to `CandidatePromoted`/`Dismissed`/`OfferingUpdated`/`ChannelDisconnected`).
- Workflow Engine is the canonical event-driven substrate in Daedalus (Spec 008 + ADR-006).
- Consistency with the rest of the architecture (no special-case "polling loops").
- Phase 4+ general (multi-channel, multi-step, compensation, versioning) will need the Workflow Engine anyway.
- Spec 008's activation criteria are already on the roadmap.

**Alternative path (v0.3.0-simpler).** If shipping speed becomes more important than architectural consistency, the agent could be reduced to a single use case with internal state — bypassing Workflow Engine. This would require its own ADR and a documented divergence from Spec 008's pattern.

**Why we keep Workflow Engine.** The cost of using it is small (the substrate already exists in the canon). The cost of NOT using it (special-case agent architecture, diverging from Spec 008) is high. The reviewer's concern is valid; we record it and explain why we disagree, leaving the door open.

### O-4 · AC-12 grep fragility

**Observation.** AC-12 enforces domain-platform-agnosticism with a `grep` test. Grep-based enforcement is fragile over time (renames, substring matches in comments, etc.).

**Position.** AC-12 is the **fast** guardrail; package boundaries (ADR-004 export discipline) are the **structural** guardrail. Over time, when the agent package grows, the structural protection dominates:
- `@daedalus/offering`'s public contract is curated (ADR-004).
- `packages/inbound-agent/src/domain/` contains only the domain types; platforms never appear there because the adapter is in `adapters/channels/`.
- The grep test is a complement, not a substitute.

**Action for v0.3.0.** Document the layering. No code change. Future contributors who add a "linkedin" string to `domain/` will fail AC-12's grep test **and** the architectural review.

### O-5 · Strategic concept: `Problem`

**Observation.** The reviewer notes that the Daedalus vision aims to discover and materialize meaningful problems, not simply generate leads. A future concept `Problem` may emerge between `Signal` and `Opportunity`:

```
Signal → Problem → Opportunity
```

rather than

```
Signal → Opportunity
```

**Why this matters.** "Lead generation" optimizes for any contact; "Problem discovery" optimizes for material problems the tenant can actually solve. The Offering module already encodes what the tenant solves; pairing that with discovered Problems is closer to the Daedalus thesis than pairing it with Leads.

**Status.** Out of scope for Spec 009. Documented as a strategic direction for a future spec (likely Spec 003 v1 or a new Spec 011). The `Problem` concept would be a first-class aggregate (not a projection — unlike `Candidate`) because it has its own lifecycle (discovered → validated → qualified → resolved). A future ADR would settle it.

**Implication for v0.** The Inbound Agent currently emits `CandidateSurfaced` and the human triages. If `Problem` becomes a first-class concept, the triage decision may shift from "promote to Opportunity" to "is this a real Problem? If yes, promote to Problem; if no, dismiss." That's a later evolution, not a v0 concern.

### Summary

None of O-1..O-5 changes v0. v0 ships as v0.2.0 specified. Each observation is a **direction** for a future spec/ADR, not a defect. The Strategic Importance of `@daedalus/offering` (above) and this section together form the bridge to Phase 4+ general evolution.

---

## 12. Open questions

All open questions from v0.1.0 are resolved in §0 of the [plan](./plan.md). Summary:

- **Q1 (Channel kind for v0):** LinkedIn.
- **Q2 (candidate sources):** Posts + DMs + profile matches. Per-tenant config can disable each.
- **Q3 (Offering schema):** JSON with elevator, services, industries, deal size, keywords, negative keywords.
- **Q4 (poll cadence):** Default 60 minutes; per-tenant configurable. Manual triggers via `agent:run` CLI override.
- **Q5 (LLM vendor):** The MVP defines `LLMPort` (interface) in `@daedalus/inbound-agent`. **No concrete LLM adapter is wired in v0.** The vendor choice is a separate governance decision, made only if/when LLM-backed matching is added (a follow-on spec).
- **Q6 (dedup window):** Default 30 days; per-tenant configurable.
- **Q7 (confidence threshold):** Default `medium`; per-tenant configurable.
- **Q8 (learning from dismissal):** Out of scope. Audit trail preserves dismissals; Phase 4+ may use them with explicit opt-in.

---

## 13. Activation criteria (binding)

T-01…T-N in `tasks.md` may begin only when **all** of the following are true:

1. **Spec 009 is ratified** by stewards.
2. **An ADR moves the Inbound Discovery Agent into the Roadmap** as the first Phase 4 milestone, AND proposes the introduction of `@daedalus/offering` as a new module.
3. **Workflow Engine (Spec 008) is shipped** — the agent runs as a workflow instance under `inbound-agent-run.v0.1.0`. Until this lands, the agent has no substrate to run on.
4. **One of the following:**
   - **Policy Engine (Phase 3) is shipped** — the agent's actions are gated by policy automatically.
   - **OR** explicit human approval is configured per action — every `CandidateSurfaced` waits for `HumanApproved`. (This is the v0 fallback per Constitution Article V.)
5. **The founder (Tenant 0) confirms** the LinkedIn-only scope, the offering schema, and the explicit-human-approval mode.

---

## 14. Out of scope (binding)

- Multi-channel support.
- Outbound actions (DMs, comments, posts, follows, likes).
- Agent memory that learns from past decisions.
- LLM dependency in v0 (the seam exists; no adapter wired).
- Model fine-tuning or training.
- Webhooks (vs polling).
- Cron-style scheduling.
- Multi-tenant shared agent.
- Outbound notifications (email/SMS/push).
- New Core events, aggregates, projections, or ports.
- LinkedIn-shaped domain (AC-12).
- Phase 4+ general Agent Runtime — this spec is the first concrete slice.

---

## 15. Companion artifacts

- **`plan.md`** — implementation plan: `packages/inbound-agent/` layout, `packages/offering/` layout, workflow artifact, tenant config shapes, CLI commands, AC-to-test mapping, evidence run, definition of done.
- **`tasks.md`** — task breakdown, forward-planning, not a build authorization.

---

*Subordinate to the [Constitution](../../memory/constitution.md), [Technical Principles](../../memory/technical-principles.md), and the [Roadmap](../../docs/roadmap.md). The first agent — small, bounded, auditable, human-approved, platform-agnostic. The rest of Phase 4 follows usage.*