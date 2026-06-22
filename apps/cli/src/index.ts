// Driving adapter: the CLI. Parses input -> looks up handler -> invokes use case -> renders.
// NO business logic lives here (Technical Principles: CLI is an adapter). Composition root:
// it wires concrete adapters to the ports. Each command lives in apps/cli/src/commands/.

import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";
import { JsonlEventStoreAdapter } from "@daedalus/jsonl-event-store";
import { JsonFileDraftStoreAdapter } from "@daedalus/proposal-generation/adapters";
import { TenantConfigThresholdsAdapter } from "@daedalus/revenue-visibility/adapters";
import { JsonOpportunityStoreAdapter } from "@daedalus/opportunity-discovery/adapters";
import { FilesystemPolicyStore, FilesystemRuleSetLoaderAdapter } from "@daedalus/core/adapters";
import { defaultTenantId } from "../../../config/tenants/index.ts";
import { renderHelp } from "./commands/help.ts";
import { handlers as leadHandlers } from "./commands/lead.ts";
import { handlers as proposalHandlers } from "./commands/proposal.ts";
import { handlers as proposalDraftHandlers } from "./commands/proposal-draft.ts";
import { handlers as valueChainHandlers } from "./commands/value-chain.ts";
import { handlers as opportunityHandlers } from "./commands/opportunity.ts";
import { handlers as revenueHandlers } from "./commands/revenue.ts";
import { handlers as workflowHandlers } from "./commands/workflow.ts";
import { handlers as eventsHandlers } from "./commands/events.ts";
import { handlers as rulesHandlers } from "./commands/rules.ts";
import { handlers as obligationsHandlers } from "./commands/obligations.ts";
import type { CommandHandler, Deps } from "./commands/types.ts";

const DATA_DIR = ".data";

function buildDeps(): Deps {
  return {
    eventStore: new JsonlEventStoreAdapter(DATA_DIR),
    draftStore: new JsonFileDraftStoreAdapter(DATA_DIR),
    opportunityStore: new JsonOpportunityStoreAdapter(DATA_DIR),
    thresholds: new TenantConfigThresholdsAdapter(),
    ruleSetLoader: new FilesystemRuleSetLoaderAdapter(DATA_DIR),
    policyStore: new FilesystemPolicyStore(DATA_DIR),
    newId: () => randomUUID(),
    now: () => new Date().toISOString(),
    actor: "cli",
  };
}

const HANDLERS = new Map<string, CommandHandler>(
  [
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
  ],
);

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      tenant: { type: "string" },
      customer: { type: "string" },
      lead: { type: "string" },
      draft: { type: "string" },
      template: { type: "string" },
      label: { type: "string" },
      amount: { type: "string" },
      text: { type: "string" },
      source: { type: "string" },
      opportunity: { type: "string" },
      description: { type: "string" },
      contact: { type: "string" },
      reason: { type: "string" },
      estimate: { type: "string" },
      proposal: { type: "string" },
      project: { type: "string" },
      invoice: { type: "string" },
      payment: { type: "string" },
      notes: { type: "string" },
      workflow: { type: "string" },
      instance: { type: "string" },
      ruleset: { type: "string" },
      file: { type: "string" },
      limit: { type: "string" },
      tail: { type: "boolean" },
      obligation: { type: "string" },
      "due-event": { type: "string" },
      watch: { type: "boolean" },
    },
  });

  const command = positionals[0];
  const tenantId = values.tenant ?? defaultTenantId;

  if (command === undefined) {
    renderHelp();
    return;
  }

  const handler = HANDLERS.get(command);
  if (handler === undefined) {
    renderHelp();
    process.exitCode = 1;
    return;
  }

  await handler({ tenantId, values: values as Record<string, string | undefined>, deps: buildDeps() });
}

main().catch((err) => {
  console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
