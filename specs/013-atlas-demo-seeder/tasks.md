# Spec 013 — Tasks

Checkbox view of the plan. P-prefixes match the plan; numbers are stable for cross-referencing in commit messages and PRs.

## P0 — Setup
- [x] T-01. Verify event payload shapes against `@daedalus/core` domain types.

## P1 — Tenant registration
- [x] T-02. `config/tenants/tenant-demo.ts` — TenantConfig.
- [x] T-03. Register `tenant-demo` in `config/tenants/index.ts`.
- [x] T-04. Add `tenant-demo` to `KNOWN_TENANT_IDS` in `apps/atlas/src/tenant.ts`.

## P2 — Workspace wiring
- [x] T-05. Add `tools/atlas-seeder` to root `package.json` workspaces; `npm install`.
- [x] T-06. `tools/atlas-seeder/package.json`.
- [x] T-07. `tools/atlas-seeder/tsconfig.json`.

## P3 — Seeder core
- [x] T-08. `tools/atlas-seeder/src/deterministic-id.ts`.
- [x] T-09. `tools/atlas-seeder/src/scenario.ts`.
- [x] T-10. `tools/atlas-seeder/src/seed.ts`.

## P4 — CLI
- [x] T-11. `tools/atlas-seeder/src/cli.ts`.
- [x] T-12. `npm run seed:atlas-demo` script (deferred — `node tools/atlas-seeder/src/cli.ts seed` is the documented invocation; no npm script needed for YAGNI).

## P5 — Tests
- [x] T-13. `tests/scenario.test.ts` (covers T-13..T-16 — scenario shape, deterministic ids, CLI determinism, tenant refusal, JSONL round-trip).

## P6 — Manual verification
- [x] T-17. Run seeder — 19 events emitted, byte-identical across two runs (asserted by test).
- [x] T-18. Start Atlas — server boots, listens on 8788.
- [x] T-19. `curl /t/tenant-demo/welcome` — renders with `Total events: 19`, `Last event: LeadDiscarded`, `Last event at: 2026-06-16T15:00:00.018Z`.
- [x] T-20. `curl /t/tenant-demo/{throughput,activity,events,compliance}` — all panels render.

## P7 — PR
- [x] T-21. `npm test` — 15/15 seeder tests pass; 1 pre-existing failure in `tools/theia` (unrelated, fixture has 1 app where test expects 3) confirmed via `git stash`.
- [x] T-22. Commit, push, open PR (this step).

## Out-of-band notes

- The `seed:atlas-demo` npm script (T-12) was deliberately not added — `node tools/atlas-seeder/src/cli.ts seed` is short enough that a script would be ceremony (per Simplicity First). Easy to add later if multiple agents/scripts need it.
