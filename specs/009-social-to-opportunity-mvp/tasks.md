# Tasks — Social-to-Opportunity Agent (MVP)

**Status:** Planning (build **not authorized**). Activates only when [Spec 009](./spec.md) is ratified AND an ADR moves the agent into the [Roadmap](../../docs/roadmap.md) Phase 4 slot AND the Workflow Engine (Spec 008) is shipped AND explicit-human-approval mode is in effect.
**Derives from:** Spec 009 + Plan 009
**Conforms to:** [Technical Principles](../../memory/technical-principles.md), [ADR-002](../../governance/decisions/ADR-002-adopt-technical-framework.md), [ADR-003](../../governance/decisions/ADR-003-modular-monorepo.md), [ADR-004](../../governance/decisions/ADR-004-export-discipline-and-lineage.md), Spec 003, Spec 007, Spec 008.
**Version:** 0.1.0
**Last updated:** 2026-06-21

> The `/tasks` step for the Social-to-Opportunity Agent MVP. Tasks map 1:1 to Spec 009 acceptance criteria and Plan 009 build steps. v0 is forward-planning; activation is gated on the five activation criteria in `spec.md` §12.

---

## 1. Reality check (verified, not assumed)

- **v0 status: planning.** No code yet. `packages/social-agent/` does not exist. The MVP is gated on (a) Spec 009 ratification, (b) an ADR, (c) Workflow Engine shipping (Spec 008), (d) explicit-human-approval mode, (e) founder confirmation.
- **Existing capabilities the MVP consumes:**
  - `@daedalus/core` — events, use cases, lineage helpers (Spec 006).
  - `@daedalus/opportunity-discovery` — `surfaceOpportunityUseCase` (Spec 003).
  - `@daedalus/workflow-engine` (Spec 008) — the engine that runs `social-agent-run.v0.1.0`.
- **Existing capabilities the MVP defers to:**
  - Phase 3 (Policy engine) — wired as a no-op seam in v0; activates later.
  - Phase 5 (multi-tenant operations, auth, SSE) — channel tokens live in tenant config with no auth in v0.

---

## 2. v0 build — NOT STARTED

Each task maps to a Spec 009 AC and a Plan 009 build step.

| ID | Task | Spec AC | Status |
|---|---|---|---|
| T-01 | `packages/social-agent/` scaffolding: directory, `package.json` with **no** `dependencies`, `README.md` | AC-11 | ⏸ |
| T-02 | `domain/offering.ts` — Tenant Offering type + JSON Schema + validator | AC-1 | ⏸ |
| T-03 | `domain/channel.ts`, `domain/signal.ts`, `domain/match.ts`, `domain/candidate.ts` — read-only types | AC-2, AC-3, AC-4 | ⏸ |
| T-04 | `application/offering-matcher.ts` — pure keyword-based matcher (signal + offering → Match or null) | AC-4 | ⏸ |
| T-05 | `application/llm-port.ts` — `LLMPort` interface (no concrete adapter required for v0.1.0; LLM is optional summarization) | — | ⏸ |
| T-06 | `application/channels/linkedin-port.ts` — `LinkedinChannelPort` interface | AC-2 | ⏸ |
| T-07 | `application/run.ts` — AgentRun lifecycle (workflow instance under `social-agent-run.v0.1.0`) | AC-3, AC-4, AC-5, AC-6 | ⏸ |
| T-08 | `application/deps.ts` — `AgentDeps`: `EventStorePort` + `LinkedinChannelPort` + matcher + clock + id | AC-3 | ⏸ |
| T-09 | `adapters/llm/` — one concrete `LLMAdapter` (vendor choice governed separately; the MVP ships the interface) | — | ⏸ |
| T-10 | `adapters/channels/linkedin-oauth-adapter.ts` — OAuth flow for `agent:connect` | AC-2 | ⏸ |
| T-11 | `adapters/channels/linkedin-read-adapter.ts` — fetches signals via official LinkedIn API (posts, DMs, profile matches) | AC-3, AC-4, R1 | ⏸ |
| T-12 | `adapters/tenant-secrets.ts` — loads `social-credentials.json` (gitignored) | R3 | ⏸ |
| T-13 | `adapters/run-log.ts` — writes `.data/tenants/<t>/social-agent-runs.jsonl` (gitignored) | AC-10 | ⏸ |
| T-14 | `cli.ts` — entry point: `agent:connect`, `agent:disconnect`, `agent:run`, `agent:accept`, `agent:reject`, `agent:status` | AC-2, AC-3, AC-5, AC-6 | ⏸ |
| T-15 | `apps/cli/src/index.ts` — wire the six agent commands | AC-2, AC-3, AC-5, AC-6 | ⏸ |
| T-16 | `blueprints/workflows/social-agent-run.v0.1.0.json` — workflow artifact (Conceptual shape in Plan 009 §3) | AC-3, AC-8 | ⏸ |
| T-17 | `config/tenants/tenant-0/offering.json` — sample offering for Tenant 0 (committed) | AC-1 | ⏸ |
| T-18 | `config/tenants/tenant-0/social-channels.json` — public channel descriptor (no secrets) | AC-2 | ⏸ |
| T-19 | `.gitignore` — add `config/tenants/**/social-credentials.json` | R3 | ⏸ |
| T-20 | `tests/agent-offering.test.ts` — AC-1 (refuses to run without offering; validates schema) | AC-1 | ⏸ |
| T-21 | `tests/agent-channel.test.ts` — AC-2 (mocked OAuth; channel connect/disconnect events) | AC-2 | ⏸ |
| T-22 | `tests/agent-run.test.ts` — AC-3 (full lifecycle: ready → polling → ... → awaiting_human) | AC-3 | ⏸ |
| T-23 | `tests/agent-matching.test.ts` — AC-4 (signal with relevant keyword → CandidateSurfaced) | AC-4 | ⏸ |
| T-24 | `tests/agent-triage-accept.test.ts` — AC-5 (CandidateAccepted → OpportunitySurfaced via Spec 003) | AC-5 | ⏸ |
| T-25 | `tests/agent-triage-reject.test.ts` — AC-6 (CandidateRejected records reason; no Opportunity) | AC-6 | ⏸ |
| T-26 | `tests/agent-no-write-paths.test.ts` — AC-7 (greps for forbidden value-chain events / forbidden use cases) | AC-7 | ⏸ |
| T-27 | `tests/agent-bounded.test.ts` — AC-8 (timeout → AgentRunFailed; no privilege escalation; memory bounded) | AC-8 | ⏸ |
| T-28 | `tests/agent-tenant-isolation.test.ts` — AC-9 (two tenants' runs read only their own data) | AC-9 | ⏸ |
| T-29 | `tests/agent-audit.test.ts` — AC-10 (replay reconstructs run state) | AC-10 | ⏸ |
| T-30 | `tests/agent-zero-core-change.test.ts` — AC-11 (greps `packages/core/src` for forbidden new exports / new events) | AC-11 | ⏸ |
| T-31 | Evidence run: end-to-end manual run + accept + reject against Tenant 0 seed; verify Opportunity flow | AC-3, AC-5, AC-6 | ⏸ |

---

## 3. Phase 4 follow-on — BLOCKED (after v0 ships)

| ID | Task | Blocked by | Status |
|---|---|---|---|
| T-32 | Multi-platform support (X, Instagram, Mastodon, etc.) | v0 shipped + per-platform ADR | ⛔ |
| T-33 | Outbound agent actions (DMs, comments, posts) under Policy engine | Phase 3 (Policy engine) | ⛔ |
| T-34 | Agent memory that learns from rejections (with explicit opt-in) | v0 shipped + ADR | ⛔ |
| T-35 | Webhooks (vs polling) | v0 shipped + platform cooperation | ⛔ |
| T-36 | Cron-style scheduling + notifications | Phase 5 | ⛔ |
| T-37 | ATLAS panel `agent-runs` (read-only per-tenant view of agent activity) | v0 shipped | ⛔ |
| T-38 | Spec 003 v1 (Discovery vs Engagement boundary resolution) — feeds the agent's downstream decisions | Spec 003 ratification | ⛔ |

---

## 4. Out of scope (binding — from Spec 009 §9, §13)

- No multi-platform support (LinkedIn only).
- No outbound actions.
- No agent memory that learns.
- No model fine-tuning.
- No webhooks.
- No cron-style scheduling.
- No multi-tenant shared agent.
- No outbound notifications.
- No new Core events, aggregates, projections, or ports.
- No LLM vendor selection (separate governance decision).

---

## 5. Module impact (forward-compatibility note)

- **Core**: zero changes (Spec 009 AC-11).
- **Opportunity Discovery (Spec 003)**: zero changes. The agent calls the existing `surfaceOpportunityUseCase`. The open boundary (Discovery vs Engagement) is resolved by Spec 003 v1 (a separate spec).
- **Workflow Engine (Spec 008)**: zero changes in the agent's PR. The agent adds a workflow artifact (`social-agent-run.v0.1.0.json`); the engine reads it. The engine's `requiresHuman: true` mechanism is what enforces the MVP's human-approval mode.
- **ATLAS**: zero changes in this PR. The agent's events show up in ATLAS's existing `/events` and `/activity` panels. A new `agent-runs` panel is a Phase 4 follow-on (T-37).
- **CLI**: + 6 commands. No other commands change.

---

## 6. Activation criteria

T-01…T-31 may begin only when **all** of the following are true:

1. **Spec 009 is ratified** by stewards.
2. **An ADR moves the Social-to-Opportunity Agent into the Roadmap** as the first Phase 4 milestone.
3. **Workflow Engine (Spec 008) is shipped.**
4. **One of:** Policy Engine (Phase 3) is shipped **OR** explicit human approval is configured per action (the v0 fallback).
5. **The founder (Tenant 0) confirms** the LinkedIn-only scope, the offering schema, and the explicit-human-approval mode.

---

*Subordinate to [Spec 009](./spec.md) and [Plan 009](./plan.md). Planning only — not a build authorization.*