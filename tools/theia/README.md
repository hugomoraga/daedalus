# Theia — read-only project-state visualizer (Spec 012, ADR-007)

> **Stub.** PR 1 of 8. The package, types, parser skeleton, CLI stub,
> and parser tests are in place. The parser returns an empty
> `ProjectState` until later PRs fill it (PR 2–7). The HTTP server
> arrives in PR 8.

## What it is

A **development tool** for the founder + stewards. It reads the
repository's structured artifacts (specs, ADRs, code inventory, test
results, diff summary) and renders a single-page overview. It is
**not** a platform capability and is **not on the [Roadmap](../../docs/roadmap.md)**.

It lives in `tools/theia/` (a new top-level directory, authorized by
ADR-007) and is structurally separate from `apps/` and `packages/`.

## What it isn't

- It does not import from `@daedalus/*` packages (AC-15). The single
  exception is `src/views/tokens.ts`, which re-exports Atlas design
  tokens for visual cohesion.
- It does not run platform use cases.
- It does not write to the repo, emit events, or persist state.
- It does not connect to an LLM. (Future v2 may add a spec drafting
  assistant — out of scope here.)
- It does not provide authentication, multi-user, or multi-machine.

## How to run (stub)

```bash
npm run theia                  # prints help
npm run theia check            # parses the repo, prints summary (empty until PR 2+)
npm run theia serve            # stub; HTTP server wired in PR 8
```

Options: `--port <n>`, `--host <h>` (rejected if `0.0.0.0`), `--root <path>`.
Env: `THEIA_PORT` overrides the default `8789`.

## Project state

| Item | Status |
|---|---|
| Spec 012 | Ratified (governance PR #57). |
| ADR-007  | Accepted (new `tools/` top-level directory). |
| This PR  | Scaffold + types + parser skeleton (PR 1 of 8). |
| PR 2     | Specs + tasks parser. |
| PR 3     | ADRs + roadmap phases parser. |
| PR 4     | Code inventory + use-case parser. |
| PR 5     | Blocker graph + next-unlocks ranking. |
| PR 6     | Git diff runner. |
| PR 7     | npm test runner (async, with `running…` placeholder per AC-8). |
| PR 8     | HTTP server + views + Atlas visual-token reuse + token linter + no-platform-imports test (AC-11, AC-12, AC-15). |

See `../../specs/012-theia/plan.md` for the full build order and
`./tasks.md` for the per-task checklist.

## License + identity

Theia (Θεία) is the Titanide of the broad sight, sister of Helios. In
the project's naming convention (Daedalus = the artisan, Atlas = the
mission-control driving adapter, Theia = the developer-facing
counterpart), Theia is the **Powered by Daedalus Platform** sibling
that reads the *repo* while Atlas reads the *event stream*.
