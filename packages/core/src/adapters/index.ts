// Adapters subpath barrel — concrete adapters for Core ports.
// Composition roots (CLI, engines, tests) import from here.
// @daedalus/core exports these via the `./adapters` subpath (ADR-004).

export { InMemoryJurisdictionAdapter } from "./jurisdiction/in-memory-jurisdiction.ts";
export { FilesystemRuleSetLoaderAdapter } from "./jurisdiction/filesystem-rule-set-loader.ts";
export { InMemoryPolicyStore } from "./policy/in-memory-policy-store.ts";
export { FilesystemPolicyStore } from "./policy/filesystem-policy-store.ts";