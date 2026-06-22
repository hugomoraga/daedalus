# Tasks — Opportunity Discovery

**Status:** Draft (planning; build not authorized)
**Derives from:** [Spec 003](./spec.md) + [Plan 003](./plan.md)
**Conforms to:** [Conventions](../../tools/theia/CONVENTIONS.md), [Technical Principles](../../memory/technical-principles.md), [ADR-002](../../governance/decisions/ADR-002-adopt-technical-framework.md), [ADR-003](../../governance/decisions/ADR-003-modular-monorepo.md), [ADR-004](../../governance/decisions/ADR-004-export-discipline-and-lineage.md)
**Version:** 0.1.0
**Last updated:** 2026-06-22

> The `/tasks` step for Opportunity Discovery. Migrated to the canonical format per [Spec 015](../015-spec-file-convention/spec.md). No code exists yet (`packages/opportunity-discovery/` does not exist). Spec is `Draft`; tasks.md is intentionally an empty checklist — allowed under the Draft-status exception in the conventions linter.

---

## 1. Reality check (verified, not assumed)

- **v0 status: planning.** No code yet. `packages/opportunity-discovery/` does not exist. The module is gated on spec ratification + ADR + founder (Tenant 0) confirmation of the v0 surface.
- **Backing infrastructure exists.** `@daedalus/core` (use cases + events + lineage) is in place (Spec 006, ADR-004). The module consumes them; it adds nothing new to Core.
- **The lead → opportunity path is observable.** Tenant 0's seed data flows through the Core value chain; `surfaceOpportunityUseCase` would qualify a `LeadQualified` event into an `OpportunitySurfaced` projection.
- **Blockers:** Spec 003 ratification + ADR + founder confirmation. See Spec 003 spec.md §13 for the full activation gate.

---

## 2. v0 build — Draft

Tasks scoped per Spec 003 acceptance criteria and Plan 003 build steps. None started.

*(none yet — see Spec 003 spec.md §6 for the candidate task list)*

---

## 3. Out of scope (binding — from Spec 003 §9)

- No LLM-assisted lead scoring in v0 (the seam exists; no adapter wired).
- No CRM sync (Salesforce, HubSpot, Pipedrive, etc.).
- No enrichment pipeline (Clearbit, Apollo, etc.).
- No multi-tenant shared opportunity discovery.
- No notifications, no email integration, no Slack alerts.
- No UI / API / visual pipeline.
- No additions to Core events or aggregates.

---

## 4. Module impact (forward-compatibility note)

- **Core**: zero changes (Spec 003 AC). The module consumes existing events.
- **Revenue Visibility**: zero changes in v0.
- **Proposal Generation**: zero changes in v0; future v1 imports `@daedalus/opportunity-discovery`'s qualified-lead summary.
- **ATLAS**: zero changes in v0; future v1 panel (qualified leads summary) is a follow-on.

---

*Subordinate to [Spec 003](./spec.md) and [Plan 003](./plan.md). Planning only — not a build authorization.*