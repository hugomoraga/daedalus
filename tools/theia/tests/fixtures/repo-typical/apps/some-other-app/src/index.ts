// Fixture placeholder for Theia parser tests (BUG-001).
//
// `tools/theia/tests/fixtures/repo-typical/apps/some-other-app/`
// exists so that `parseCodeInventory` finds ≥3 apps in the fixture
// (the AC-6 assertion: `apps.length >= 3`). The parser only walks
// top-level entries of `apps/` / `packages/` / `tests/`; the contents
// of this stub are not consumed by any test.

export {};