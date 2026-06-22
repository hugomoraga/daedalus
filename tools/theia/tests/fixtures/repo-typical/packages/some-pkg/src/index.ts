// Fixture placeholder for Theia parser tests (BUG-001).
//
// `tools/theia/tests/fixtures/repo-typical/packages/some-pkg/` exists
// so that `parseCodeInventory` finds ≥1 package in the fixture (the
// AC-6 assertion: `packages.length >= 1`). The parser only walks
// top-level entries of `packages/`; the contents of this stub are not
// consumed by any test.

export {};