# Plan — Social-to-Opportunity Agent MVP

**Status:** Draft · implementation plan for [Spec 009](./spec.md)
**Goal:** Ship the first end-to-end agent slice: Tenant 0 connects LinkedIn, configures their offering, and runs a bounded agent that surfaces candidates for human triage. Accepted candidates become real `Opportunity` events (Spec 003).
**Conforms to:** [Constitution](../../memory/constitution.md), [Technical Principles](../../memory/technical-principles.md), [ADR-002](../../governance/decisions/ADR-002-adopt-technical-framework.md), [ADR-003](../../governance/decisions/ADR-003-modular-monorepo.md), [ADR-004](../../governance/decisions/ADR-004-export-discipline-and-lineage.md), Spec 003, Spec 007, Spec 008.
**Version:** 0.1.0
**Last updated:** 2026-06-21

> **Pre-conditions for build authorization.** This plan activates only after (a) Spec 009 is ratified, (b) an ADR moves the agent into the [Roadmap](../../docs/roadmap.md) as the first Phase 4 milestone, (c) Workflow Engine (Spec 008) is shipped, (d) explicit-human-approval mode is in effect, and (e) the founder confirms the LinkedIn-only scope.

---

## 0. Q resolutions (from Spec 009 §11)

- **Q1 (platform):** LinkedIn. One platform in v0.
- **Q2 (candidate sources):** Posts + DMs + profile matches. Per-tenant config can disable each.
- **Q3 (offering schema):** The shape in Spec 009 §5 (elevator, services, industries, deal size, keywords, negative keywords). Lives in `config/tenants/<tenant>/offering.json`.
- **Q4 (poll cadence):** Default 60 minutes; per-tenant configurable. Manual triggers via `agent:run` CLI.
- **Q5 (LLM vendor):** The MVP defines `LLMPort` (interface). One adapter ships with the MVP — the choice of vendor is a separate governance decision.
- **Q6 (dedup window):** Default 30 days; per-tenant configurable.
- **Q7 (confidence threshold):** Default `medium`; per-tenant configurable.
- **Q8 (learning from rejection):** Out of scope. Audit trail preserves rejections; Phase 4+ may use them with explicit opt-in.

---

## 1. Architecture

```
packages/social-agent/                          # NEW package
  src/
    domain/
      offering.ts              # Tenant Offering (read-only)
      channel.ts               # Social Channel descriptor
      signal.ts                # Raw signal (post / DM / profile match) — read-only
      match.ts                 # Match (Signal + reasoning + confidence)
      candidate.ts             # Candidate (Match above threshold)
    application/
      run.ts                   # AgentRun lifecycle (workflow instance)
      offerring-matcher.ts     # Match signals against the offering (pure)
      llm-port.ts              # LLMPort interface
      channels/
        linkedin-port.ts       # LinkedInChannelPort interface
    adapters/
      llm/
        default-llm-adapter.ts # one concrete adapter (vendor chosen separately)
      channels/
        linkedin-oauth-adapter.ts
        linkedin-read-adapter.ts  # fetches signals via official LinkedIn API
      tenant-secrets.ts        # loads social-credentials.json (gitignored)
      run-log.ts               # writes .data/tenants/<t>/social-agent-runs.jsonl
    cli.ts                     # entry: `agent:connect`, `agent:run`, `agent:accept`, `agent:reject`, `agent:status`
  tests/                       # AC-1..AC-11 + offering schema validation + LLM port contract
  package.json                 # no `dependencies`; peer deps: @daedalus/core, @daedalus/opportunity-discovery

config/tenants/tenant-0/
  offering.json                # NEW (committed) — what the tenant sells
  social-channels.json         # NEW (committed, no secrets) — public descriptor of connected channels
  social-credentials.json      # NEW (GITIGNORED) — OAuth tokens, API keys

blueprints/workflows/
  social-agent-run.v0.1.0.json # NEW — the workflow artifact that runs the agent

.data/tenants/<tenant>/
  social-agent-runs.jsonl      # NEW (gitignored) — per-run log

apps/cli/src/index.ts          # + 5 commands: agent:connect, agent:run, agent:accept, agent:reject, agent:status
```

### Dependency rule (unchanged from ADR-003/004)

- `packages/social-agent` → `@daedalus/core`, `@daedalus/opportunity-discovery`, `@daedalus/workflow-engine` (Spec 008).
- `@daedalus/core` is **unchanged** (Spec 009 AC-11).
- The agent's `LinkedinReadAdapter` lives in `adapters/channels/`. The CLI imports it from that subpath.
- `LLMPort` is the only seam between the agent and the model. The adapter is committed but the vendor choice is a separate governance decision.

---

## 2. Tenant config shapes (committed; no secrets)

### `config/tenants/tenant-0/offering.json`

Conceptual shape (no schema in the plan; the file ships with the implementation PR):

```
{
  "version": "0.1.0",
  "elevator": "...",            // short pitch
  "services": ["..."],         // what the tenant sells
  "industries": ["..."],       // target industries
  "dealSize": { "min": ..., "max": ..., "currency": "CLP" },
  "keywords": ["..."],         // positive signals
  "negativeKeywords": ["..."]  // suppress signals
}
```

### `config/tenants/tenant-0/social-channels.json`

```
{
  "channels": [
    {
      "id": "linkedin-tenant-0",
      "platform": "linkedin",
      "scope": "read",
      "connectedAt": "2026-06-21T..."
    }
  ]
}
```

### `config/tenants/tenant-0/social-credentials.json` (GITIGNORED)

```
{
  "linkedin-tenant-0": {
    "accessToken": "...",
    "refreshToken": "...",
    "expiresAt": "..."
  }
}
```

> **`.gitignore` must include `config/tenants/**/social-credentials.json`.** A test in the implementation PR verifies the gitignore contract.

---

## 3. The workflow artifact: `social-agent-run.v0.1.0.json`

Conceptual shape follows Spec 008 §9. The transitions are described in Spec 009 §7:

```
Workflow: social-agent-run v0.1.0
Initial: ready
Terminal: completed, failed, compensated

States:
  ready:     on ScheduledTick → [polling]
  polling:   on ManualTrigger → [polling]   (manual run via CLI)
  polling → fetching:    action: emitAgentRunStarted
  fetching → matching:   action: fetchSignals(lastSeenCursor)
  matching → surfacing:  action: matchAgainstOffering
  surfacing → awaiting_human: action: filterCandidates, emitCandidateSurfaced, requiresHuman: true
  awaiting_human → completed:  trigger: CandidateAccepted | CandidateRejected
  any-state → failed:   on StepFailure
  failed → compensated: action: compensation
```

The `requiresHuman: true` gate on the awaiting_human → completed transition is what enforces the MVP's human-approval mode. Phase 3 (Policy engine) will replace this gate with a policy check; the seam is wired from day one (the workflow artifact carries a `policyRef` field that's no-op in v0).

---

## 4. CLI commands added

The CLI gets five new commands. None of the existing commands change.

| Command | Effect |
|---|---|
| `agent:connect --tenant <t> --platform linkedin` | Run the LinkedIn OAuth flow. On success, write `social-channels.json` + `social-credentials.json`; emit `SocialChannelConnected`. |
| `agent:disconnect --tenant <t> --channel <id>` | Emit `SocialChannelDisconnected`; clear credentials. |
| `agent:run --tenant <t>` | Trigger a run manually. Equivalent to a scheduled tick. |
| `agent:accept --tenant <t> --run <runId> --candidate <id>` | Emit `CandidateAccepted`; call `surfaceOpportunityUseCase` (Spec 003). |
| `agent:reject --tenant <t> --run <runId> --candidate <id> --reason <r>` | Emit `CandidateRejected` with reason. |
| `agent:status --tenant <t>` | List in-flight and recent runs. |

---

## 5. `packages/social-agent/src/domain/offering.ts` — Tenant Offering shape

The MVP ships with a JSON Schema (committed) and a small loader that validates `offering.json` against the schema at startup. A malformed offering fails the agent closed (AC-1).

The schema is intentionally small in v0 — five fields. It can grow later without breaking changes (additive).

---

## 6. The matching step (pure, testable)

`offering-matcher.ts` is a **pure function** that takes `(signal, offering)` and returns either `null` or a `Match` with reasoning + confidence. No I/O. No LLM in v0.1.0's matching — v0.1.0 uses **keyword-based matching**; the LLM is used only for **summarization** of the signal into a triage-friendly summary (so the founder can decide without opening the platform).

> **Why keyword matching first.** The MVP must work without an LLM dependency in v0.1.0. Keyword matching is deterministic, fast, and auditable. The LLM is a thin summarization step on top. Phase 4+ can replace keyword matching with a richer model under the `LLMPort` seam.

If v0.1.0 ships without an LLM dependency at all, the agent still surfaces candidates. The LLM is an enhancement, not a requirement.

---

## 7. Engine events vs value-chain events (clarification)

The agent emits **two kinds** of events:

- **Value-chain events** (recorded in the canonical event stream): `SocialChannelConnected`, `SocialChannelDisconnected`, `TenantOfferingUpdated`, `CandidateSurfaced`, `CandidateAccepted`, `CandidateRejected`, `AgentRunStarted`, `AgentRunCompleted`, `OpportunitySurfaced` (via Spec 003).
- **Engine events** (recorded in the same stream, per Spec 008): `WorkflowInstanceStarted`, `WorkflowTransitionFired`, `HumanApprovalRequired`, `HumanApproved`, `WorkflowInstanceCompleted`, `WorkflowInstanceCompensated`.

Both kinds share the same `EventStorePort` and the same lineage discipline. The split is conceptual: value-chain events change domain state; engine events change workflow state.

---

## 8. Acceptance criteria → test mapping

| Spec 009 AC | Test |
|---|---|
| AC-1 (offering setup) | `tests/agent-offering.test.ts` |
| AC-2 (channel connect) | `tests/agent-channel.test.ts` (mocked OAuth) |
| AC-3 (run lifecycle) | `tests/agent-run.test.ts` |
| AC-4 (candidate surfacing) | `tests/agent-matching.test.ts` |
| AC-5 (triage accepts → opportunity) | `tests/agent-triage-accept.test.ts` |
| AC-6 (triage rejects → audited) | `tests/agent-triage-reject.test.ts` |
| AC-7 (no write path beyond Opportunity) | `tests/agent-no-write-paths.test.ts` (greps for forbidden use cases) |
| AC-8 (bounded execution, Article IV) | `tests/agent-bounded.test.ts` (timeout, privilege escalation, etc.) |
| AC-9 (tenant isolation) | `tests/agent-tenant-isolation.test.ts` |
| AC-10 (replayable audit) | `tests/agent-audit.test.ts` |
| AC-11 (no new Core primitives) | `tests/agent-zero-core-change.test.ts` (greps for forbidden imports) |

Plus:
- Offering JSON Schema validation test (a malformed offering fails the agent).
- Gitignore contract test (`config/tenants/**/social-credentials.json` is gitignored).
- LLM port contract test (a stub adapter implements the interface; the matcher doesn't import the adapter directly).

---

## 9. Evidence run (end-to-end)

```
# One-time setup (terminal 1)
node apps/cli/src/index.ts agent:connect --tenant tenant-0 --platform linkedin
# (OAuth flow; channel + credentials saved.)
# Edit config/tenants/tenant-0/offering.json with Tenant 0's offering.

# Manual run
node apps/cli/src/index.ts agent:run --tenant tenant-0
# Run emits: AgentRunStarted → polling → fetching → matching → surfacing → HumanApprovalRequired

# Triage
node apps/cli/src/index.ts events --tenant tenant-0 | grep CandidateSurfaced
node apps/cli/src/index.ts agent:accept --tenant tenant-0 --run <runId> --candidate <candId>
node apps/cli/src/index.ts events --tenant tenant-0 | grep OpportunitySurfaced

# Verify ATLAS shows everything
open http://localhost:8788/t/tenant-0/events
open http://localhost:8788/t/tenant-0/activity
```

A two-tenant isolation run repeats the above for `tenant-other` with a different offering; each agent sees only its own.

---

## 10. Definition of done (v0)

- All 11 ACs covered by `node --test`.
- LinkedIn OAuth flow works end-to-end against the **official LinkedIn API** (test mocks the API; production uses real credentials).
- One workflow shipped (`social-agent-run` v0.1.0).
- Five new CLI commands; existing commands unchanged.
- Tenant 0's `offering.json` + `social-channels.json` committed; `social-credentials.json` is gitignored.
- Eight new agent events + the eight engine events from Spec 008.
- Acceptance test creates at least one `Opportunity` from an accepted candidate (the round-trip through Spec 003).
- Two-tenant isolation test passes.
- Zero new Core events, aggregates, projections, ports (AC-11).
- `packages/social-agent/package.json` declares zero `dependencies`.
- The 88 + 26 existing ATLAS tests stay green.

---

## 11. Out of scope (binding — from Spec 009 §9, §13)

- No multi-platform support (LinkedIn only).
- No outbound agent actions (DMs, comments, posts, follows, likes).
- No agent memory that learns.
- No model fine-tuning.
- No webhooks.
- No cron-style scheduling.
- No multi-tenant shared agent.
- No outbound notifications (email/SMS/push).
- No new Core primitives.
- No LLM vendor selection (separate governance decision).

---

*Subordinate to [Spec 009](./spec.md), the [Constitution](../../memory/constitution.md), and the [Technical Principles](../../memory/technical-principles.md). The first agent — small, bounded, auditable, human-approved.*