# config/policies/tenant-0

This directory holds Tenant 0's policy bundles as JSON files (Spec 009).
**No real policies in this repo.** Per Spec 009 conformance:

- Every JSON file under `config/policies/` must parse.
- Every policy must carry a `provenance` with `sourceKind`, `sourceId`,
  `retrievedAt`, and `verifiedBy`.
- Every policy must declare a `version` (semver).
- Rule shape: see `packages/core/src/domain/policy/policy.ts` +
  `tests/policy-engine.test.ts` for examples.

When the founder adds a policy, they place a file like:

```
config/policies/tenant-0/<policyId>@<version>.json
```

The `verifiedBy` field is PII (the human identity vouching for the policy).
**Do not commit real values.** Use `process.env.TENANT_0_VERIFIED_BY` at
composition time (mirror of the Spec 008 env-var pattern, Plan §4.1).

The engine reads `rulesUri` from the `PolicyRef` passed to `evaluateAndRecordPolicy`;
the default `FilesystemPolicyStore` resolves `<baseDir>/<rulesUri>`. For
tenant-0 policies, point `rulesUri` at a path under
`config/policies/tenant-0/<policyId>@<version>.json`.

See Plan 009 §5 + §7 for the lint script
(`scripts/check-policies-have-provenance.mjs`) that enforces this contract.