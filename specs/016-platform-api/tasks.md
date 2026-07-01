# Tasks — Platform API

**Status:** Draft (planning; build not authorized) · **activation 2/6 cleared (gate #1 spec ratified in #115; gate #2 ADR-010 accepted in #116) · 4 gates remaining**
**Derives from:** [Spec 016 v1.0.0](./spec.md) (Ratified) + [Plan 016 v1.0.0](./plan.md) (Ratified) + [ADR-010](../../governance/decisions/ADR-010-platform-api-driving-adapter.md) (Accepted)
**Conforms to:** [Conventions](../../tools/theia/CONVENTIONS.md), [Technical Principles](../../memory/technical-principles.md)
**Version:** 0.3.0
**Last updated:** 2026-07-01

> Draft — Spec 016 is Ratified (gate #1 cleared in #115) and ADR-010 is now Accepted (gate #2 cleared in #116, this PR). Four gates remain: Spec 009 HTTP wiring (gate #3), CLI use case registry enumerated (gate #4), first consumer named (gate #6), and module `registerApi` opt-in implementation follow-up (gate #5 — signature locked by Q5 in #115). Tasks will be populated when the remaining activation criteria in spec.md §13 are met. Until then, T-01…T-N may not begin per the spec's binding language.
>
> This `tasks.md` exists in canonical Draft form so the Spec 015 linter passes and Theia reports the spec correctly (0 / 0 tasks, Draft status) while planning continues.

---

## 1. Reality check

- **v0 status: planning.** No code yet.
- **Activation gates per spec.md §13** (all required before T-01 begins):
  1. Spec 016 ratified by stewards. ✅ Cleared (#115).
  2. [ADR-010](../../governance/decisions/ADR-010-platform-api-driving-adapter.md) (or equivalent) accepted — authorizes the deviation from the "Public API" item in the Technical Principles §"Avoid for now" list. ✅ Cleared (#116, this PR).
  3. Policy Engine (Spec 009) can evaluate HTTP-shaped request contexts; AC-13 ("policy unavailable → 503") is green. ⏳ Tracked in follow-up PR.
  4. CLI use case registry enumerated (the set of `case "..."` entries in `apps/cli/src/index.ts`); AC-12 baseline exists. ⏳ Tracked in follow-up PR.
  5. `registerApi(router, ctx) → void` hook signature locked (Q5 resolution). ✅ Q5 resolution in spec §11 locks the signature; implementation follow-up tracks module opt-in.
  6. First consumer named (a Cloud Run job, an agent, a CI workflow, or an integration) — v0 does not build speculatively. ⏳ Tracked in follow-up PR.

---

## 2. v0 build — Draft

*(none yet — see Spec 016 spec.md §4 for the v0 route table, §7 for the binding
constraints, §8 for the 13 acceptance criteria that will become the T-NN task
source, and §13 for the activation gates above. The first task to land will
be T-01 — likely `apps/api/` scaffolding — once all six gates clear.)*
