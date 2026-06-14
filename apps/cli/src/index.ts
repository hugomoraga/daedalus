// Driving adapter: the CLI. Parses input -> builds a Command -> invokes a use case -> renders.
// NO business logic lives here (Technical Principles: CLI is an adapter). Composition root:
// it wires concrete adapters to the ports.

import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";
import { createLeadUseCase, qualifyLeadUseCase, discardLeadUseCase } from "@daedalus/core";
import {
  startDraftUseCase,
  addLineItemUseCase,
  setScopeUseCase,
  finalizeDraftUseCase,
  discardDraftUseCase,
} from "@daedalus/proposal-generation";
import type { ProposalDeps } from "@daedalus/proposal-generation";
import { JsonFileDraftStoreAdapter } from "@daedalus/proposal-generation/adapters";
import { ingestProposalRevenueUseCase, projectExpectedRevenue } from "@daedalus/revenue-visibility";
import {
  surfaceOpportunityUseCase,
  enrichOpportunityUseCase,
  qualifyOpportunityUseCase,
  dismissOpportunityUseCase,
  projectPipeline,
} from "@daedalus/opportunity-discovery";
import type { OpportunityDiscoveryDeps } from "@daedalus/opportunity-discovery";
import { JsonOpportunityStoreAdapter } from "@daedalus/opportunity-discovery/adapters";
import { JsonlEventStoreAdapter } from "@daedalus/jsonl-event-store";
import { loadTenantConfig, defaultTenantId } from "../../../config/tenants/index.ts";

const DATA_DIR = ".data";

function buildDeps(): ProposalDeps & OpportunityDiscoveryDeps {
  return {
    eventStore: new JsonlEventStoreAdapter(DATA_DIR),
    draftStore: new JsonFileDraftStoreAdapter(DATA_DIR),
    opportunityStore: new JsonOpportunityStoreAdapter(DATA_DIR),
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
      source: { type: "string" },
      opportunity: { type: "string" },
      description: { type: "string" },
      contact: { type: "string" },
      reason: { type: "string" },
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
    case "lead:discard": {
      await discardLeadUseCase(deps, { tenantId, leadId: requireOpt(values.lead, "lead"), reason: requireOpt(values.reason, "reason") });
      console.log(`LeadDiscarded  lead=${values.lead}`);
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
    case "opportunity:surface": {
      const out = await surfaceOpportunityUseCase(deps, {
        tenantId,
        label: requireOpt(values.label, "label"),
        source: requireOpt(values.source, "source"),
      });
      console.log(`OpportunitySurfaced  opportunity=${out.opportunityId}`);
      break;
    }
    case "opportunity:enrich": {
      await enrichOpportunityUseCase(deps, {
        tenantId,
        opportunityId: requireOpt(values.opportunity, "opportunity"),
        description: values.description,
        contact: values.contact,
      });
      console.log(`OpportunityEnriched  opportunity=${values.opportunity}`);
      break;
    }
    case "opportunity:qualify": {
      const out = await qualifyOpportunityUseCase(deps, {
        tenantId,
        opportunityId: requireOpt(values.opportunity, "opportunity"),
      });
      console.log(`OpportunityQualified + LeadCreated + LeadQualified  lead=${out.leadId}`);
      break;
    }
    case "opportunity:dismiss": {
      await dismissOpportunityUseCase(deps, {
        tenantId,
        opportunityId: requireOpt(values.opportunity, "opportunity"),
        reason: requireOpt(values.reason, "reason"),
      });
      console.log(`OpportunityDismissed  opportunity=${values.opportunity}`);
      break;
    }
    case "opportunity:show": {
      const opp = await deps.opportunityStore.load(tenantId, requireOpt(values.opportunity, "opportunity"));
      if (opp === null) throw new Error(`Opportunity ${values.opportunity} not found`);
      console.log(JSON.stringify(opp, null, 2));
      break;
    }
    case "opportunity:pipeline": {
      const events = await deps.eventStore.readStream(tenantId);
      const pipeline = projectPipeline(events);
      console.log("=== Pipeline ===");
      console.log(`Surfaced (${pipeline.surfaced.length}):`);
      for (const s of pipeline.surfaced) {
        console.log(`  ${s.id}  "${s.label}"  source=${s.source}`);
      }
      console.log(`Qualified (${pipeline.qualified.length}):`);
      for (const q of pipeline.qualified) {
        console.log(`  ${q.id}  "${q.label}"  lead=${q.leadId}`);
      }
      console.log(`Dismissed (${pipeline.dismissed.length}):`);
      for (const d of pipeline.dismissed) {
        console.log(`  ${d.id}  "${d.label}"  reason="${d.reason}"`);
      }
      break;
    }
    case "revenue:ingest": {
      const out = await ingestProposalRevenueUseCase(deps, { tenantId });
      console.log(`revenue:ingest  ingested=${out.ingested} estimate(s) from ProposalGenerated`);
      break;
    }
    case "revenue:show": {
      const events = await deps.eventStore.readStream(tenantId);
      const summary = projectExpectedRevenue(events);
      const currency = summary.count === 0 ? loadTenantConfig(tenantId).currency : summary.currency;
      console.log(`expected revenue: ${summary.expected} ${currency}  (${summary.count} estimate(s))`);
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
          "  lead:create        --tenant <id> --customer <name>",
          "  lead:qualify       --tenant <id> --lead <id>",
          "  lead:discard       --tenant <id> --lead <id> --reason <r>",
          "  opportunity:surface  --tenant <id> --label <l> --source <s>",
          "  opportunity:enrich   --tenant <id> --opportunity <id> [--description <d>] [--contact <c>]",
          "  opportunity:qualify  --tenant <id> --opportunity <id>",
          "  opportunity:dismiss  --tenant <id> --opportunity <id> --reason <r>",
          "  opportunity:show     --tenant <id> --opportunity <id>",
          "  opportunity:pipeline  --tenant <id>",
          "  proposal:start  --tenant <id> --lead <id> [--template standard]",
          "  proposal:add-item --tenant <id> --draft <id> --label <l> --amount <n>",
          "  proposal:set-scope --tenant <id> --draft <id> --text <s>",
          "  proposal:show   --tenant <id> --draft <id>",
          "  proposal:finalize --tenant <id> --draft <id>",
          "  proposal:discard  --tenant <id> --draft <id>",
          "  revenue:ingest  --tenant <id>",
          "  revenue:show    --tenant <id>",
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