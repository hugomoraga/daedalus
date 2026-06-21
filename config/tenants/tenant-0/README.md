# Tenant 0 — workflow overrides

This directory holds Tenant 0's workflow overrides consumed by the
`JsonlWorkflowStoreAdapter` (see `packages/workflow-engine/src/adapters/jsonl-workflow-store.ts`).

`workflows.json` is **empty (`[]`)** by design in v0: Tenant 0 inherits every
default workflow from `blueprints/workflows/*.json` unchanged. Per Spec 008 §4
and Plan 008 §1, the engine merges defaults + tenant overrides with the
override winning on `(name, version)` collision. Tenant 0 has no overrides to
merge today.

A future tenant with a different process — e.g. a fixed-bid shop that closes
projects on `InvoicePaid` without a human gate — would add entries here:

```json
[
  {
    "name": "lead-to-payment",
    "version": "0.2.0",
    "...": "..."
  }
]
```

The file must be valid JSON (an array). Do not add comments — `JSON.parse` rejects them.