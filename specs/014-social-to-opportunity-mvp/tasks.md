# Tasks — Inbound Discovery Agent (MVP)

**Status:** Planning (build **not authorized**). Activates only when [Spec 009](./spec.md) is ratified AND an ADR moves the agent into the [Roadmap](../../docs/roadmap.md) Phase 4 slot AND the Workflow Engine (Spec 008) is shipped AND explicit-human-approval mode is in effect.
**Derives from:** Spec 009 v0.2.0 + Plan 009 v0.2.0
**Conforms to:** [Conventions](../../tools/theia/CONVENTIONS.md), [Technical Principles](../../memory/technical-principles.md), [ADR-002](../../governance/decisions/ADR-002-adopt-technical-framework.md), [ADR-003](../../governance/decisions/ADR-003-modular-monorepo.md), [ADR-004](../../governance/decisions/ADR-004-export-discipline-and-lineage.md), Spec 003, Spec 007, Spec 008.
**Version:** 0.3.0
**Last updated:** 2026-06-22

> The `/tasks` step for the Inbound Discovery Agent MVP. Tasks map 1:1 to Spec 009 acceptance criteria and Plan 009 build steps. v0 is forward-planning; activation is gated on the five activation criteria in `spec.md` §13.

> **Revision note (v0.3.0).** Migrated to canonical format per [Spec 015](../015-spec-file-convention/spec.md). Content preserved verbatim; `| ⏸ |` cells become `- [ ]` checkboxes; `| ⛔ |` cells (follow-on blocked tasks) also become `- [ ]` with the blocker recorded inline. ID prefixes preserved: `OF-*` for the offering module, `IA-*` for the agent.

---

## 1. Reality check (verified, not assumed)

- **v0 status: planning.** No code yet. Neither `packages/offering/` nor `packages/inbound-agent/` exists. The MVP is gated on (a) Spec 009 ratification, (b) an ADR, (c) Workflow Engine shipping (Spec 008), (d) explicit-human-approval mode, (e) founder confirmation.
- **Existing capabilities the MVP consumes:**
  - `@daedalus/core` — events, use cases, lineage helpers (Spec 006).
  - `@daedalus/opportunity-discovery` — `surfaceOpportunityUseCase` (Spec 003).
  - `@daedalus/workflow-engine` (Spec 008) — the engine that runs `inbound-agent-run.v0.1.0`.
- **Existing capabilities the MVP defers to:**
  - Phase 3 (Policy engine) — wired as a no-op seam in v0; activates later.
  - Phase 5 (multi-tenant operations, auth, SSE) — channel tokens live in tenant config with no auth in v0.

---

## 2. `@daedalus/offering` module — v0 build

These tasks ship the new module that owns Offering, Signal, Match, and the matcher.

- [ ] OF-01: `packages/offering/` scaffolding: directory, `package.json` with **no** `dependencies`, `README.md` (AC-13) (pending)
- [ ] OF-02: `domain/offering.ts` — Offering type (read-only) (AC-1, AC-13) (pending)
- [ ] OF-03: `domain/signal.ts` — Signal type (read-only) (AC-4) (pending)
- [ ] OF-04: `domain/match.ts` — Match type (read-only) (AC-4) (pending)
- [ ] OF-05: `adapters/json-schema-validator.ts` — JSON Schema for `offering.json` (AC-1) (pending)
- [ ] OF-06: `application/validate-offering.ts` — `validateOffering(jsonString): Offering | ValidationError` (AC-1) (pending)
- [ ] OF-07: `application/match-signal.ts` — `matchSignalAgainstOffering(Signal, Offering): Match | null` (deterministic, keyword-based, no LLM) (AC-4) (pending)
- [ ] OF-08: `application/deps.ts` — `OfferingDeps` (pending)
- [ ] OF-09: `cli.ts` — `offering:validate`, `offering:show` (AC-1) (pending)
- [ ] OF-10: Tests for the matcher (keyword scoring, negative keyword veto, threshold mapping) (AC-4) (pending)
- [ ] OF-11: Tests for the validator (well-formed, malformed, missing fields) (AC-1) (pending)
- [ ] OF-12: Public contract test (only the documented exports are reachable; ADR-004) (AC-13) (pending)

---

## 3. `packages/inbound-agent/` — v0 build

These tasks ship the agent that orchestrates runs.

- [ ] IA-01: `packages/inbound-agent/` scaffolding: directory, `package.json` with **no** `dependencies`, `README.md` (AC-11) (pending)
- [ ] IA-02: `domain/channel.ts` — Channel type (with `kind` discriminator); tenant-scoped; re-exports Signal and Match from `@daedalus/offering` (AC-2, AC-12, AC-13) (pending)
- [ ] IA-03: `domain/candidate.ts` — Candidate type (projection; no first-class aggregate; derived from event replay) (AC-5, AC-6) (pending)
- [ ] IA-04: `domain/run.ts` — AgentRun (workflow instance metadata) (AC-3) (pending)
- [ ] IA-05: `application/ports/channel-adapter.ts` — ChannelAdapter interface (read, OAuth refresh, summary) (AC-2) (pending)
- [ ] IA-06: `application/ports/llm-port.ts` — `LLMPort` interface (declared but no concrete adapter wired in v0) (AC-14) (pending)
- [ ] IA-07: `application/run.ts` — AgentRun lifecycle (workflow instance under `inbound-agent-run.v0.1.0`) (AC-3) (pending)
- [ ] IA-08: `application/deps.ts` — `InboundAgentDeps` (AC-3) (pending)
- [ ] IA-09: `adapters/channels/linkedin-channel-adapter.ts` — the **only** file in the agent that mentions "linkedin" (AC-12) (AC-2, AC-12) (pending)
- [ ] IA-10: `adapters/channels/linkedin-oauth-adapter.ts` — LinkedIn OAuth flow (AC-2) (pending)
- [ ] IA-11: `adapters/tenant-secrets.ts` — loads `channel-credentials.json` (gitignored) (R3) (pending)
- [ ] IA-12: `adapters/run-log.ts` — writes `.data/tenants/<t>/inbound-agent-runs.jsonl` (gitignored) (AC-10) (pending)
- [ ] IA-13: `cli.ts` — entry: `agent:connect`, `agent:disconnect`, `agent:run`, `agent:promote`, `agent:dismiss`, `agent:status` (AC-2, AC-3, AC-5, AC-6) (pending)
- [ ] IA-14: `apps/cli/src/index.ts` — wire the six agent commands (AC-2, AC-3, AC-5, AC-6) (pending)
- [ ] IA-15: `blueprints/workflows/inbound-agent-run.v0.1.0.json` — workflow artifact (Conceptual shape in Plan 009 §3) (AC-3, AC-8) (pending)
- [ ] IA-16: `config/tenants/tenant-0/offering.json` — sample offering for Tenant 0 (committed; validated by `@daedalus/offering`) (AC-1) (pending)
- [ ] IA-17: `config/tenants/tenant-0/channels.json` — public channel descriptor (no secrets) (AC-2) (pending)
- [ ] IA-18: `.gitignore` — add `config/tenants/**/channel-credentials.json` (R3) (pending)
- [ ] IA-19: `tests/agent-offering.test.ts` — AC-1 (refuses to run without offering) (AC-1) (pending)
- [ ] IA-20: `tests/agent-channel.test.ts` — AC-2 (mocked OAuth; Channel connect/disconnect events) (AC-2) (pending)
- [ ] IA-21: `tests/agent-run.test.ts` — AC-3 (full lifecycle: ready → polling → ... → awaiting_human) (AC-3) (pending)
- [ ] IA-22: `tests/agent-matching.test.ts` — AC-4 (signal with relevant keyword → CandidateSurfaced) (AC-4) (pending)
- [ ] IA-23: `tests/agent-triage-promote.test.ts` — AC-5 (CandidatePromoted → OpportunitySurfaced via Spec 003) (AC-5) (pending)
- [ ] IA-24: `tests/agent-triage-dismiss.test.ts` — AC-6 (CandidateDismissed records reason; no Opportunity) (AC-6) (pending)
- [ ] IA-25: `tests/agent-no-write-paths.test.ts` — AC-7 (greps for forbidden value-chain events / forbidden use cases) (AC-7) (pending)
- [ ] IA-26: `tests/agent-bounded.test.ts` — AC-8 (timeout → AgentRunFailed; no privilege escalation; memory bounded) (AC-8) (pending)
- [ ] IA-27: `tests/agent-tenant-isolation.test.ts` — AC-9 (two tenants' runs read only their own data) (AC-9) (pending)
- [ ] IA-28: `tests/agent-audit.test.ts` — AC-10 (replay reconstructs run state) (AC-10) (pending)
- [ ] IA-29: `tests/agent-zero-core-change.test.ts` — AC-11 (greps `packages/core/src` for forbidden new exports / new events) (AC-11) (pending)
- [ ] IA-30: `tests/agent-domain-agnostic.test.ts` — AC-12 (greps `packages/inbound-agent/src/domain/` for platform names) (AC-12) (pending)
- [ ] IA-31: `tests/agent-no-llm-adapter.test.ts` — AC-14 (verifies no concrete LLM adapter is wired; only the interface is declared) (AC-14) (pending)
- [ ] IA-32: Evidence run: end-to-end manual run + promote + dismiss against Tenant 0 seed; verify Opportunity flow (AC-3, AC-5, AC-6) (pending)

---

## 4. Phase 4 follow-on — BLOCKED (after v0 ships)

- [ ] IA-33: Multi-channel support (email, RSS, webhooks) via new ChannelAdapters — v0 shipped + per-channel ADR (blocked)
- [ ] IA-34: Outbound agent actions (DMs, comments, posts) under Policy engine — Phase 3 (Policy engine) (blocked)
- [ ] IA-35: Agent memory that learns from dismissals (with explicit opt-in) — v0 shipped + ADR (blocked)
- [ ] IA-36: LLM-backed matching under `LLMPort` (vendor chosen separately) — v0 shipped + LLM ADR (blocked)
- [ ] IA-37: Webhooks (vs polling) — v0 shipped + platform cooperation (blocked)
- [ ] IA-38: Cron-style scheduling + notifications — Phase 5 (blocked)
- [ ] IA-39: ATLAS panel `inbound-runs` (read-only per-tenant view of agent activity) — v0 shipped (blocked)

---

## 5. Cross-module follow-on — BLOCKED (uses `@daedalus/offering`)

- [ ] OF-13: Spec 003 v1 — use `@daedalus/offering` to qualify surfaced opportunities against the offering — Spec 003 v1 ratification (blocked)
- [ ] OF-14: Spec 002 v1 — use `@daedalus/offering` to align draft proposals with the offering — Spec 002 v1 ratification (blocked)
- [ ] OF-15: Future "offering alignment" use case (evaluate a draft proposal against the offering) — v0 shipped + ADR (blocked)
- [ ] OF-16: Future "offering drift" use case (surface when the offering drifts from the actual portfolio) — v0 shipped + ADR (blocked)

---

## 6. Out of scope (binding — from Spec 009 §9, §14)

- No multi-channel support (LinkedIn only).
- No outbound actions.
- No agent memory that learns.
- No LLM dependency (the seam exists; no adapter wired in v0).
- No model fine-tuning.
- No webhooks.
- No cron-style scheduling.
- No multi-tenant shared agent.
- No outbound notifications.
- No new Core events, aggregates, projections, or ports.
- No LinkedIn-shaped domain.
- No LLM vendor selection.

---

## 7. Module impact (forward-compatibility note)

- **Core**: zero changes (Spec 009 AC-11).
- **NEW `@daedalus/offering`**: introduced by this spec. Owned by the Core/Module layer (peer to `@daedalus/revenue-visibility`).
- **Opportunity Discovery (Spec 003)**: zero changes in this PR. Future Spec 003 v1 imports from `@daedalus/offering`.
- **Workflow Engine (Spec 008)**: zero changes in this PR. The agent adds a workflow artifact (`inbound-agent-run.v0.1.0.json`); the engine reads it.
- **ATLAS**: zero changes in this PR. The agent's events show up in ATLAS's existing `/events` and `/activity` panels. A new `inbound-runs` panel is a follow-on.
- **CLI**: + 6 commands. No other commands change.

---

## 8. Activation criteria

T-* may begin only when **all** of the following are true:

1. **Spec 009 is ratified** by stewards.
2. **An ADR moves the Inbound Discovery Agent into the Roadmap** as the first Phase 4 milestone AND proposes the introduction of `@daedalus/offering` as a new module.
3. **Workflow Engine (Spec 008) is shipped.**
4. **One of:** Policy Engine (Phase 3) shipped **OR** explicit human approval configured per action.
5. **The founder (Tenant 0) confirms** the LinkedIn-only scope, the offering schema, and the explicit-human-approval mode.

---

*Subordinate to [Spec 009](./spec.md) and [Plan 009](./plan.md). Planning only — not a build authorization.*