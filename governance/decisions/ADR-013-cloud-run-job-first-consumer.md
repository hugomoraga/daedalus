# ADR-013 — Name the first Platform API consumer as a Cloud Run job (daily financial snapshot)

**Status:** Accepted
**Date:** 2026-07-01 (drafted 2026-07-01 alongside Spec 016 §13 gate #6 close in PR #119)
**Deciders:** Stewards
**Trigger:** [Spec 016 §13 gate #6](../../specs/016-platform-api/spec.md) — "The first consumer is named. A concrete first caller (a Cloud Run job, an agent, a CI workflow, an integration) is identified, so the v0 surface has a real demand signal. v0 should not be built speculatively." Now that #115 (spec ratified), #116 (ADR-010 accepted), #117 (CLI registry enumerated), and #118 (gate #4 formal close) have all landed, the fifth activation gate — *which consumer is the first one* — is the remaining named-decision before T-01 may begin. This ADR closes it.
**Related:** [Constitution](../../memory/constitution.md), [Technical Principles](../../memory/technical-principles.md), [Identity](../../docs/identity.md), [Roadmap](../../docs/roadmap.md), [ADR-002](./ADR-002-adopt-technical-framework.md), [ADR-003](./ADR-003-modular-monorepo.md), [ADR-004](./ADR-004-export-discipline-and-lineage.md), [ADR-005](./ADR-005-atlas-driving-adapter.md) (parallels — read-only driving adapter), [ADR-010](./ADR-010-platform-api-driving-adapter.md) (parallels — programmatic driving adapter), [Spec 001](../../specs/001-revenue-visibility/spec.md) (Revenue Visibility — the consumer's most-read surface), [Spec 009](../../specs/009-policy-engine/spec.md) (Policy Engine — the consumer's write-authorization surface), [Spec 016](../../specs/016-platform-api/spec.md)

---

## Context

[ADR-010](./ADR-010-platform-api-driving-adapter.md) authorized the Platform API as a named exception to the Technical Principles §"Avoid for now" list's "Public API" item, parallel to how ADR-005 authorized ATLAS. ADR-010's §Decision 10 explicitly *does not* name the first consumer — it requires only that one be named before T-01 begins, per Spec 016 §13 gate #6.

The motivation is sharp: "v0 does not build speculatively" (Spec 016 §13 gate #6). Building the API without a named consumer is exactly the kind of work the Canon discourages — building capabilities before their demand signal is real. The first consumer is the *proof of demand* that justifies the API's first commit.

The candidates the Spec 016 plan enumerates ([Plan 016 §3 P6](../../specs/016-platform-api/plan.md)) are: a Cloud Run job, an agent (post-Phase 4), a CI workflow, or a third-party integration. We choose the **Cloud Run job** for the reasons in §Decision below.

The specific shape of the first job — *what it does day-to-day* — is fixed by the same Canon-disciplined choice: pick the smallest job that exercises the broadest slice of the API. Tenant 0 runs on Daedalus; the founder's daily routine begins with "what did yesterday look like?" That routine is a **daily financial snapshot for tenant-0**: read the live `FinancialSummary` projection for tenant-0 at midnight UTC, write a `RevenueSnapshotGenerated` event carrying that summary, and emit a `FinancialRiskFlagged` event for any newly-raised alert rule. Three actions in one cron:

1. **Read** `GET /v1/tenants/tenant-0/projections/financial-summary` — exercises the projections read path (Phase A).
2. **Read** `GET /v1/tenants/tenant-0/events?type=RevenueRiskFlagged&since=<yesterday>` — exercises the events read path with filtering (Phase A).
3. **Write** `POST /v1/tenants/tenant-0/commands/revenue/snapshot` — exercises the write path, which routes through `evaluateAndRecordPolicy` (Spec 009) and emits a `RevenueSnapshotGenerated` DomainEvent (Phase B).

That sequence is, by construction, the smallest cron that exercises **reads + writes + policy + tenant scoping + idempotency + lineage headers + OpenAPI-discoverability**. If Phase A ships read paths and Phase B ships write paths gated on the Policy Engine (Spec 009 being able to evaluate API requests, gate #3), this cron is the user-facing integration test.

---

## Decision

1. **The first Platform API consumer is a single Cloud Run job, scheduled by Cloud Scheduler, running once per day at 00:00 UTC, scoped to tenant-0.** It is named **`daily-financial-snapshot-job`** for deployment / observability purposes.

2. **What the job does (read phase, then write phase):**

   a. **Read phase** — `GET /v1/tenants/tenant-0/projections/financial-summary` (returns the live `FinancialSummary` shape from [Spec 001 §5](../../specs/001-revenue-visibility/spec.md)). Expects `200 { … shape }`. Failure mode: `404` (projection not registered) → log and exit 0; `503` (readiness failed) → retry with backoff; any other status → log and exit non-zero.

   b. **Read phase (risk surface only)** — `GET /v1/tenants/tenant-0/events?type=FinancialRiskFlagged&since=<utc-24h>&limit=50`. Expects `200 { events: […] }`. Logs the count without acting. Failure mode: same as above.

   c. **Write phase** — `POST /v1/tenants/tenant-0/commands/revenue/snapshot` with body `{ "payload": {} }` (the snapshot use case takes no payload — it reads the live summary itself; the API is just the dispatcher). Headers:
      - `Authorization: Bearer <api-key>` — provisioned via the env config from [Spec 016 §5 Q10](../../specs/016-platform-api/spec.md) (`DAEDALUS_API_KEYS_FILE` per tenant, or per-tenant env var).
      - `Idempotency-Key: <uuid>` — the job generates a fresh UUID per run and persists it across retries (Cloud Run retried invocations see the same env-set idempotency key) so a retry does not double-snapshot.
      - `X-Causation-Id: <uuid>` — generated fresh per run by the job, exposed as a `causationId` on the resulting `RevenueSnapshotGenerated` event.
      - `X-Correlation-Id: <uuid>` — generated fresh per run, becomes the `correlationId` for the entire snapshot flow.

   d. **On any 4xx/5xx** during step c, the job exits non-zero so Cloud Scheduler records the failure and emits its normal alerting metric; the next day's invocation is a separate run with a fresh idempotency key. (Per [Spec 016 §7 AC-9](../../specs/016-platform-api/spec.md#8-acceptance-criteria), the v0 idempotency store is per-instance — a Cloud Run retry on the same instance reuses the key; a Cron-triggered re-run on a new instance gets a fresh key. Both behaviors are by design; both are documented here for the operator.)

3. **What the job is NOT** (binding for v0):

   - The job is **read-only on Daily Risk Events**. It does not write events for risk-flagging in v0; it only logs newly-raised `FinancialRiskFlagged` events for the audit trail. Writing risk decisions is a follow-on ADR if ever needed — this job's only write is the snapshot.
   - The job is **not the only consumer.** It is the *first*; future jobs (e.g. nightly invoice-aging, weekly health-check, monthly retention calculation) are named by their own ADRs as they are added.
   - The job is **not a Cloud Run service**. It is a Cloud Run **job** (one-shot, scheduled) per [Spec 016 §2](../../specs/016-platform-api/spec.md) calling out "Cloud Run jobs and services" as a target. The platform's other potential Cloud Run *service* surface (an always-on HTTP listener) is `apps/api/` itself (which is the API, not a consumer).
   - The job does **not** introduce any infra dependency that the Platform API doesn't already require. Cloud Run + Cloud Scheduler + a service account with the per-tenant API key are standard, called out by [Spec 016 §1](../../specs/016-platform-api/spec.md) ("Designed for 12-factor / Cloud Run (stateless, env-based config, `/healthz` + `/readyz`)").
   - The job is **not speculative.** It is named here, now, as the *activation* of v0, with a concrete read+write surface that we can verify the API against.

4. **Cloud Run job configuration (informative, for the operator):**

   ```yaml
   # deploy/daily-financial-snapshot-job/job.yaml (declarative; out of band)
   apiVersion: run.googleapis.com/v1
   kind: Job
   metadata:
     name: daily-financial-snapshot-job
   spec:
     template:
       spec:
         template:
           spec:
             containers:
             - image: gcr.io/<project>/daedalus-job-runner:latest
               env:
               - name: DAEDALUS_API_BASE_URL
                 value: https://daedalus-api-…run.app
               - name: DAEDALUS_API_TENANT_ID
                 value: tenant-0
               - name: DAEDALUS_API_KEYS_FILE
                 value: /secrets/api-keys.json
               - name: DAEDALUS_JOB_RUN_ID
                 valueFrom: { fieldRef: { fieldPath: metadata.uid } }
               # Provisioned by the operator, not committed.
             restartPolicy: Never
             serviceAccountName: daedalus-snapshot-runner@…
   # Triggered once per day at 00:00 UTC by a Cloud Scheduler job
   # `daily-financial-snapshot-trigger` that POSTs to the API / execute endpoint.
   ```

   The `daedalus-job-runner` image is a small container that ships **only the job's command logic** plus the SDK that talks to the Platform API. It does not embed the API server itself; it is a *consumer* of the API, parallel to how a CI runner is a consumer of the API. The runner source is not in this ADR's scope (it is a deploy artifact, not a canon decision).

---

## Consequences

**Positive**

- **Gates #3 and #6 of Spec 016 §13 become directly exercisable.** The job's read+write surface *is* the gate's evidence. Once the job is deployed and one daily invocation completes, gate #3 ("Policy Engine wired for HTTP") and gate #6 ("first consumer named") both have empirical support.
- **The job is the first End-to-End integration test in production.** Every prior spec (001, 002, 004, 008, 009, 011) was validated via `npm test`; this job is the first whose *production behavior* exercises multi-module interaction through a real adapter over the wire. Failure to call it (or call it correctly) surfaces immediately in Cloud Run logs.
- **Real founder value from day one.** A daily snapshot is the *single most useful artifact* the founder can look at — it freezes yesterday's numbers, anchors month-end, and is the substrate for any later retrospective (board reports, tax filings, auditor conversations). The Platform API's first user is a founder-facing artifact, not an internal-only smoke test.
- **The job exercises the read+write split that Spec 016's phase structure calls for.** Phase A (reads) is naturally exercised by steps 2a/2b. Phase B (writes gated on Spec 009) is naturally exercised by step 2c, *and the boundary is observable in the test* — a 503 from step 2c against an unfinished API is the AC-13 readiness signal.
- **The job is dependency-free at the canon level.** All dependencies (Cloud Run, Cloud Scheduler, per-tenant API key, project ID) are operator-provisioned, not committed to the repo. The repo carries the consumer's *contract* (this ADR + the Spec 016 AC trace), not its deploy.

**Negative / risks**

- **Cloud Run is a Canon deviation already covered by ADR-010.** This ADR doesn't re-open that exception; it relies on ADR-010's "Public API" retirement. If ADR-010 is ever reversed, this ADR's deployment assumptions need revisiting.
- **Daily-cadence snapshot is silent on months/years.** The job runs *daily*; longer-cadence rollups are a follow-on ADR (out of scope here).
- **Multi-tenant by accident, by design.** The job is *scoped to tenant-0*, not "all tenants". A future "snapshot every tenant nightly" is a separate job. The Spec 016 §9 binding non-goal "no cross-tenant operations" stays intact.
- **Cloud-Run retries interact with idempotency.** As called out in §Decision 2d: per-instance idempotency (Spec 016 §AC-9 caveat) means a same-instance retry uses the cached key (no double-snapshot), while a new-instance re-run gets a fresh key (which would double-snapshot). The latter case is acceptable for v0 because the snapshot's payload is `summaryAtEventTime` (the live summary at that instant) and two snapshots within the same day are not harmful — they are two frozen views of two instants. The path to globally-shared idempotency storage is explicitly a future spec (Spec 016 §7 risk R4).
- **The job depends on `apps/api/` being deployable** in the first place. Until that lands (post-gate #6), the job has nothing to call. Mitigated by the staged landing discipline — the job does not deploy until the API does, even though it is named here.

---

## What this ADR does NOT do

- Does **not** introduce any new Core event type, aggregate, projection, or port. It is purely a deployment *consumer*; it writes via the existing `revenue:snapshot` use case (Spec 001 §CLI), which already exists.
- Does **not** add CORS, OAuth, cookies, browser-facing surfaces, or any other Canon deviation beyond what ADR-010 authorized.
- Does **not** commit any deploy configuration. The Cloud Run job spec in §Decision 4 is *informative*; the deploy manifests live in the operator's environment, not in this repo.
- Does **not** change the Constitution, the Technical Principles, the Identity document, the Roadmap, or any ratified spec's intent.
- Does **not** retire any Canon item. It builds on ADR-010's "Public API" retirement, nothing else.
- Does **not** preclude future consumers. CI workflows, agents, and integrations remain valid candidates (Spec 016 plan §3 P6); this ADR names *the first*, not *the only*.

---

## Acceptance (gate for steward ratification)

This ADR moves Spec 016's gate #6 from ⏳ to ✅ when **all** of the following hold:

1. **Spec 016 is ratified.** ✅ Cleared in #115.
2. **ADR-010 is accepted.** ✅ Cleared in #116.
3. **The runnable artifact is named.** This ADR names it: **`daily-financial-snapshot-job`**. The container that runs the job (`daedalus-job-runner`) is an operator concern, not canon.
4. **The shape of the first read is concrete.** `GET /v1/tenants/tenant-0/projections/financial-summary` — the projection name is `financial-summary`, owned by the revenue-visibility module's `projectFinancialSummary` (Spec 001 v0).
5. **The shape of the second read is concrete.** `GET /v1/tenants/tenant-0/events?type=FinancialRiskFlagged&since=<utc-24h>` — the filter shape (per Spec 016 §4 row for the events endpoint) is `?type=` and `?since=`.
6. **The shape of the first write is concrete.** `POST /v1/tenants/tenant-0/commands/revenue/snapshot` (the CLI's `case "revenue:snapshot":` per Spec 001 v0+ Spec 016 Q3 `':' → '/'` slug transform). Headers as in §Decision 2c.

Once this ADR lands, Spec 016 §13 gate #6 is closed. The remaining open gate is **#3** ("Policy Engine (Spec 009) can evaluate API requests; AC-13 ready"), tracked as a separate PR.

---

## Companion change: Spec 016 activation-status update

This ADR ships together with the corresponding PR (#119):

- [Spec 016 §13 activation-status table](../../specs/016-platform-api/spec.md) — gate #6 status flips from ⏳ to ✅ Cleared by this ADR.
- [Spec 016 tasks.md](../../specs/016-platform-api/tasks.md) — header counter `4/6 → 5/6 cleared · 1 gate remaining` and §1 reality-check gate #6 line updated to ✅ Cleared (#119) with body referencing this ADR.

No other spec section changes.

---

*Subordinate to the [Constitution](../../memory/constitution.md), [Technical Principles](../../memory/technical-principles.md), and the parallel ADRs (#005 for ATLAS read-only UI, #010 for the Platform API itself). The Platform API's first consumer is a named, single-tenant, daily-cadence, Cloud-Run-job-driven snapshotted-finance workflow — the smallest realistic end-to-end exercise of the Platform API v0 surface that produces real founder value.*
