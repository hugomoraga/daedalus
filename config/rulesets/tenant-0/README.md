# config/rulesets/tenant-0

This directory holds Tenant 0's rule-set content as JSON files (Spec 008).
**No real rules in this repo.** Per Spec 008 §7 Conformance:

- Every JSON file under `config/rulesets/` must parse.
- Every `obligation` must carry a `provenance`.
- Every `provenance` must have `verifiedBy`, `retrievedAt`, `sourceId`, and `sourceKind`.

When the founder adds a rule set, they place a file like:

```
config/rulesets/tenant-0/<ruleSetId>@<version>.json
```

with a shape matching `RuleSet` / `ObligationSpec` (see
`packages/core/src/domain/jurisdiction/rule-set.ts`).

The `verifiedBy` field is PII (the human identity vouching for the rules).
**Do not commit real values.** Read `verifiedBy` from `process.env` in
the future loader, or keep the rule file out of git until the founder
populates it locally.

See Plan 008 §4.1 + §6 for the lint script
(`scripts/check-rulesets-have-provenance.mjs`) that enforces this contract.

## Spec 004 — Tax & Compliance Guard

The Tax & Compliance Guard Module (`@daedalus/tax-compliance-guard`, Spec 004
v1.0) consumes rule sets from this directory. The Module is a **guard,
not an engine**: it watches financial events, matches them against
obligations declared here, computes deadlines, and emits the obligation
lifecycle (`ObligationDue` / `Met` / `Missed` / `EvaluationRecorded`).
No jurisdiction-specific content lives in the Module itself — what
counts as a tax obligation, with what deadline, lives in these JSON
files. The system **guards**; the human claims compliance (Spec 004 §13,
🚩 Compliance Flag).

The Module ships without a tenant-0 seed rule set; the founder adds the
first rule set following the Spec 010 §9 process (register via
`rules:register`, edit the JSON here, never invent a rule).
