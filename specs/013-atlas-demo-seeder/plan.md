# Spec 013 — Plan

Sequence of work. Each task is small and independently verifiable. Tests after each step keep `npm test` green.

## P0 — Setup
- [ ] **T-01.** Verify the spec's tenant/event assumptions against actual `@daedalus/core` event types (open `packages/core/src/domain/*.ts` and confirm payload shapes for `LeadCreated`, `ProposalApproved`, `RevenueEstimateCreated`, `FinancialRiskFlagged`, etc.).

## P1 — Tenant registration
- [ ] **T-02.** Create `config/tenants/tenant-demo.ts` with a `TenantConfig` (`id: "tenant-demo"`, `currency: "CLP"`, all currently-active modules enabled, default thresholds). No PII, no env-driven secrets.
- [ ] **T-03.** Register `tenant-demo` in `config/tenants/index.ts`.
- [ ] **T-04.** Add `tenant-demo` to `KNOWN_TENANT_IDS` in `apps/atlas/src/tenant.ts`.

## P2 — Workspace wiring
- [ ] **T-05.** Add `tools/atlas-seeder` to `package.json` workspaces and run `npm install` (workspace symlinks re-resolve).
- [ ] **T-06.** Create `tools/atlas-seeder/package.json` (minimal: name, type=module, no deps — only re-export of `@daedalus/core` and `@daedalus/jsonl-event-store` via workspace).
- [ ] **T-07.** Create `tools/atlas-seeder/tsconfig.json` matching `tools/theia/tsconfig.json` (extends root).

## P3 — Seeder core
- [ ] **T-08.** Implement `tools/atlas-seeder/src/deterministic-id.ts` — a small helper that derives a stable UUID-shaped string from `sha256(seed || counter)`.
- [ ] **T-09.** Implement `tools/atlas-seeder/src/scenario.ts` — declares the 18 events (see spec §3.4) as plain data. Each event has: relative day offset, type, payload, and whether it starts/follows a correlation.
- [ ] **T-10.** Implement `tools/atlas-seeder/src/seed.ts` — turns the scenario into `DomainEvent[]` with full lineage (using `startLineage` / `followFrom` semantics from `packages/core/src/application/lineage.ts`) and the deterministic id helper.

## P4 — CLI
- [ ] **T-11.** Implement `tools/atlas-seeder/src/cli.ts`:
  - `seed [--tenant <id>]` — default `tenant-demo`. Refuses `tenant-0` (exit 4). Clears `.data/tenants/<id>/`, writes JSONL via `JsonlEventStoreAdapter`, prints summary (event count, byte size, last event type).
  - `check` — runs scenario generation without writing; prints the same summary.
  - `--help` / no command — usage.
- [ ] **T-12.** Add `tools/atlas-seeder` to root `package.json` `"scripts"` as `"seed:atlas-demo"` for ergonomics.

## P5 — Tests
- [ ] **T-13.** `tools/atlas-seeder/tests/scenario.test.ts` — scenario produces ≥ 15 events, includes all required event types per AC-3, includes at least one `followFrom()` lineage (`RevenueEstimateCreated` ← `ProposalApproved`).
- [ ] **T-14.** `tools/atlas-seeder/tests/deterministic.test.ts` — running `seed()` twice into two separate `mkdtemp` directories produces byte-identical files.
- [ ] **T-15.** `tools/atlas-seeder/tests/tenant-refusal.test.ts` — `seed --tenant tenant-0` exits 4 and does not write.
- [ ] **T-16.** `tools/atlas-seeder/tests/integration-atlas.test.ts` — seed `tenant-demo` into a temp dir, point Atlas's `setDataDir()` at it, call `computeWelcome()`, assert `eventCount > 0` and non-null `lastEventAt`/`lastEventType`.

## P6 — Manual verification
- [ ] **T-17.** Run `npm run seed:atlas-demo` → JSONL written.
- [ ] **T-18.** Run `node apps/atlas/src/cli.ts serve --port 8788` → Atlas starts.
- [ ] **T-19.** Curl `http://127.0.0.1:8788/t/tenant-demo/welcome` → confirm Welcome panel renders non-empty.
- [ ] **T-20.** Curl at least 3 other panels (`activity`, `throughput`, `compliance`) — confirm non-empty.

## P7 — PR
- [ ] **T-21.** `npm test` stays green.
- [ ] **T-22.** Commit, push, open PR with description covering: spec link, what was added, acceptance results, manual verification screenshots/text, follow-ups (if any).

---

## Sequencing notes

- P0 → P1 → P2 → P3 → P4 → P5 → P6 → P7. Strictly serial: each phase has dependencies on the previous.
- P3 tasks T-08 / T-09 / T-10 can be implemented in any order but tested in T-13 together.
- P5 is intentionally lightweight (`node --test`, no fixtures beyond `mkdtemp`) — per [ADR-008 §1](file is gitignored per worktree, so tests use temp dirs).
