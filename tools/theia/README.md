# Theia — read-only project-state visualizer (Spec 012, ADR-007)

Theia is a **development tool**, not a platform capability. It reads the repository's structured artifacts (specs, ADRs, code inventory, test results, diff summary, blocker graph) and renders a single-page overview for the founder + stewards. It is **not** on the [Roadmap](../docs/roadmap.md).

It lives in `tools/theia/` (a new top-level directory, authorized by [ADR-007](../governance/decisions/ADR-007-theia-as-tools-directory.md)) and is structurally separate from `apps/` and `packages/`.

## What it is

A **read-only**, locally-served visualizer that answers four questions at a glance:

1. **Where are we?** — Phase timeline (0–5) with the active phase highlighted.
2. **What's done?** — Per-spec card with status badge, completion bar, last-updated date, summary.
3. **What's blocked?** — Blockers section + next-unlocks ranking.
4. **What changed?** — Diff summary against `main` (branch + commits + file-level stats).

Plus ADRs (AC-5), code inventory (AC-6), CLI use cases (AC-7), and a Tests panel that shows `running…` while `node --test` runs in the background, then updates to the final counts without a server restart (AC-8).

## What it isn't

- It does not import from `@daedalus/*` packages (AC-15). The **single** allowed exception is `src/views/tokens.ts`, which re-exports from Atlas for visual cohesion. Atlas never depends on Theia.
- It does not run platform use cases.
- It does not write to the repo, emit events, or persist state.
- It does not connect to an LLM. (Future v2 may add a spec drafting assistant — out of scope here.)
- It does not provide authentication, multi-user, or multi-machine.

## How to run

```bash
npm run theia                  # prints help
npm run theia check            # parses the repo, prints summary
npm run theia serve            # starts HTTP server on http://127.0.0.1:8789
```

Options (both commands): `--port <n>`, `--host <h>` (rejected if `0.0.0.0` or `::`), `--root <path>`.
Env: `THEIA_PORT` overrides the default `8789`.

### HTTP routes

| Path | Method | Description |
|---|---|---|
| `/` | GET | Overview page (HTML) |
| `/specs/:slug` | GET | Per-spec detail (HTML) |
| `/healthz` | GET | JSON status (`{ status: "ok", tests: {...} }`) |
| any other | GET | 404 |
| any | non-GET | 405 |

## Visual language

Same tokens as [Atlas](../apps/atlas/src/tokens.ts). Theia re-uses Atlas's `pageStyles()`, color tokens, type tokens, and spacing scale (4, 8, 12, 16, 24, 32, 48, 64, 96) — no new design system. The token linter (`tools/theia/tests/token-linter.test.ts`) enforces the canonical scale and the absence of raw colors / non-trio fonts.

## Project state

| Item | Status |
|---|---|
| Spec 012 v1.0.1 | Ratified (governance PR #57). |
| ADR-007 | Accepted (new `tools/` top-level directory). |
| PR 1 | Scaffold + types + parser skeleton ✅ shipped (#59). |
| PR 2 | Specs + tasks parser + `repo-typical` fixture ✅ shipped (#62). |
| PR 3 | ADRs + roadmap phases parser ✅ shipped (#65). |
| PR 4 | Code inventory + CLI use cases parser ✅ shipped (#67). |
| PR 5 | Blocker graph + next-unlocks ranking ✅ shipped (#70). |
| PR 6 | Git diff runner ✅ shipped (#74). |
| PR 7 | npm test runner ✅ shipped (#76). |
| PR 8 | Server + views + Atlas token reuse + token linter + no-platform-imports test ✅ shipped (this PR). |

See [`../specs/012-theia/plan.md`](../specs/012-theia/plan.md) for the full build order and [`../specs/012-theia/tasks.md`](../specs/012-theia/tasks.md) for the per-task checklist.

## Notes

- **Zero external runtime dependencies.** `tools/theia/package.json` has `dependencies: {}`.
- **The `npm test` runner cannot be unit-tested inside a project test suite** (Node ≥ 22 detects nested `node --test` invocations and skips them). The runner is verified via `npm run theia check` from a user shell.
- **Visual reuse is one-way.** Atlas never depends on Theia. The re-export in `views/tokens.ts` is the only coupling.

## License + identity

Theia (Θεία) is the Titanide of the broad sight, sister of Helios. In the project's naming convention (Daedalus = the artisan, Atlas = the mission-control driving adapter), Theia is the developer-facing counterpart — Powered by Daedalus Platform, reading the *repo* while Atlas reads the *event stream*.