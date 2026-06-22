# Spec 013 — Atlas Demo Seeder

**Status:** Draft · Tooling · not a platform capability
**Type:** Development tool · idempotent JSONL seeder for `tenant-demo`
**Owner:** Stewards
**Version:** 0.1.0
**Last updated:** 2026-06-22

> **Scope.** This is dev tooling, like [Theia (Spec 012)](../012-theia/spec.md). It is not on the [Roadmap](../../docs/roadmap.md) and ships no new platform capability. It populates a **dedicated, isolated** tenant with realistic events so Atlas panels render with content during development. It never touches `tenant-0` (the founder's real data).

> **Naming.** "Seeder" (database sense): a one-shot, idempotent generator that fills an empty store with a fixed scenario. Not a faker (no randomness at runtime), not a migration (no schema change).

---

## 1. Summary

A single CLI command:

```bash
node tools/atlas-seeder/src/cli.ts seed --tenant tenant-demo
```

…clears `.data/tenants/tenant-demo/` and writes a deterministic, audit-grade JSONL event stream for the `tenant-demo` tenant. After it runs, the founder can start Atlas:

```bash
node apps/atlas/src/cli.ts serve --port 8788
# → open http://127.0.0.1:8788/t/tenant-demo/welcome
```

…and every Atlas panel renders with realistic content (welcome, activity, throughput, compliance, monitoring, workflow, queue, logs, health, events).

---

## 2. Why this exists

Atlas is a read-only mission control (ADR-005). It reads projections from `.data/tenants/<id>/events.jsonl`. To **see** Atlas with realistic features, the founder needs realistic events. Today the only tenant with events is `tenant-0` (production) and `tenant-other` (synthetic, used by isolation tests — sparse, not narrative). Both are wrong:

- **`tenant-0`** is the founder's real professional activity (Constitution, Tenant 0). Mixing demo data with real data violates *Auditability by Default* (Principle 4) and *Tenant Isolation* (Principle 6) — a steward's reading of `tenant-0` must never have to ask "is this real or demo?"
- **`tenant-other`** exists for cross-tenant isolation tests. Adding a rich narrative pollutes its test fixture contract.

A third tenant — `tenant-demo` — gives Atlas content without touching either.

---

## 3. Design decisions

### 3.1 New tenant: `tenant-demo`

Constitution Principle 6 (*Tenant Isolation*) requires isolation by design. A new tenant is added to the registry:

- `config/tenants/tenant-demo.ts` — `TenantConfig` with `id: "tenant-demo"`, CLP, all currently-active modules enabled (so Atlas can show every feature). No PII, no env-driven secrets (this is a dev fixture, not a real tenant).
- `config/tenants/index.ts` — register `tenant-demo` in the registry.
- `apps/atlas/src/tenant.ts` — add to `KNOWN_TENANT_IDS` so Atlas's tenant resolver accepts it.

The Atlas URL `…/t/tenant-demo/welcome` already works once the registry knows the tenant.

### 3.2 Live in `tools/` (per ADR-007)

Theia precedent (`tools/theia/`, ADR-007): dev tooling lives under `tools/`, peers to `apps/` and `packages/`. Seeder follows the same pattern: `tools/atlas-seeder/` with its own `src/cli.ts` and `src/seed.ts`. Never imported by `@daedalus/*` packages. Never executed by Atlas runtime. Workspace entry added to root `package.json` so it shares `node_modules/` symlinks.

### 3.3 Deterministic, idempotent

The seeder is **deterministic** (same input → same JSONL) and **idempotent** (re-running clears then writes):

- All UUIDs derived from a single seed string via a small derivation function (`sha256(seed + counter)`). The seed is `"atlas-demo-2026-06-22"` (commit day) — recorded at the top of `seed.ts`.
- `occurredAt` is computed as `now() - N days` where N is a fixed offset per scenario event. No `Math.random()`, no `new Date()` drift.
- Re-running the CLI deletes `.data/tenants/tenant-demo/` and rewrites the file from scratch. A `--keep` flag is **not** shipped (YAGNI).

This makes the output stable enough to snapshot in tests and to compare across runs (replay-integrity).

### 3.4 Scenario: one full value-chain engagement + Revenue Visibility activity

The narrative covers **everything Atlas can render**:

| # | Event | Why |
|---|---|---|
| 1 | `LeadCreated` | Welcome / Events / Activity |
| 2 | `LeadQualified` | Activity / Throughput |
| 3 | `ProposalGenerated` | Activity |
| 4 | `ProposalSubmitted` | Activity |
| 5 | `ProposalApproved` | Activity / Workflow |
| 6 | `ProjectCreated` | Activity / Workflow / Active Processes |
| 7 | `ProjectDelivered` | Activity / Throughput |
| 8 | `InvoiceIssued` | Revenue Visibility / Compliance |
| 9 | `InvoiceSent` | Activity |
| 10 | `PaymentReceived` | Revenue Visibility / Throughput |
| 11 | `InvoicePaid` | Activity / Throughput |
| 12 | `ProjectClosed` | Activity / Workflow |
| 13 | `RevenueEstimateCreated` | Revenue Visibility (forecast) |
| 14 | `RevenueConfirmed` | Revenue Visibility |
| 15 | `ExpenseRegistered` (×2) | Revenue Visibility / Risk panel |
| 16 | `FinancialRiskFlagged` (`revenue_concentration`) | Compliance / Risk |
| 17 | `LeadCreated` (a second one, discarded) | Diversity — Activity / Throughput |
| 18 | `LeadDiscarded` | Activity / Throughput |

That's 18 events across ~10 calendar days (one engagement + forecast updates + expenses + a dropped lead). Each event is a real `DomainEvent` per `packages/core/src/domain/event.ts` with `causationId`/`correlationId` populated correctly (`startLineage()` at the flow origin; `followFrom()` for derived events like `RevenueEstimateCreated` ← `ProposalGenerated`).

The events use **only types already in [docs/event-catalog.md](../../docs/event-catalog.md)** — no new event types are introduced by this spec.

### 3.5 Uses Core's domain types, not a parallel vocabulary

The seeder **imports `@daedalus/core`** and constructs `DomainEvent` values using its types (`packages/core/src/domain/event.ts`). It does not emit hand-rolled JSON. This guarantees the seeded stream is structurally identical to what the real CLI would produce (modulo realistic payload values), so Atlas projections, replay-integrity, and tenant-isolation tests all see it as legitimate.

### 3.6 CLI surface (minimal)

```
node tools/atlas-seeder/src/cli.ts seed --tenant <id>   # default: tenant-demo
node tools/atlas-seeder/src/cli.ts check               # dry-run: validate scenario, don't write
node tools/atlas-seeder/src/cli.ts --help
```

No flags besides `--tenant`. No `--count`, `--from`, `--until`. YAGNI.

### 3.7 Tenant data isolation contract

`.data/tenants/tenant-demo/events.jsonl` is **gitignored** (per AGENTS.md "Never commit .data/"). The seeder must refuse to operate on any tenant whose id appears in a static allowlist of "real" tenants (`tenant-0`); `tenant-other` is allowed because it is already synthetic.

---

## 4. Non-goals (binding)

- **No new event types.** The catalog is canon; this spec uses only what's there.
- **No mutation of `tenant-0` or `tenant-other`.** Hard refusal at the CLI level (see §3.7).
- **No real tenant data, no PII, no real money amounts.** Payload amounts are realistic-shaped numbers (`1_250_000` CLP) but obviously placeholder.
- **No fixture persistence in git.** `.data/` is gitignored.
- **No GUI, no Atlas integration.** Atlas doesn't know the seeder exists; it just reads JSONL.
- **No multi-tenant seeding in one run.** One CLI invocation = one tenant.
- **No CI integration in this spec.** If CI wants demo data later, it can call the CLI; that's a follow-up.
- **No editing of existing events.** Seeded or not, events are append-only.

---

## 5. Relation to canon

| Reference | How this spec relates |
|---|---|
| **Constitution P6 (Tenant Isolation)** | `tenant-demo` is a fully isolated tenant with its own JSONL, registry entry, and module config. The seeder refuses to write into `tenant-0`. |
| **Constitution P4 (Auditability by Default)** | Seeded events carry full lineage (`eventId`, `causationId`, `correlationId`). Deterministic ids make audit trail reproducible. |
| **Constitution P9 (Simplicity First)** | One CLI command, one scenario, one tenant. No randomization engine, no time-travel knobs, no plugin system. |
| **ADR-007 (Theia as `tools/`)** | Same pattern: dev tooling under `tools/`, never imported by platform code. |
| **ADR-005 (Atlas read-only)** | Atlas is unaware of the seeder; the seeder writes JSONL, Atlas reads it. No coupling. |
| **Technical Principles §Export discipline** | `tools/atlas-seeder/` has no `@daedalus/*` entry of its own. It depends on `@daedalus/core` (read types) and `@daedalus/jsonl-event-store` (write adapter). No barrel pollution. |
| **docs/event-catalog.md** | The seeder emits **only events from the catalog** — no new vocabulary. |
| **AGENTS.md "Never commit .data/"** | Seeded JSONL is gitignored. CI never reads or writes it. |

---

## 6. Acceptance criteria

1. `node tools/atlas-seeder/src/cli.ts seed` (with no args) seeds `tenant-demo` and writes `.data/tenants/tenant-demo/events.jsonl`.
2. Running the command a second time produces a **byte-identical** file (deterministic).
3. The seeded stream contains ≥ 15 events covering: at least one full Lead → ProjectClosed arc, at least one `ProposalApproved` → `RevenueEstimateCreated` (`followFrom()` lineage), at least one `FinancialRiskFlagged`, and at least one `LeadDiscarded`.
4. The CLI refuses to seed `--tenant tenant-0` with exit code 4 and a clear message.
5. After seeding, `node apps/atlas/src/cli.ts serve` and visiting `/t/tenant-demo/welcome` renders the Welcome panel with `eventCount > 0`, `lastEventAt` non-null, and `lastEventType` non-null.
6. `node apps/atlas/src/cli.ts check` still passes (panel manifest + token linter unaffected).
7. `npm test` stays green — including any new tests in `tools/atlas-seeder/tests/`.

---

*Subordinate to the [Constitution](../../memory/constitution.md), [Technical Principles](../../memory/technical-principles.md), and [ADR-007](./../governance/decisions/ADR-007-theia-as-tools-directory.md).*
