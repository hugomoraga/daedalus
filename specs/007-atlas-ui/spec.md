# Spec 007 — ATLAS (Mission Control driving adapter)

**Status:** Draft · Phase 0/1 transition (planning; not authorized to build)
**Type:** Driving adapter — **read-only** mission control over the Daedalus Core and modules
**Owner:** Stewards
**Version:** 0.1.0
**Last updated:** 2026-06-20

> **Method.** Spec-first (Constitution, Principle 8). Defines *what* ATLAS is and *why*, not *how*. Conceptual — no schema, no API, no UI markup, no assets in this file.

> **Context.** Daedalus's value chain `Lead → Payment` is closed in Core (Spec 006), three modules ship projections (Spec 001 v0+v1, Spec 002, Spec 003), and the event stream is auditable per tenant. What is missing is a **mission-control view**: a calm, editorial, multi-tenant surface that makes the chain, the events, and the system health visible to a human operator. ATLAS is that view. It is deliberately **not** a writing tool — writes continue to flow through the CLI until Phase 4.

> **Naming.** The visible product is **ATLAS** (mission control). The platform underneath is **Daedalus**. ATLAS is *Powered by Daedalus Platform*.

---

## 1. Summary

ATLAS is a **read-only driving adapter** parallel to `apps/cli/`. It consumes the projections and read-models the Core and modules already expose, and renders them as a multi-tenant mission-control surface. **No business logic lives in ATLAS.** No write paths. No auth beyond tenant selection. No external UI dependencies. No neon, no glassmorphism, no charts library — just paper, type, and structure.

The 11 candidate sections from the design brief are mapped to backing read-models in §3. Sections whose backing model does not exist **are not rendered** — they are absent, not empty (AC-6). Today ~6 of 11 are viable; the rest activate as Phase 2 / Phase 5 land their engines.

Visual identity is encoded as **design tokens**, not screenshots. Tokens are constants exported from `apps/atlas/src/tokens.ts` and linted in CI (AC-5). The brief's palette and typography trio (`Inter Tight`, `Inter`, `JetBrains Mono`) are canonical; ATLAS ships static font assets in `apps/atlas/assets/` (no npm/font-CDN).

---

## 2. Relation to the Daedalus canon

| Reference | How this spec relates |
|---|---|
| **[Constitution](../../memory/constitution.md)** | Obeys all ten principles. Key: *Generic Core, Specific Tenants* (ATLAS is tenant-agnostic in its Core; tenant-specific panels activate from the tenant profile); *Auditability by Default* (ATLAS is the operator's window onto the audit trail — it amplifies auditability, it does not replace it); *Simplicity First* (read-only, no framework, no charts library). |
| **[Technical Principles](../../memory/technical-principles.md)** | Respects hexagonal layering: ATLAS is a driving adapter; it reads Core projections through existing ports, never bypassing them. The "Web UI" item in the "Avoid for now" list is **conditionally retired by this spec** — but only for ATLAS as defined here, and only when the backing read-models exist (Simplicity First). |
| **[Identity](../../docs/identity.md)** | ATLAS sits in the **driving adapter** layer, parallel to the CLI. It is not a Module, not Core, not a Tenant. |
| **[Roadmap](../../docs/roadmap.md)** | The visual scope matches capability maturity: Phase 1 sections are live, Phase 2 sections activate with the workflow engine, Phase 5 sections activate with the agent runtime and the second tenant. ATLAS does **not** accelerate roadmap phases. |
| **[Event Catalog](../../docs/event-catalog.md)** | ATLAS consumes the 14 catalog events as the source of truth. Projections are derived views of that stream. |
| **Specs 001–006** | ATLAS consumes their projections. It does not define new aggregates, events, or projections of its own. |

---

## 3. Goals

1. **Make the value chain visible.** Render `Lead → Proposal → Approval → Project → Delivery → Invoice → Payment` per tenant, replayable from the event stream.
2. **Make the audit trail visible.** Every event with full lineage (`eventId`, `correlationId`, `causationId`, `actor`, `occurredAt`, `payload`) is browseable.
3. **Make the read-models visible.** `FinancialSummary`, expected/confirmed/received lifecycle, alerts, qualified leads, system health — without having to run CLI commands.
4. **Make the platform's multi-tenancy tangible.** Tenant switching is one click from the top nav; isolation is enforced on every read.
5. **Make the system honest.** ATLAS surfaces *what is actually there* — not aspirational sections. Sections without backing models are absent.
6. **Render without external dependencies.** No npm UI deps, no font CDNs, no charts libraries. Vanilla HTML + native CSS + Node 22 SSR.

---

## 4. Core / Module / Tenant split

| Layer | What lives there (this spec) |
|---|---|
| **Core** | No changes. ATLAS consumes existing `EventStorePort` and existing projections (`projectProposal`, `projectProject`, `projectInvoice`). |
| **Modules** | No changes required. Modules already expose their read models via their `application` barrels (e.g. `@daedalus/revenue-visibility` exposes `FinancialSummary`, alerts). |
| **Driving adapter — ATLAS** | `apps/atlas/` (NEW). Composition root. Zero domain. HTTP server (Node 22 native). SSR with embedded JSON-LD. Tokens, templates, panels. |
| **Tenant** | Tenant 0 profile names which modules are active for the tenant; ATLAS shows only panels whose module is active. No PII lives in ATLAS — it renders events and projections, which are themselves tenant-scoped by Core Policy. |

> **ATLAS does not invent new Core events, aggregates, projections, or ports.** If a panel needs data that isn't already projected, that panel waits — it is not built against a new projection.

---

## 5. Domain concepts (conceptual — no schema)

- **Read model.** A projection computed from the event stream. Examples: `projectProposal(events)`, `FinancialSummary`. Read models are tenant-scoped and recomputable from JSONL.
- **Panel.** A view that aggregates one or more read models for one tenant. Example: *Welcome* combines tenant metadata + event count + last activity. Panels are not stateful across requests.
- **Tenant context.** The tenant currently active in the session. ATLAS never queries across tenants. Switching tenants invalidates cache and reloads projections; the UI does not preserve cross-tenant state (AC-8).
- **Time window.** A `[from, to]` range applied to temporal read models (throughput, activity). Defaults are tenant-configurable per the tenant profile.
- **Backing model.** The read model that justifies a panel's existence. A panel without a backing model is **not rendered** (AC-6).
- **Engineering micro-label.** Small monospace metadata rendered alongside content (`NODE-07`, `SCL-26`, `ACTIVE`, `ONLINE`, `SYNC`, `HEALTHY`). These are formatting primitives, not domain concepts.

---

## 6. Events

**ATLAS emits no events.** It is a pure consumer of the event stream and projections.

If a user interaction in ATLAS looks like a write (e.g. clicking "Approve" on a Proposal), ATLAS **must** reject the interaction and surface the equivalent CLI command instead (AC-1).

---

## 7. Interaction constraints (binding)

- **Read-only by construction.** Every HTTP route handles only `GET` and `HEAD`. Any other method returns `405 Method Not Allowed` with a body that names the CLI command equivalent (AC-1).
- **Multi-tenant by default.** Every query carries `tenantId`. The tenant switcher is explicit and confirmed before projection reload (AC-2, AC-8).
- **Refresh is pull-based in v0.** Manual `sync` button + configurable polling interval. No SSE/WebSocket.
- **No offline.** No service worker, no localStorage persistence of read models. State is recomputed from JSONL on every load — consistent with "state is a projection of events."
- **No client-side state for domain data.** UI state (selected event, expanded row, tenant switcher value) is session-scoped at most, never persisted.
- **Static assets only.** Fonts, favicon, and SVG line illustrations live in `apps/atlas/assets/`. No CDN, no Google Fonts, no external fonts at runtime.

---

## 8. Acceptance criteria

**AC-1 (Read-only enforcement).**
- *Given* any route in ATLAS, *when* a non-`GET`/non-`HEAD` request arrives, *then* the server returns `405` with a JSON body `{ "error": "read-only", "cliCommand": "<the equivalent CLI command>" }`.
- *And* a test enumerates every route and verifies the rejection without performing the underlying action.

**AC-2 (Tenant isolation).**
- *Given* two tenants with overlapping identifiers, *when* ATLAS is queried with `tenantId=A`, *then* no response contains data derived from `tenantB` events. Fails closed: a missing tenant renders an explicit empty state, never another tenant's data.
- A dedicated test (`tests/atlas-tenant-isolation.test.ts`) exercises this against two seeded tenants.

**AC-3 (Replay integrity / System Health).**
- *Given* the JSONL log for a tenant, *when* the System Health panel runs, *then* it re-runs the principal projection over the full stream and shows (a) the projection's last computed state, (b) a fresh re-computation, (c) a SHA-256 hash of both results.
- *And* if the hashes diverge, the panel surfaces an alert and refuses to claim the projection is trustworthy.

**AC-4 (Zero external runtime dependencies).**
- *Given* ATLAS running, *when* a network capture is performed on the request lifecycle, *then* no requests leave the local network except those originating from the user's interaction.
- *And* the `package.json` of `apps/atlas` declares no `dependencies`. Fonts are static assets.

**AC-5 (Token discipline).**
- *Given* the codebase of `apps/atlas`, *when* the token-linter test runs in CI, *then* it fails if any source file (other than `tokens.ts` itself) contains a raw color literal, a raw font-family outside the trio, or a raw numeric spacing outside the scale.
- Tokens are exported from `apps/atlas/src/tokens.ts` as the only source of truth.

**AC-6 (Section viability).**
- *Given* the set of registered panels at startup, *when* a panel's backing model is not exposed by any active module, *then* the panel is **absent** from the UI — not rendered as empty, not rendered as "coming soon."
- *And* a manifest test enumerates every panel and confirms its backing model is registered.

**AC-7 (Performance).**
- *Given* a tenant JSONL of up to 10,000 events, *when* the Welcome panel is requested, *then* first-byte response occurs in under 2 seconds on the developer machine baseline.
- Projections are computed server-side once per request, not streamed to the browser.

**AC-8 (Tenant switch).**
- *Given* a session in `tenant-A`, *when* the operator switches to `tenant-B`, *then* all cached projections are discarded, the new projections are computed, and no UI state from `tenant-A` persists (selected event, expanded rows, time window — all reset).

---

## 9. Non-goals (binding)

- **No write paths.** No forms, no buttons that mutate state, no "approve here," no "send invoice here." Writes stay in CLI until Phase 4 (Agent Runtime); even then, agents are bounded executors under policy, not "UI buttons."
- **No authentication in v0.** Tenant is selected via URL path or header; real auth lands with Phase 5 (multi-tenant operations).
- **No real-time push.** Polling and manual sync only. SSE/WebSocket are deferred to Phase 5.
- **No internationalization.** English only.
- **No theming.** The palette in §10 is canonical; light/dark toggle is out of scope.
- **No mobile-first.** Desktop mission-control; responsive only down to tablet width.
- **No charts library.** All visualizations are hand-authored SVG using tokens. No D3, Chart.js, Recharts, etc.
- **No 3D, no animation ornament.** Transitions limited to subtle CSS-only state changes (≤ 120ms).
- **No glassmorphism, no neon, no gradients.** Per the design brief and per the Constitution's *Simplicity First*.
- **No new Core events, aggregates, projections, or ports.** ATLAS is a consumer.

---

## 10. Design tokens (canonical)

Exported from `apps/atlas/src/tokens.ts`. Imported by every other file in `apps/atlas/`.

### Color
| Token | Value | Use |
|---|---|---|
| `paper` | `#F7F5F2` | Warm paper white background |
| `card` | `#FBFAF8` | Soft white for raised surfaces |
| `ink` | `#111111` | Graphite typography |
| `neutral` | `#6A6A6A` | Secondary text, captions |
| `accent` | `#4A6FA5` | Technical blue — links, active states, micro-labels |
| `rule` | rgba(17,17,17,0.08) | Hairline borders |
| `ok` | `#3F6E4A` | Reserved for *HEALTHY* / *ONLINE* / *SYNC* indicators (muted, never neon) |
| `warn` | `#8A6A2E` | Reserved for *WARN* / *DEGRADED* |
| `alert` | `#8A3E3E` | Reserved for *ALERT* / *STALE* / *OFFLINE* |

> Color status tokens are intentionally desaturated. They appear as small micro-labels (`ONLINE`, `SYNC`, `HEALTHY`), never as fills.

### Typography
| Token | Family | Use |
|---|---|---|
| `display` | `Inter Tight` | Welcome headings, panel titles |
| `body` | `Inter` | Body copy, descriptions |
| `mono` | `JetBrains Mono` | Event IDs, micro-labels, coordinates, metadata |

### Spacing scale
`4, 8, 12, 16, 24, 32, 48, 64, 96` (px). No other values permitted.

### Border
Single token: `1px solid var(--rule)`. No double borders, no thick rules.

---

## 11. Risks

- **R1 — UI as a writing shortcut.** A click that "approves" a proposal would silently write, breaking the read-only contract. *Mitigation:* AC-1 (rejection + equivalent CLI command surfaced) and a dedicated test enumerating every route.
- **R2 — Tenant leakage in the read layer.** This is the most likely place for isolation to break (cross-tenant projections, shared caches). *Mitigation:* AC-2 + a dedicated tenant-isolation test against two seeded tenants.
- **R3 — Section stub inflation.** A panel without a backing model renders as a placeholder, polluting the UI and inviting premature work. *Mitigation:* AC-6 (absent, not empty).
- **R4 — Token drift.** A `#FFFFFF` or `#4A90E2` creeps in via a hotfix. *Mitigation:* AC-5 (token linter in CI).
- **R5 — Performance creep.** Loading 100k events into the browser kills responsiveness. *Mitigation:* AC-7 + projections computed server-side once per request; the browser never sees raw JSONL.
- **R6 — Mission control creep.** A future contributor adds animations, glassmorphism, or chart libraries chasing the design brief's hero aesthetic. *Mitigation:* non-goals §9 are binding; visual quality is judged in use, not in render. The Constitution's *Simplicity First* is the cultural guardrail.

---

## 12. Open questions

- **Q1 — SSR shape.** ATLAS reads JSONL server-side and serves HTML with embedded JSON-LD (proposed). Alternative: serve JSON and render client-side. *Resolution:* SSR with embedded JSON-LD. Aligned with zero-deps and AC-4.
- **Q2 — Multi-tenant in one session.** One tenant per session, with explicit switch (proposed). Alternative: multi-pane / multi-tenant view. *Resolution:* one tenant per session. Multi-tenant view is Phase 5.
- **Q3 — Sections without backing models.** Hide entirely (proposed, AC-6). Alternative: placeholder "coming in Phase X." *Resolution:* hidden. Honest surface beats aspirational placeholder.
- **Q4 — Print / PDF export of state.** Useful for founder review. *Resolution:* deferred. PDF adds complexity and is not mission-critical in Phase 0/1.
- **Q5 — Welcome panel composition.** What exactly fills the Welcome surface today? *Resolution:* tenant name + total events + last event timestamp + count of active proposals/projects/invoices + friction-test status. Defined in `plan.md` §3.

---

## 13. Out of scope (binding)

- Implementation is authorized **only** by an ADR that moves ATLAS into the [Roadmap](../../docs/roadmap.md) and an accompanying ratified `plan.md`.
- This spec does **not** authorize any new Core event, aggregate, projection, or port.
- This spec does **not** authorize a write path, authentication, real-time push, or any item in non-goals §9.
- Future enhancements (deferred): PDF export, dark theme, real-time SSE, multi-pane tenant view, advanced filters, saved queries, mobile-first.

---

## 14. Companion artifacts

- **`plan.md`** — implementation plan, structure of `apps/atlas/`, read-models consumed, build phases (v0, v1, Phase 2, Phase 5), evidence run, definition of done. **v1.0** marks v0 and v1 phases as shipped (PRs #18, #19); Phase 2 and Phase 5 phases remain blocked on their respective engines.
- **`tasks.md`** — task breakdown (T-01…T-26). **v1.0** marks T-01..T-19 as shipped (v0: T-01..T-16 in PR #18; v1: T-17..T-19 in PR #19); T-20..T-26 remain blocked on Phase 2 / Phase 5 engines.

---

*Subordinate to the [Constitution](../../memory/constitution.md), [Identity](../../docs/identity.md), [Technical Principles](../../memory/technical-principles.md), and the [Roadmap](../../docs/roadmap.md). A read-only driving adapter; nothing more.*