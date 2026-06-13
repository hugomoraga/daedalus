// Driving adapter: the CLI. Parses input -> builds a Command -> invokes a use case -> renders.
// NO business logic lives here (Technical Principles: CLI is an adapter).

import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";
import type { Deps } from "../../application/shared/deps.ts";
import { JsonlEventStoreAdapter } from "../persistence/jsonl-event-store.ts";
import { JsonFileDraftStoreAdapter } from "../persistence/json-draft-store.ts";
import { tenant0 } from "../../config/tenants/tenant-0.ts";
import { createLeadUseCase } from "../../application/core/create-lead.ts";
import { qualifyLeadUseCase } from "../../application/core/qualify-lead.ts";
import { startDraftUseCase } from "../../application/proposal-generation/start-draft.ts";
import { addLineItemUseCase } from "../../application/proposal-generation/add-line-item.ts";
import { setScopeUseCase } from "../../application/proposal-generation/set-scope.ts";
import { finalizeDraftUseCase } from "../../application/proposal-generation/finalize-draft.ts";
import { discardDraftUseCase } from "../../application/proposal-generation/discard-draft.ts";

const DATA_DIR = ".data";

function buildDeps(): Deps {
  return {
    eventStore: new JsonlEventStoreAdapter(DATA_DIR),
    draftStore: new JsonFileDraftStoreAdapter(DATA_DIR),
    newId: () => randomUUID(),
    now: () => new Date().toISOString(),
    actor: "cli",
  };
}

function currencyFor(tenantId: string): string {
  return tenantId === tenant0.id ? tenant0.currency : "USD";
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
  const tenantId = values.tenant ?? tenant0.id;
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
        currency: currencyFor(tenantId),
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
          "Usage: node src/adapters/cli/index.ts <command> [--options]",
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
