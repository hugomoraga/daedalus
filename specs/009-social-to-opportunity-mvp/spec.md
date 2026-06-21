# Spec 009 — Social-to-Opportunity Agent (MVP)

**Status:** Draft · Phase 4 (planning — earliest buildable, gated on Phase 2 + Phase 3 + this ratification)
**Type:** Module + Agent Runtime slice — the first end-to-end agent scenario
**Owner:** Stewards
**Version:** 0.1.0
**Last updated:** 2026-06-21

> **Method.** Spec-first (Constitution, Principle 8). Defines *what* the MVP does and *why*, not *how*. Conceptual — no JSON shapes, no code, no vendor selection, no API key handling.

> **Context — the founder's actual pain (Tenant 0).** The founder wants to spend time on judgment, not on monitoring social networks for potential clients. They want Daedalus to **read** one social channel, **know what they sell**, and **surface candidate opportunities** that a human can triage into the existing value chain. The MVP is the smallest slice that delivers this loop with full auditability, multi-tenant isolation, and Constitution Article IV compliance.

> **Why "MVP" and not "the full Phase 4".** Spec 009 scopes the *first* agent scenario that pays for itself. It deliberately defers multi-platform support, outbound actions, agent memory that learns, and the full Agent Runtime (Phase 4 in the [Roadmap](../../docs/roadmap.md)). The MVP is **the seed** that justifies the rest of Phase 4 by producing real usage evidence (per ADR-001's "learn by building" preference).

> **Canon tension — flagged early.** The Technical Principles §"Avoid for now" list includes **"Full Policy Engine"** and **"Agent Runtime"**. Both are Phase 3 / Phase 4 of the Roadmap. Spec 009 is the **first concrete instance** of Phase 4; it is gated on Phase 2 (Workflow Engine — Spec 008) and Phase 3 (Policy Engine — future spec). Until those land, this MVP runs in **explicit human-approval mode**: every agent action is gated by a `human:approve` event before it executes. That keeps Article V's "humans retain final authority" intact without a policy engine. The seam is wired for Phase 3.

---

## 1. Summary

The Social-to-Opportunity Agent MVP is a **bounded agent** that, for one tenant, on one social platform (LinkedIn for v0), runs a periodic poll, reads recent posts/DMs the tenant can already see, **matches them against the tenant's offering**, and **surfaces candidates** for human triage. Each accepted candidate becomes a real `Opportunity` (Spec 003) and flows through the existing value chain (`Lead → Payment`). Each rejected candidate is logged with a reason.

Three guarantees:

- **The agent reads; humans decide.** v0 has **zero write paths** beyond creating `Opportunity` events from accepted candidates. Outbound actions (DMs, comments, posts) are out of scope until a Policy engine gates them (Phase 3+).
- **Every agent action is auditable.** Each agent run is a `WorkflowInstance` (Spec 008); each surfaced candidate is a `CandidateSurfaced` event with full lineage; each human decision is an event with the agent's correlation.
- **Tenant-scoped, multi-tenant safe.** The agent never sees another tenant's channel. Tenant 0's offering, channel tokens, and run history live in Tenant 0's scope.

> **What this is NOT.** Not a general LLM integration. Not a multi-platform social inbox. Not an outbound automation tool. Not an agent that learns from past decisions (memory is bounded, not learned).

---

## 2. Relation to the Daedalus canon

| Reference | How this spec relates |
|---|---|
| **[Constitution](../../memory/constitution.md)** | Obeys all ten principles. Key: **Article IV — Agent Limitations** is binding on every action this agent takes. **Article V — Human Responsibilities** is enforced by **explicit human approval per action** until Phase 3 ships. **Principle 6 (Tenant Isolation)** is preserved structurally (per-tenant channel tokens, per-tenant offering, per-tenant run history). **Principle 9 (Simplicity First)** — MVP ships LinkedIn only; one poll cadence; one triage flow. |
| **[Technical Principles](../../memory/technical-principles.md)** | Respects hexagonal layering. The agent lives in a new package `packages/social-agent/` (peer to `@daedalus/revenue-visibility`). It consumes Core + Spec 003 use cases through public contracts. It introduces **no** new Core primitives. **Conditionally retires** the "Agent Runtime" item from the Avoid-for-now list — for this MVP, in explicit human-approval mode, until Phase 3's policy engine generalizes the approval mechanism. |
| **[ADR-002](./ADR-002-adopt-technical-framework.md)** | Spec → Plan → Tasks → Implementation. No functionality outside this spec. |
| **[ADR-004](./ADR-004-export-discipline-and-lineage.md)** | Every event the agent emits carries full lineage. The agent's correlation is `corr-<runId>`. Its actions use `followFrom()` on the candidate's triggering event. |
| **[Roadmap](../../docs/roadmap.md)** | This is the **first concrete Phase 4 milestone**. It is gated on Phase 2 (Workflow Engine — Spec 008) and Phase 3 (Policy Engine — future spec). Until those land, the MVP runs in human-approval mode. |
| **[Spec 003 — Opportunity Discovery](../../specs/003-opportunity-discovery/spec.md)** | The agent **consumes** the `surfaceOpportunityUseCase` to convert accepted candidates into real `OpportunitySurfaced` events. Spec 003 v1 (the resolution of Discovery vs Engagement) is downstream; the MVP uses the existing surfaceOpportunityUseCase as a stand-in until that boundary is resolved. |
| **[Spec 008 — Workflow Engine](../../specs/008-workflow-engine/spec.md)** | Each agent run is a **workflow instance** under a new workflow `social-agent-run`. The engine loop runs the agent; the engine events (`WorkflowInstanceStarted`, `HumanApprovalRequired`, `WorkflowTransitionFired`, etc.) record the agent's activity. The agent's actions are **workflow actions** that emit `CandidateSurfaced` events. |
| **ATLAS** | The agent's events appear in ATLAS's existing `/events` and `/activity` panels. A new ATLAS panel `agent-runs` (read-only, per-tenant) is a follow-on spec — not part of this MVP. |

---

## 3. Goals

1. **Free the founder from social-network monitoring.** Tenant 0 configures their offering once; the agent does the polling.
2. **Surface real opportunities, not noise.** Every surfaced candidate must trace to an actual signal (a post mentioning a relevant keyword; a DM from a name in the founder's network; a profile whose headline matches the offering). The agent does not invent candidates.
3. **Make triage a human act.** No candidate becomes an Opportunity without a human `CandidateAccepted` event. No rejected candidate silently disappears — every rejection records a reason.
4. **Stay auditable.** Every agent run is a workflow instance with a full lineage chain. ATLAS can render it without poking the agent's internals.
5. **Stay bounded (Constitution Article IV).** The agent never modifies policy, never escalates its privileges, never takes an irreversible action (an outbound DM is irreversible; only humans do those, in Phase 4+ after a Policy engine).
6. **Stay tenant-scoped.** Tenant 0's channel tokens never reach another tenant's runs; another tenant's offering never reaches Tenant 0's runs.
7. **Stay simple (Principle 9).** LinkedIn only. One poll cadence. One triage flow. No memory learning. No model fine-tuning. No multi-platform routing.

---

## 4. Core / Module / Tenant / Agent split

| Layer | What lives there (this spec) |
|---|---|
| **Core** | No changes. The agent consumes existing use cases through public contracts. |
| **Spec 003 (Opportunity Discovery)** | Unchanged. The agent calls `surfaceOpportunityUseCase` for accepted candidates. |
| **Spec 008 (Workflow Engine)** | Provides the engine loop. Each agent run is a workflow instance. The agent's polling step is a workflow action. |
| **New package** | `packages/social-agent/` — the MVP. Peer to `@daedalus/revenue-visibility`. Bounded executor. Has its own `deps.ts`, its own workflow artifact, its own event vocabulary. |
| **Tenant profile** | `config/tenants/<tenant>/offering.json` — the structured description of what the tenant sells. New file. Lives in tenant config, not Core. |
| **Tenant secrets** | `config/tenants/<tenant>/social-credentials.json` (gitignored) — OAuth tokens, API keys. **Never** in the repo. Loaded at runtime only. |
| **Tenant state** | `.data/tenants/<tenant>/social-agent-runs.jsonl` — the per-run log (gitignored). |
| **Workflow artifact** | `blueprints/workflows/social-agent-run.v0.1.0.json` — describes the agent's lifecycle: poll → fetch signals → match against offering → surface candidates → wait for human triage → emit opportunities. |

---

## 5. Domain concepts (conceptual — no schema)

- **Tenant Offering.** A structured document that tells the agent *what the tenant sells*. Has: an elevator pitch, a list of services, target industries, deal-size range, positive keywords, negative keywords. Lives in `config/tenants/<tenant>/offering.json`. Versioned by mtime.
- **Social Channel.** A connection to one platform (LinkedIn for v0). Has: channel id, platform, OAuth credentials, last-seen cursor (so the agent doesn't re-process). Lives in `config/tenants/<tenant>/social-credentials.json` (gitignored) + a public descriptor in `config/tenants/<tenant>/social-channels.json` (committed, contains no secrets).
- **Signal.** A raw item from the channel: a post, a DM, a profile match. The agent never persists signals beyond the per-run log.
- **Match.** A `Signal` paired with the agent's reasoning about why it matches the Tenant Offering. Includes the matched keywords/services and a confidence score (low/medium/high — a coarse scalar; v0 does not expose model internals).
- **Candidate.** A `Match` that crosses a threshold (configurable; default = medium). What the human triages.
- **Agent Run.** A bounded execution. Has: a `runId`, a `startedAt`, a `polledAt`, a list of `Match`es, a list of `Candidate`s surfaced, an outcome (`completed` / `failed` / `awaiting_human` / `human_rejected_pending`). Lives as a workflow instance under `social-agent-run`.
- **Triage Decision.** A human's `accept` or `reject` on a candidate. `accept` calls `surfaceOpportunityUseCase` (Spec 003) with the candidate's reasoning + the originating signal's reference. `reject` records the reason.
- **Agent Memory (bounded).** A tenant-scoped cache of `lastSeenCursor` per channel + a set of `signalId`s already surfaced in this calendar window (default 30 days). The memory is **not** learned; it's a deterministic dedup. Reset is a manual CLI command.

---

## 6. Events

The MVP introduces **engine events** (already in Spec 008's vocabulary) and **eight new value-chain events** that the agent emits. These are the first new value-chain events since Spec 006.

| Event | When emitted | Lineage |
|---|---|---|
| `SocialChannelConnected` | Tenant 0 (or any tenant) finishes OAuth and confirms a channel. | `correlationId` = tenant scope. |
| `SocialChannelDisconnected` | Tenant 0 disconnects a channel. | `correlationId` = tenant scope. |
| `TenantOfferingUpdated` | The tenant's `offering.json` changes (manual reload). | `correlationId` = tenant scope. |
| `AgentRunStarted` | A new agent run begins. | `correlationId` = `corr-<runId>`. |
| `CandidateSurfaced` | The agent surfaces a candidate (a `Match` that crossed threshold). | `correlationId` = `corr-<runId>`; `causationId` = the signal's reference (where the platform exposes one). |
| `CandidateAccepted` | A human accepts a candidate. | `correlationId` = `corr-<runId>`; `causationId` = the `CandidateSurfaced` event. |
| `CandidateRejected` | A human rejects a candidate, with a reason. | Same as accepted. |
| `AgentRunCompleted` | The run finishes (with at least zero triage decisions). | `correlationId` = `corr-<runId>`. |

Plus, the agent **emits** an `OpportunitySurfaced` event (via Spec 003's `surfaceOpportunityUseCase`) for each accepted candidate. **That is the only event the agent triggers that flows into the existing value chain.** All other agent events are agent-observability events.

> **No `AgentActionExecuted` event in v0.** Constitution Article IV calls for one, but in explicit human-approval mode every agent action is preceded by a `HumanApproved` event, so the lineage is already captured by the workflow engine. Phase 3 (Policy engine) generalizes this and emits `AgentActionExecuted` automatically when an action runs under policy.

---

## 7. The agent run lifecycle (binding)

A run is a workflow instance under `social-agent-run.v0.1.0`. Its lifecycle:

```
READY ─► POLLING ─► FETCHING ─► MATCHING ─► SURFACING ─► AWAITING_HUMAN ─► COMPLETED
                                                                       └► FAILED
                                                                       └► COMPENSATED
```

State transitions are gated by **workflow transitions** with `requiresHuman: true` on the AWAITING_HUMAN → COMPLETED step. The transitions:

1. **READY → POLLING.** Trigger: a scheduled tick (or a manual `agent:run --tenant <t>` CLI). Action: emit `AgentRunStarted`.
2. **POLLING → FETCHING.** Action: read the channel's `lastSeenCursor`; fetch signals newer than the cursor.
3. **FETCHING → MATCHING.** Action: for each signal, evaluate against the tenant offering. Emit `Match`es per signal.
4. **MATCHING → SURFACING.** Action: filter Matches above threshold; emit `CandidateSurfaced` for each.
5. **SURFACING → AWAITING_HUMAN.** Action: emit `HumanApprovalRequired` (workflow engine event) for the triage transition. The instance waits.
6. **AWAITING_HUMAN → COMPLETED.** Trigger: a `CandidateAccepted` or `CandidateRejected` event arrives for one of this run's candidates. Per-candidate, the workflow advances.

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

It **does** call `surfaceOpportunityUseCase` (Spec 003) on accepted candidates — that's the single write path. Article IV is honored.

---

## 8. Acceptance criteria

**AC-1 (Offering setup).**
- *Given* Tenant 0 has not configured `offering.json`,
- *When* the agent tries to run,
- *Then* it refuses to start and emits `HumanApprovalRequired` with reason `"offering not configured"`.

**AC-2 (Channel connect).**
- *Given* Tenant 0 has no social channel connected,
- *When* the user runs `agent:connect --tenant tenant-0 --platform linkedin`,
- *Then* the OAuth flow completes and `SocialChannelConnected` is emitted with the channel id.

**AC-3 (Run lifecycle).**
- *Given* Tenant 0 has both offering and channel,
- *When* the user runs `agent:run --tenant tenant-0`,
- *Then* the run goes `READY → POLLING → FETCHING → MATCHING → SURFACING → AWAITING_HUMAN` and emits `AgentRunStarted`, `CandidateSurfaced` (zero or more), and `HumanApprovalRequired`.

**AC-4 (Candidate surfacing).**
- *Given* a fetched signal mentions a keyword in the offering and does not mention any negative keyword,
- *When* the run's matching step evaluates it,
- *Then* a `CandidateSurfaced` event is emitted with the signal's id, the matched keywords, and a confidence score.

**AC-5 (Triage accepts → real opportunity).**
- *Given* a surfaced candidate awaiting triage,
- *When* the user runs `agent:accept --tenant tenant-0 --run <runId> --candidate <id>`,
- *Then* `CandidateAccepted` is emitted, `surfaceOpportunityUseCase` (Spec 003) is called, and an `OpportunitySurfaced` event lands in the stream.

**AC-6 (Triage rejects → audited).**
- *Given* a surfaced candidate awaiting triage,
- *When* the user runs `agent:reject --tenant tenant-0 --run <runId> --candidate <id> --reason <r>`,
- *Then* `CandidateRejected` is emitted with the reason. No opportunity is created. The audit trail preserves the rejection.

**AC-7 (No write path beyond Opportunity).**
- *Given* any agent run,
- *Then* the only value-chain events emitted are `SocialChannelConnected`/`Disconnected` (one-time setup), `TenantOfferingUpdated` (manual reload), `CandidateSurfaced` (per candidate), `CandidateAccepted`/`Rejected` (per triage), and `OpportunitySurfaced` (per acceptance). The agent **never** emits a DM, comment, post, or any platform-mutating event.

**AC-8 (Bounded execution, Constitution Article IV).**
- *Given* a step exceeds its budget,
- *Then* the run is marked `failed` and emits `AgentRunFailed`. The agent never persists state outside the per-tenant run log. The agent never modifies its own memory beyond the deterministic cursor + dedup set. The agent never escalates its privileges.

**AC-9 (Tenant isolation).**
- *Given* two tenants with their own offerings and channels,
- *When* each runs the agent,
- *Then* Tenant A's run never reads Tenant B's channel; Tenant B's run never sees Tenant A's offering. Each run's events carry the right `tenantId` in lineage.

**AC-10 (Replayable audit).**
- *Given* the event stream,
- *When* an external tool replays the run,
- *Then* it reconstructs: the run's start time, the signals fetched (count), the matches computed (count), the candidates surfaced (count + ids), and each triage decision with its reason.

**AC-11 (No new Core primitives).**
- *Given* the MVP is built,
- *Then* `@daedalus/core` is unchanged (no new events, aggregates, projections, ports). The agent consumes only existing use cases through public contracts.

---

## 9. Non-goals (binding)

- **No multi-platform support.** LinkedIn only in v0. Other platforms (X, Instagram, Mastodon, etc.) are follow-on specs.
- **No outbound agent actions.** No DMs, comments, posts, follows, unfollows, likes, or any platform-mutating event. These are irreversible (Constitution Article IV) and require a Policy engine (Phase 3+).
- **No agent memory that learns.** The "memory" is a deterministic dedup set, not a learned model. Weights, preferences, and priors are not adjusted based on past decisions.
- **No model fine-tuning or training.** The agent uses a bounded LLM call through an `LLMPort`. The MVP does not specify the model; the adapter is a separate decision (per ADR-style governance).
- **No webhooks.** Polling only. Webhooks are a Phase 5 concern (and require platform cooperation).
- **No scheduling beyond polling.** A simple interval (default 60 minutes, configurable per tenant). Cron-style scheduling is a future concern.
- **No multi-tenant shared agent.** Each tenant runs its own agent instance. There is no "Daedalus social agent" that operates across tenants.
- **No outbound notifications.** The agent does not email, SMS, or push notifications. Triage is via CLI (and via ATLAS read views once those exist).
- **No new Core events, aggregates, projections, or ports in Core.** The eight new events live in the agent's vocabulary, not in Core.

---

## 10. Risks

- **R1 — Platform ToS.** LinkedIn's API restricts automated reading and forbids scraping. The MVP **requires the official LinkedIn API** with valid OAuth. Any implementation that bypasses this violates the platform's ToS and is out of scope. *Mitigation:* the spec's only allowed auth path is the official LinkedIn OAuth; the agent does **not** use scraping fallbacks. Documented as a binding constraint.
- **R2 — Agent drift.** A future contributor might add an action the spec doesn't authorize. *Mitigation:* AC-7 enumerates the only allowed value-chain events; AC-8 enforces boundedness; a test greps for forbidden use cases (the same pattern as Spec 008 AC-10).
- **R3 — PII exposure.** The agent sees real names, profile data, message content. None of this should leak to the audit trail beyond what the candidate needs to be triaged. *Mitigation:* the run log records `signalId` and a **summary**, not the raw signal content (which can be PII). The summary is bounded (e.g. up to 280 characters, redact known sensitive patterns).
- **R4 — Policy gap (offering ambiguity).** If the tenant offering is sparse or contradictory, the agent's matching is unreliable. *Mitigation:* AC-1 refuses to run without a configured offering. If the offering changes mid-run, the run completes; the next run uses the new offering. The agent **never** invents criteria.
- **R5 — API rate limits / outages.** LinkedIn rate-limits aggressively. *Mitigation:* the run's FETCHING step has a budget; on 429 / 5xx, the run fails gracefully with `AgentRunFailed`. The next run retries.
- **R6 — LLM cost / latency.** A naive loop might spend the tenant's budget. *Mitigation:* the run has a hard cap on the number of signals matched (default 50 per run); the agent is single-threaded; the LLM port is configured per tenant (tenant config sets max tokens / max cost per run).
- **R7 — Confused-deputy on the platform.** An agent acting on Tenant 0's behalf must be unambiguously identified as such. *Mitigation:* OAuth scopes are read-only; the agent's User-Agent identifies it as `daedalus-social-agent/<version>`.
- **R8 — Tenant isolation in the run log.** A future bug might log Tenant A's run under Tenant B. *Mitigation:* AC-9 + a test that seeds two tenants' offerings and verifies each agent run reads only its own.

---

## 11. Open questions

- **Q1 — Platform choice for v0.** LinkedIn is the most common B2B channel; the official API allows reading posts + DMs. *Recommendation:* LinkedIn. Other platforms are follow-on specs.
- **Q2 — What counts as a "candidate"?** Mention of a relevant keyword? A DM from a name in the founder's network? A profile whose headline matches the offering? *Recommendation:* all three, with per-tenant config that can disable each (the founder might not want DM-based candidates in v0).
- **Q3 — Tenant Offering schema.** How structured is the offering document? *Recommendation:* the JSON shape in §5 — services, industries, deal size range, keywords, negative keywords. The schema is small; it can grow later.
- **Q4 — Poll cadence.** How often does the agent run? *Recommendation:* default 60 minutes; configurable per tenant. Manual triggers via `agent:run` CLI override.
- **Q5 — LLM vendor.** Who provides the model that evaluates signals against the offering? *Recommendation:* the MVP defines an `LLMPort` (interface). The adapter is a separate decision, with governance per the established ADR pattern. The MVP ships with **one** adapter (an obvious default for Tenant 0); other adapters are vendor decisions, not part of this spec.
- **Q6 — Calendar-window dedup default.** 30 days seems reasonable; some founders may want longer. *Recommendation:* configurable per tenant. Default 30 days.
- **Q7 — Confidence threshold.** Medium is the default; some founders will want high-only. *Recommendation:* configurable per tenant. Default medium.
- **Q8 — When the agent is wrong.** A candidate the agent surfaces is later rejected by the human — the agent doesn't learn. Is that a problem? *Recommendation:* not in the MVP. The audit trail preserves every rejection; Phase 4+ can use that data to tune the agent (with the founder's explicit opt-in).

---

## 12. Activation criteria (binding)

T-01…T-N in `tasks.md` may begin only when **all** of the following are true:

1. **Spec 009 is ratified** by stewards.
2. **An ADR moves the Social-to-Opportunity Agent into the Roadmap** as the first Phase 4 milestone.
3. **Workflow Engine (Spec 008) is shipped** — the agent runs as a workflow instance under `social-agent-run.v0.1.0`. Until this lands, the agent has no substrate to run on.
4. **One of the following:**
   - **Policy Engine (Phase 3) is shipped** — the agent's actions are gated by policy automatically.
   - **OR** explicit human approval is configured per action — every `CandidateSurfaced` waits for `HumanApproved`. (This is the v0 fallback per Constitution Article V.)
5. **The founder (Tenant 0) confirms** the LinkedIn-only scope, the offering schema, and the explicit-human-approval mode.

---

## 13. Out of scope (binding)

- Multi-platform support.
- Outbound actions (DMs, comments, posts, follows, likes).
- Agent memory that learns from past decisions.
- Model fine-tuning or training.
- Webhooks (vs polling).
- Cron-style scheduling.
- Multi-tenant shared agent.
- Outbound notifications (email/SMS/push).
- New Core events, aggregates, projections, or ports.
- LLM vendor selection (governed separately).
- Phase 4+ general Agent Runtime — this spec is the first concrete slice.

---

## 14. Companion artifacts

- **`plan.md`** — implementation plan: `packages/social-agent/` layout, workflow artifact, tenant config shape, CLI commands, AC-to-test mapping, evidence run, definition of done.
- **`tasks.md`** — task breakdown, forward-planning, not a build authorization.

---

*Subordinate to the [Constitution](../../memory/constitution.md), [Technical Principles](../../memory/technical-principles.md), and the [Roadmap](../../docs/roadmap.md). The first agent — small, bounded, auditable, human-approved. The rest of Phase 4 follows usage.*