# Plan — Inbound Discovery Agent MVP

**Status:** Draft · implementation plan for [Spec 009](./spec.md) v0.2.0 (revised after architectural review)
**Goal:** Ship the first end-to-end agent slice. Tenant 0 connects a LinkedIn Channel, configures their Offering (via the new `@daedalus/offering` module), and runs a bounded agent that surfaces Candidates for human triage. Promoted Candidates become real `Opportunity` events (Spec 003).
**Conforms to:** [Constitution](../../memory/constitution.md), [Technical Principles](../../memory/technical-principles.md), [ADR-002](../../governance/decisions/ADR-002-adopt-technical-framework.md), [ADR-003](../../governance/decisions/ADR-003-modular-monorepo.md), [ADR-004](../../governance/decisions/ADR-004-export-discipline-and-lineage.md), Spec 003, Spec 007, Spec 008.
**Version:** 0.3.0 (forward-looking observations documented; no architectural change vs. v0.2.0)
**Last updated:** 2026-06-22

> **Pre-conditions for build authorization.** This plan activates only after (a) Spec 009 is ratified, (b) an ADR moves the agent into the [Roadmap](../../docs/roadmap.md) as the first Phase 4 milestone AND proposes `@daedalus/offering` as a new module, (c) Workflow Engine (Spec 008) is shipped, (d) explicit-human-approval mode is in effect, and (e) the founder confirms the LinkedIn-only scope.

---

## 0. Q resolutions (from Spec 009 §12)

- **Q1 (Channel kind for v0):** LinkedIn. One Channel kind in v0.
- **Q2 (candidate sources):** Posts + DMs + profile matches. Per-tenant config can disable each.
- **Q3 (Offering schema):** The shape in Spec 009 §5. Lives in `config/tenants/<tenant>/offering.json`. Owned by `@daedalus/offering`.
- **Q4 (poll cadence):** Default 60 minutes; per-tenant configurable. Manual triggers via `agent:run` CLI.
- **Q5 (LLM vendor):** `LLMPort` interface declared in `packages/inbound-agent/src/`. **No concrete LLM adapter wired in v0.** Matching is purely deterministic keyword-based.
- **Q6 (dedup window):** Default 30 days; per-tenant configurable.
- **Q7 (confidence threshold):** Default `medium`; per-tenant configurable.
- **Q8 (learning from dismissal):** Out of scope. Audit trail preserves dismissals; Phase 4+ may use them with explicit opt-in.

### 0.1 Forward-looking observations (from v0.2.0 review)

See Spec 009 §11.1 for the full discussion. Summary of resolutions:

- **O-1 (Signal/Match ownership):** v0 keeps `Signal` and `Match` in `@daedalus/offering`. Future Spec 003 v1 may split ownership; that work belongs there.
- **O-2 (event-driven promotion):** v0 keeps the direct call to `surfaceOpportunityUseCase`. Future Spec 003 v1 introduces an `opportunity-from-candidate` workflow; the agent then drops the import.
- **O-3 (Workflow Engine as a hard dependency):** v0 keeps Workflow Engine as the substrate. The simpler-use-case alternative is documented but not adopted.
- **O-4 (AC-12 grep fragility):** Acknowledged. The grep test is the fast guardrail; ADR-004 package boundaries are the structural one.
- **O-5 (strategic concept `Problem`):** Out of scope for v0. Documented as a future direction (likely Spec 003 v1 or a new Spec 011).

---

## 1. Architecture

```
packages/offering/                                # NEW MODULE (peer to @daedalus/revenue-visibility)
  src/
    domain/
      offering.ts              # Offering type (read-only)
      signal.ts                # Signal type (read-only)
      match.ts                 # Match type (read-only)
    application/
      match-signal.ts          # matchSignalAgainstOffering(Signal, Offering): Match | null
      validate-offering.ts     # validator (against JSON Schema)
      deps.ts                  # OfferingDeps
    adapters/
      json-schema-validator.ts # JSON Schema validator (one concrete adapter)
    cli.ts                     # offering:validate, offering:show
  tests/
  package.json                 # no `dependencies`; peer deps: @daedalus/core

packages/inbound-agent/                          # NEW MODULE (peer to @daedalus/revenue-visibility)
  src/
    domain/
      channel.ts               # Channel (kind discriminator)
      signal.ts                # re-exports from @daedalus/offering
      match.ts                 # re-exports from @daedalus/offering
      candidate.ts             # Candidate (projection; not first-class aggregate)
      run.ts                   # AgentRun (workflow instance)
    application/
      ports/
        channel-adapter.ts     # ChannelAdapter interface (read, OAuth refresh)
        llm-port.ts            # LLMPort interface (NO concrete adapter wired in v0)
      run.ts                   # AgentRun lifecycle (workflow instance)
      deps.ts                  # InboundAgentDeps
    adapters/
      channels/
        linkedin-channel-adapter.ts   # LinkedInChannelAdapter (the only adapter in v0)
        linkedin-oauth-adapter.ts     # LinkedIn OAuth flow (for agent:connect)
      tenant-secrets.ts        # loads channel-credentials.json (gitignored)
      run-log.ts               # writes .data/tenants/<t>/inbound-agent-runs.jsonl (gitignored)
    cli.ts                     # entry: agent:connect, agent:disconnect, agent:run, agent:promote, agent:dismiss, agent:status
  tests/                       # AC-1..AC-14 + domain-platform-agnosticism guard
  package.json                 # no `dependencies`; peer deps: @daedalus/core, @daedalus/offering, @daedalus/opportunity-discovery

config/tenants/tenant-0/
  offering.json                # NEW (committed) — what the tenant sells (owned by @daedalus/offering)
  channels.json                # NEW (committed, no secrets) — public descriptor of connected Channels
  channel-credentials.json     # NEW (GITIGNORED) — OAuth tokens, API keys

blueprints/workflows/
  inbound-agent-run.v0.1.0.json # NEW — the workflow artifact that runs the agent

.data/tenants/<tenant>/
  inbound-agent-runs.jsonl      # NEW (gitignored) — per-run log

apps/cli/src/index.ts          # + 6 commands: agent:connect, agent:disconnect, agent:run, agent:promote, agent:dismiss, agent:status
```

### Dependency rule (unchanged from ADR-003/004)

- `packages/offering` → `@daedalus/core`. Owns: Offering, Signal, Match, the matcher. No domain deps on agent code.
- `packages/inbound-agent` → `@daedalus/core`, `@daedalus/offering` (for matching), `@daedalus/opportunity-discovery` (for promotion), `@daedalus/workflow-engine` (Spec 008, for the workflow).
- `@daedalus/core` is **unchanged** (Spec 009 AC-11).
- The `LinkedinChannelAdapter` lives in `adapters/channels/`. **It is the only file in the agent's source tree that mentions "linkedin"** (AC-12 enforces this).
- The `LLMPort` interface is declared but **no concrete LLM adapter is wired in v0** (AC-14 enforces this).

---

## 2. Tenant config shapes (committed; no secrets)

### `config/tenants/tenant-0/offering.json` (owned by `@daedalus/offering`)

Conceptual shape (the schema ships with `@daedalus/offering`):

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

### `config/tenants/tenant-0/channels.json`

```
{
  "channels": [
    {
      "id": "tenant-0-linkedin",
      "kind": "linkedin",
      "scope": "read",
      "connectedAt": "2026-06-22T..."
    }
  ]
}
```

### `config/tenants/tenant-0/channel-credentials.json` (GITIGNORED)

```
{
  "tenant-0-linkedin": {
    "accessToken": "...",
    "refreshToken": "...",
    "expiresAt": "..."
  }
}
```

> **`.gitignore` must include `config/tenants/**/channel-credentials.json`.** A test verifies the gitignore contract.

---

## 3. The workflow artifact: `inbound-agent-run.v0.1.0.json`

Conceptual shape follows Spec 008 §9. The transitions are described in Spec 009 §7:

```
Workflow: inbound-agent-run v0.1.0
Initial: ready
Terminal: completed, failed, compensated

States:
  ready:     on ScheduledTick → [polling]
  polling:   on ManualTrigger → [polling]   (manual run via CLI)
  polling → fetching:    action: emitAgentRunStarted
  fetching → matching:   action: fetchSignals(lastSeenCursor)
  matching → surfacing:  action: matchAgainstOffering (via @daedalus/offering)
  surfacing → awaiting_human: action: filterCandidates, emitCandidateSurfaced, requiresHuman: true
  awaiting_human → completed:  trigger: CandidatePromoted | CandidateDismissed
  any-state → failed:   on StepFailure
  failed → compensated: action: compensation
```

The `requiresHuman: true` gate on the awaiting_human → completed transition is what enforces the MVP's human-approval mode. Phase 3 (Policy engine) will replace this gate with a policy check; the seam is wired from day one (the workflow artifact carries a `policyRef` field that's no-op in v0).

---

## 4. CLI commands added

The CLI gets six new commands. None of the existing commands change.

| Command | Effect |
|---|---|
| `agent:connect --tenant <t> --kind linkedin` | Run the LinkedIn OAuth flow. On success, write `channels.json` + `channel-credentials.json`; emit `ChannelConnected`. |
| `agent:disconnect --tenant <t> --channel <id>` | Emit `ChannelDisconnected`; clear credentials. |
| `agent:run --tenant <t>` | Trigger a run manually. Equivalent to a scheduled tick. |
| `agent:promote --tenant <t> --run <runId> --candidate <id>` | Emit `CandidatePromoted`; call `surfaceOpportunityUseCase` (Spec 003). |
| `agent:dismiss --tenant <t> --run <runId> --candidate <id> --reason <r>` | Emit `CandidateDismissed` with reason. |
| `agent:status --tenant <t>` | List in-flight and recent runs. |

The CLI commands are **platform-agnostic**: `--kind linkedin` is one value; future kinds (email, RSS, etc.) are follow-on specs.

---

## 5. `@daedalus/offering` — the reusable module

The plan introduces a new module, not just a file inside the agent.

### What `@daedalus/offering` owns (v0)

- The `Offering` type (read-only).
- A JSON Schema (committed in the package).
- A validator: `validateOffering(jsonString): Offering | ValidationError`.
- The matcher: `matchSignalAgainstOffering(Signal, Offering): Match | null` — deterministic, keyword-based, no LLM dependency.
- The `Signal` and `Match` types (the agent imports these from `@daedalus/offering`).

### What `@daedalus/offering` does **NOT** own

- Channel-specific code (LinkedIn, email, RSS, etc.). Those are ChannelAdapters, owned by their respective agents.
- Agent lifecycle, workflow artifacts, run logs. Those belong to the Inbound Agent.
- LLM integration (no `LLMPort` in `@daedalus/offering`). If matching becomes LLM-backed in a follow-on spec, the LLM seam lives in the agent that uses it, not in `@daedalus/offering`.

### Why `@daedalus/offering` exists separately

- **Reusability.** Future Spec 003 v1 (Discovery qualification) and Spec 002 v1 (proposal alignment) consume `@daedalus/offering`. Without it, they'd duplicate the matcher.
- **Ownership.** The Offering is a tenant's strategic asset, not an agent's local state. It deserves its own module with its own tests, schema, and governance.
- **Testability.** The matcher is a pure function — it can be tested without the agent, without channels, without OAuth. The agent's tests focus on workflow + tenant isolation; the offering's tests focus on matching.

---

## 6. The matching step (pure, testable, no LLM)

`packages/offering/src/application/match-signal.ts` is a **pure function** that takes `(Signal, Offering)` and returns either `null` or a `Match` with reasoning + confidence.

**Algorithm (v0):**
1. Read the Signal's text content (already redacted/summarized to 280 chars by the ChannelAdapter).
2. Score against the Offering:
   - Each `keywords` match: +N points.
   - Each `negativeKeywords` match: veto (return `null` regardless of other matches).
   - Each `services` mention: +N points.
   - Each `industries` mention: +N points.
3. Map the score to `low | medium | high`.
4. If the score crosses the threshold (default `medium`), return a `Match`. Otherwise return `null`.

**No I/O. No LLM. No async.** The function is synchronous and deterministic. It's the heart of v0.

> **Why keyword matching first.** v0 must work without an LLM dependency. Keyword matching is deterministic, fast, auditable, and unit-testable. The `LLMPort` is declared in `packages/inbound-agent/src/application/ports/llm-port.ts` as a future seam; no concrete adapter is wired in v0 (AC-14).

---

## 7. The Channel Adapter pattern (platform-agnostic)

```
ChannelAdapter (interface, in packages/inbound-agent/src/application/ports/channel-adapter.ts)
  ├─ kind: "linkedin" | "email" | "rss" | ...   (discriminator; the package adds new kinds)
  ├─ fetchSignals(channelDescriptor, since): AsyncIterable<Signal>
  ├─ refreshAuth(channelDescriptor): void
  └─ summary(signal): SignalSummary           # bounded, redacted; < 280 chars

LinkedinChannelAdapter (in packages/inbound-agent/src/adapters/channels/linkedin-channel-adapter.ts)
  ├─ implements ChannelAdapter for kind="linkedin"
  ├─ uses LinkedinOAuthAdapter for OAuth refresh
  └─ calls LinkedIn's official read APIs only (no scraping)
```

The runtime selects an adapter by inspecting the Channel descriptor's `kind`. Adding a new platform = adding a new file in `adapters/channels/`. The domain, the matching, and the agent's lifecycle don't change.

> **The LinkedinChannelAdapter is the only file in `packages/inbound-agent/` that mentions "linkedin".** AC-12 enforces this with a grep test.

---

## 8. Acceptance criteria → test mapping

| Spec 009 AC | Test |
|---|---|
| AC-1 (offering setup) | `tests/agent-offering.test.ts` (in `inbound-agent`); plus `tests/offering-validation.test.ts` (in `@daedalus/offering`) |
| AC-2 (channel connect) | `tests/agent-channel.test.ts` (mocked OAuth) |
| AC-3 (run lifecycle) | `tests/agent-run.test.ts` |
| AC-4 (candidate surfacing) | `tests/agent-matching.test.ts` |
| AC-5 (triage promotes → opportunity) | `tests/agent-triage-promote.test.ts` |
| AC-6 (triage dismisses → audited) | `tests/agent-triage-dismiss.test.ts` |
| AC-7 (no write path beyond Opportunity) | `tests/agent-no-write-paths.test.ts` (greps for forbidden use cases) |
| AC-8 (bounded execution, Article IV) | `tests/agent-bounded.test.ts` |
| AC-9 (tenant isolation) | `tests/agent-tenant-isolation.test.ts` |
| AC-10 (replayable audit) | `tests/agent-audit.test.ts` |
| AC-11 (no new Core primitives) | `tests/agent-zero-core-change.test.ts` |
| AC-12 (domain is platform-agnostic) | `tests/agent-domain-agnostic.test.ts` (greps domain/ for platform names) |
| AC-13 (Offering is a reusable module) | `tests/offering-public-contract.test.ts` (verifies public exports; consumed by Inbound Agent and conceptually by future Spec 003 v1) |
| AC-14 (MVP does not depend on LLM behavior) | `tests/agent-no-llm-adapter.test.ts` (verifies no concrete LLM adapter is wired) |

Plus:
- Offering JSON Schema validation test (a malformed offering fails the agent).
- Gitignore contract test (`config/tenants/**/channel-credentials.json` is gitignored).
- ChannelAdapter port contract test (a stub adapter implements the interface).
- Candidate projection test (replay derives pending/promoted/dismissed counts).

---

## 9. Evidence run (end-to-end)

```
# One-time setup (terminal 1)
node apps/cli/src/index.ts agent:connect --tenant tenant-0 --kind linkedin
# (OAuth flow; channel + credentials saved.)
# Edit config/tenants/tenant-0/offering.json with Tenant 0's offering.

# Manual run
node apps/cli/src/index.ts agent:run --tenant tenant-0
# Run emits: AgentRunStarted → polling → fetching → matching → surfacing → HumanApprovalRequired

# Triage
node apps/cli/src/index.ts events --tenant tenant-0 | grep CandidateSurfaced
node apps/cli/src/index.ts agent:promote --tenant tenant-0 --run <runId> --candidate <candId>
node apps/cli/src/index.ts events --tenant tenant-0 | grep OpportunitySurfaced

# Verify ATLAS shows everything
open http://localhost:8788/t/tenant-0/events
open http://localhost:8788/t/tenant-0/activity
```

A two-tenant isolation run repeats the above for `tenant-other` with a different offering; each agent sees only its own.

---

## 10. Definition of done (v0)

- All 14 ACs covered by `node --test`.
- LinkedIn OAuth flow works end-to-end against the **official LinkedIn API** (test mocks the API; production uses real credentials).
- One workflow shipped (`inbound-agent-run` v0.1.0).
- Six new CLI commands; existing commands unchanged.
- Tenant 0's `offering.json` + `channels.json` committed; `channel-credentials.json` is gitignored.
- Eight new agent events + the eight engine events from Spec 008.
- Acceptance test creates at least one `Opportunity` from a promoted candidate (the round-trip through Spec 003).
- Two-tenant isolation test passes.
- Zero new Core events, aggregates, projections, ports (AC-11).
- `packages/inbound-agent/package.json` declares zero `dependencies`.
- `packages/offering/package.json` declares zero `dependencies`.
- The 88 + 26 existing ATLAS tests stay green.
- **Domain discipline tests pass:** AC-12 (no platform names in `domain/`) and AC-14 (no LLM adapter wired).

---

## 11. Out of scope (binding — from Spec 009 §9, §14)

- No multi-channel support (LinkedIn only).
- No outbound actions.
- No agent memory that learns.
- No LLM dependency (the seam exists; no adapter wired in v0).
- No model fine-tuning.
- No webhooks.
- No cron-style scheduling.
- No multi-tenant shared agent.
- No outbound notifications.
- No new Core primitives.
- No LinkedIn-shaped domain.
- No LLM vendor selection (separate governance decision; not made in v0).
- No general Agent Runtime — this spec is the first concrete slice.

---

*Subordinate to [Spec 009](./spec.md), the [Constitution](../../memory/constitution.md), and the [Technical Principles](../../memory/technical-principles.md). The first agent — small, bounded, auditable, human-approved, platform-agnostic, no LLM dependency.*