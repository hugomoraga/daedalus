# ATLAS — mission control

Read-only driving adapter over the Daedalus Core and active modules' projections. Per [Spec 007](../../specs/007-atlas-ui/spec.md) and [ADR-005](../../governance/decisions/ADR-005-atlas-driving-adapter.md).

> ATLAS does not write. Writes continue to flow through the CLI.

## Run

```
npm run atlas -- serve --port 8788 --tenant tenant-0
```

Then open `http://localhost:8788/t/tenant-0/welcome`.

## Routes (v0.1)

| Method | Route | Effect |
|---|---|---|
| `GET`  | `/t/<tenantId>/welcome` | Welcome panel — tenant summary + counts + last event |
| Other | any | `405` with the equivalent CLI command |

More panels land in subsequent slices: Events, Activity, Logs, System Health (v0.2–v0.4).

## Design tokens

All color, typography, and spacing live in [`src/tokens.ts`](./src/tokens.ts). A token-linter test enforces it (CI-blocking).

## Fonts

The canonical trio (`Inter Tight`, `Inter`, `JetBrains Mono`) is declared in CSS with system fallbacks. To use exact typography, drop WOFF2 files into [`assets/fonts/`](./assets/fonts/) — see the README there.

## Status

v0.1: scaffolding + tokens + layout + server + tenant resolver + Welcome panel.

Subsequent PRs add the remaining v0 panels (Events, Activity, Logs, Health) and the full test suite (AC-1..AC-8, panel manifest, token linter, tenant isolation).