// Driving adapter: the CLI. Parses input -> builds a Command -> invokes a use case -> renders.
// NO business logic lives here (Technical Principles: CLI is an adapter). Composition root:
// it wires concrete adapters to the ports.

import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";
import { createLeadUseCase, qualifyLeadUseCase } from "@daedalus/core";
import {
  startDraftUseCase,
  addLineItemUseCase,
  setScopeUseCase,
  finalizeDraftUseCase,
  discardDraftUseCase,
} from "@daedalus/proposal-generation";
import type { ProposalDeps } from "@daedalus/proposal-generation";
import { JsonFileDraftStoreAdapter } from "@daedalus/proposal-generation/adapters";
import { JsonlEventStoreAdapter } from "@daedalus/jsonl-event-store";
import { loadTenantConfig, defaultTenantId } from "../../../config/tenants/index.ts";

const DATA_DIR = ".data";

function buildDeps(): ProposalDeps {
  return {
    eventStore: new JsonlEventStoreAdapter(DATA_DIR),
    draftStore: new JsonFileDraftStoreAdapter(DATA_DIR),
    newId: () => randomUUID(),
    now: () => new Date().toISOString(),
    actor: "cli",
  };
}

function requireOpt(value: string | undefined, name: string): string {
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required --${name}`);
  }
  return value;
}

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
    },
  });

  const command = positionals[0];
  const tenantId = values.tenant ?? defaultTenantId;
  const deps = buildDeps();

  switch (command) {
    case "lead:create": {
      const out = await createLeadUseCase(deps, { tenantId, customer: requireOpt(values.customer, "customer") });
      console.log(`LeadCreated  lead=${out.leadId}`);
      break;
    }
    case "lead:qualify": {
      await qualifyLeadUseCase(deps, { tenantId, leadId: requireOpt(values.lead, "lead") });
      console.log(`LeadQualified  lead=${values.lead}`);
      break;
    }
    case "proposal:start": {
      const out = await startDraftUseCase(deps, {
        tenantId,
        leadId: requireOpt(values.lead, "lead"),
        template: values.template ?? "standard",
      });
      console.log(`ProposalDraftCreated  draft=${out.draftId}`);
      break;
    }
    case "proposal:add-item": {
      const amount = Number(requireOpt(values.amount, "amount"));
      if (!Number.isFinite(amount)) throw new Error("--amount must be a number");
      await addLineItemUseCase(deps, {
        tenantId,
        draftId: requireOpt(values.draft, "draft"),
        label: requireOpt(values.label, "label"),
        amount,
      });
      console.log(`item added (no event)  draft=${values.draft}  "${values.label}"=${amount}`);
      break;
    }
    case "proposal:set-scope": {
      await setScopeUseCase(deps, {
        tenantId,
        draftId: requireOpt(values.draft, "draft"),
        text: requireOpt(values.text, "text"),
      });
      console.log(`scope set (no event)  draft=${values.draft}`);
      break;
    }
    case "proposal:show": {
      const draft = await deps.draftStore.load(tenantId, requireOpt(values.draft, "draft"));
      if (draft === null) throw new Error(`Draft ${values.draft} not found`);
      console.log(JSON.stringify(draft, null, 2));
      break;
    }
    case "proposal:finalize": {
      const out = await finalizeDraftUseCase(deps, {
        tenantId,
        draftId: requireOpt(values.draft, "draft"),
        currency: loadTenantConfig(tenantId).currency,
      });
      console.log(
        `ProposalDraftFinalized + ProposalGenerated  proposal=${out.proposalId}  ` +
          `expectedValue=${out.expectedValue.amount} ${out.expectedValue.currency}`,
      );
      break;
    }
    case "proposal:discard": {
      await discardDraftUseCase(deps, { tenantId, draftId: requireOpt(values.draft, "draft") });
      console.log(`ProposalDraftDiscarded  draft=${values.draft}`);
      break;
    }
    case "events": {
      const events = await deps.eventStore.readStream(tenantId);
      if (events.length === 0) {
        console.log(`(no events for tenant ${tenantId})`);
        break;
      }
      for (const e of events) {
        console.log(`${e.occurredAt}  ${e.type}  ${JSON.stringify(e.payload)}`);
      }
      break;
    }
    default:
      console.log(
        [
          "Daedalus CLI — Proposal Generation v0",
          "Usage: node apps/cli/src/index.ts <command> [--options]",
          "",
          "Commands:",
          "  lead:create     --tenant <id> --customer <name>",
          "  lead:qualify    --tenant <id> --lead <id>",
          "  proposal:start  --tenant <id> --lead <id> [--template standard]",
          "  proposal:add-item --tenant <id> --draft <id> --label <l> --amount <n>",
          "  proposal:set-scope --tenant <id> --draft <id> --text <s>",
          "  proposal:show   --tenant <id> --draft <id>",
          "  proposal:finalize --tenant <id> --draft <id>",
          "  proposal:discard  --tenant <id> --draft <id>",
          "  events          --tenant <id>",
        ].join("\n"),
      );
      if (command !== undefined) process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
