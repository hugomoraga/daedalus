# Tasks — Athena (Founder's Working Surface)

**Status:** Draft (planning; build not authorized)
**Derives from:** [Spec 017](./spec.md) + [Plan 017](./plan.md)
**Conforms to:** [Conventions](../../tools/theia/CONVENTIONS.md), [Technical Principles](../../memory/technical-principles.md)
**Version:** 0.1.0
**Last updated:** 2026-06-22

> Draft — Spec 017 is in Draft, the parallel ADR-011 has not been ratified, and the
> Platform API (Spec 016) is not yet built. Build is not authorized. Tasks will be
> populated when the activation criteria in spec.md §13 are met (spec ratification,
> parallel ADR-011, Platform API reachable, use cases exposed via `registerApi`,
> role-triage logic defined, first tenant configured).
>
> This `tasks.md` exists in canonical Draft form so the Spec 015 linter passes and
> Theia reports the spec correctly (0 / 0 tasks, Draft status) while planning
> continues.

---

## 1. Reality check

- **v0 status: planning.** No code yet.
- **Activation gates per spec.md §13** (all required before T-01 begins):
  1. Spec 017 ratified by stewards.
  2. ADR-011 (or equivalent) accepted — authorizes the deviation from the
     "Web UI" item in the Technical Principles §"Avoid for now" list. Third
     named exception (after ADR-005 for Atlas read-only, ADR-010 for the
     Platform API).
  3. Platform API (Spec 016) built and reachable — Phase A (read paths)
     and Phase B (write paths) green.
  4. The use cases Athena needs are exposed via `registerApi` in the API.
  5. Role-triage logic defined — projections carry role tags; the role
     taxonomy (admin, operator, boss, developer) is locked.
  6. First tenant configured end-to-end — modules enabled, agents/channels/
     pipelines stubbed, seed of events such that every Athena panel has
     data to render (or renders the empty/absent state explicitly).

---

## 2. v0 build — Draft

*(none yet — see Spec 017 spec.md §4 for the v0 read/write surface shaped by
Athena's needs, §5 for the domain concepts (role, triage item, decision,
delegation), §7 for the binding interaction constraints, §8 for the 12
acceptance criteria that will become the T-NN task source, and §13 for the
six activation gates above. The first task to land will be T-01 — likely
`apps/athena/` scaffolding — once all six gates clear.)*
