# ATLAS — mission control

Read-only driving adapter over the Daedalus Core and active modules' projections. Per [Spec 007](../../specs/007-atlas-ui/spec.md) and [ADR-005](../../governance/decisions/ADR-005-atlas-driving-adapter.md).

> ATLAS does not write. Writes continue to flow through the CLI.

## Run

```
npm run atlas -- serve --port 8788 --tenant tenant-0
```

Then open `http://localhost:8788/t/tenant-0/welcome`.

## Routes (v0)

| Method | Route | Effect |
|---|---|---|
| `GET`  | `/t/<tenantId>/welcome` | Welcome panel — tenant summary + counts + last event |
| `GET`  | `/t/<tenantId>/events` | Events stream — raw events with lineage (corr / cause) |
| `GET`  | `/t/<tenantId>/activity` | Activity Timeline — events grouped by day |
| `GET`  | `/t/<tenantId>/logs` | Recent Logs — last 50 events, dense |
| `GET`  | `/t/<tenantId>/health` | System Health — event count, type distribution, SHA-256 replay integrity |
| Other | any | `405` with the equivalent CLI command |

Panels whose backing model doesn't exist (e.g. `throughput`, `monitoring`) return 404 (Spec 007 AC-6 — absent, not empty).

## Design tokens

All color, typography, and spacing live in [`src/tokens.ts`](./src/tokens.ts). A token-linter test enforces it (CI-blocking, AC-5).

## Fonts

The canonical trio (`Inter Tight`, `Inter`, `JetBrains Mono`) is declared in CSS with system fallbacks. To use exact typography, drop WOFF2 files into [`assets/fonts/`](./assets/fonts/) — see the README there.

## Status

**v0 complete** — all five v0 panels ship (Welcome, Events, Activity, Logs, System Health) plus the full AC test suite (AC-1 read-only, AC-2 tenant isolation, AC-3 replay integrity, AC-4 zero deps, AC-5 token linter, AC-6 panel manifest).

Next: ATLAS v1 (Throughput + Monitoring) gated on Revenue Visibility v1 stability. See `specs/007-atlas-ui/tasks.md`.