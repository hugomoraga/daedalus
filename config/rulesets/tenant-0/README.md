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