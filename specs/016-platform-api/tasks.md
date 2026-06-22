# Tasks — Platform API

**Status:** Draft (planning; build not authorized)
**Derives from:** [Spec 016](./spec.md) + [Plan 016](./plan.md)
**Conforms to:** [Conventions](../../tools/theia/CONVENTIONS.md), [Technical Principles](../../memory/technical-principles.md)
**Version:** 0.1.0
**Last updated:** 2026-06-22

> Draft — Spec 016 is in Draft, the parallel ADR-009 has not been ratified, and the
> Policy Engine (Spec 009) is not yet wired to evaluate HTTP requests. Build is not
> authorized. Tasks will be populated when the activation criteria in spec.md §13
> are met (spec ratification, parallel ADR, Policy Engine ready, CLI use case
> registry enumerated, `registerApi` hook signature locked, first consumer named).
>
> This `tasks.md` exists in canonical Draft form so the Spec 015 linter passes and
> Theia reports the spec correctly (0 / 0 tasks, Draft status) while planning
> continues.

---

## 1. Reality check

- **v0 status: planning.** No code yet.
- **Activation gates per spec.md §13** (all required before T-01 begins):
  1. Spec 016 ratified by stewards.
  2. ADR-009 (or equivalent) accepted — authorizes the deviation from the
     "Public API" item in the Technical Principles §"Avoid for now" list.
  3. Policy Engine (Spec 009) can evaluate HTTP-shaped request contexts; AC-13
     ("policy unavailable → 503") is green.
  4. CLI use case registry enumerated (the set of `case "..."` entries in
     `apps/cli/src/index.ts`); AC-12 baseline exists.
  5. `registerApi(router, ctx) → void` hook signature locked (Q5 resolution).
  6. First consumer named (a Cloud Run job, an agent, a CI workflow, or an
     integration) — v0 does not build speculatively.

---

## 2. v0 build — Draft

*(none yet — see Spec 016 spec.md §4 for the v0 route table, §7 for the binding
constraints, §8 for the 13 acceptance criteria that will become the T-NN task
source, and §13 for the activation gates above. The first task to land will
be T-01 — likely `apps/api/` scaffolding — once all six gates clear.)*
