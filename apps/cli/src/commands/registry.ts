// apps/cli/src/commands/registry.ts
//
// Single source of truth for the CLI command registry.
//
// This module re-exports the per-domain `handlers` arrays from
// each command file under `apps/cli/src/commands/*.ts` and exposes:
//
//   - CLI_HANDLERS   — a frozen Map<command-name, CommandHandler>
//                      consumed by `apps/cli/src/index.ts` (the runtime)
//   - CLI_COMMAND_NAMES — a frozen, sorted, readonly list of command names
//                         consumed by:
//                           * tests/registry.test.ts (canonical baseline)
//                           * the future apps/api/ (Spec 016 AC-12 parity
//                             test — the same list is what the API must
//                             expose via `registerApi`)
//
// Each per-command file (e.g. `lead.ts`, `proposal.ts`) keeps its own
// `export const handlers: Array<[string, CommandHandler]>`. That is
// deliberate: it keeps command grouping close to its use cases, and
// it keeps [Theia](../../../../tools/theia/src/parser/use-cases.ts)
// (Spec 012) able to derive the same set by parsing each file's
// `["name",` patterns. This registry is the *runtime* single source
// of truth; Theia's parser is the *static-analysis* single source of
// truth — they should match, but they catch each other's drift
// independently.
//
// Spec 016 (Platform API) §13 activation gate #4: "The CLI use case
// registry is enumerated … and a parity test baseline exists, so
// AC-12 has a known shape." This module is the enumerated registry
// and the test file in tests/registry.test.ts is the parity baseline.

import { handlers as leadHandlers } from "./lead.ts";
import { handlers as proposalHandlers } from "./proposal.ts";
import { handlers as proposalDraftHandlers } from "./proposal-draft.ts";
import { handlers as valueChainHandlers } from "./value-chain.ts";
import { handlers as opportunityHandlers } from "./opportunity.ts";
import { handlers as revenueHandlers } from "./revenue.ts";
import { handlers as workflowHandlers } from "./workflow.ts";
import { handlers as eventsHandlers } from "./events.ts";
import { handlers as rulesHandlers } from "./rules.ts";
import { handlers as obligationsHandlers } from "./obligations.ts";
import type { CommandHandler } from "./types.ts";

const ALL_HANDLERS: ReadonlyArray<readonly [string, CommandHandler]> = Object.freeze([
  ...leadHandlers,
  ...proposalHandlers,
  ...proposalDraftHandlers,
  ...valueChainHandlers,
  ...opportunityHandlers,
  ...revenueHandlers,
  ...workflowHandlers,
  ...eventsHandlers,
  ...rulesHandlers,
  ...obligationsHandlers,
]);

export const CLI_HANDLERS: ReadonlyMap<string, CommandHandler> = new Map(ALL_HANDLERS);

export const CLI_COMMAND_NAMES: readonly string[] = Object.freeze(
  [...CLI_HANDLERS.keys()].sort(),
);
