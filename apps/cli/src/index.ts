// Driving adapter: the CLI. Parses input -> builds a Command -> invokes a use case -> renders.
// NO business logic lives here (Technical Principles: CLI is an adapter). Composition root:
// it wires concrete adapters to the ports.

import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";
import {
  createLeadUseCase,
  qualifyLeadUseCase,
  discardLeadUseCase,
  approveProposalUseCase,
  recordPaymentReceivedUseCase,
} from "@daedalus/core";
import {
  startDraftUseCase,
  addLineItemUseCase,
  setScopeUseCase,
  finalizeDraftUseCase,
  discardDraftUseCase,
} from "@daedalus/proposal-generation";
import type { ProposalDeps } from "@daedalus/proposal-generation";
import { JsonFileDraftStoreAdapter } from "@daedalus/proposal-generation/adapters";
import {
  ingestProposalRevenueUseCase,
  projectExpectedRevenue,
  projectFinancialSummary,
  createEstimateUseCase,
  updateEstimateUseCase,
  confirmRevenueUseCase,
  receiveRevenueUseCase,
  registerExpenseUseCase,
  takeSnapshotUseCase,
  evaluateAlertsUseCase,
} from "@daedalus/revenue-visibility";
import type { RevenueDeps } from "@daedalus/revenue-visibility";
import { TenantConfigThresholdsAdapter } from "@daedalus/revenue-visibility/adapters";
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

function buildDeps(): ProposalDeps & OpportunityDiscoveryDeps & RevenueDeps {
  return {
    eventStore: new JsonlEventStoreAdapter(DATA_DIR),
    draftStore: new JsonFileDraftStoreAdapter(DATA_DIR),
    opportunityStore: new JsonOpportunityStoreAdapter(DATA_DIR),
    thresholds: new TenantConfigThresholdsAdapter(),
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
      estimate: { type: "string" },
      proposal: { type: "string" },
      payment: { type: "string" },
      notes: { type: "string" },
    },
  });

  const command = positionals[0];
  const tenantId = values.tenant ?? defaultTenantId;
  const deps = buildDeps();

  switch (command) {
    // ---- Core: lead lifecycle ----
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

    // ---- Core: proposal approval + payment (v1) ----
    case "proposal:approve": {
      const proposalId = requireOpt(values.proposal, "proposal");
      const events = await deps.eventStore.readStream(tenantId);
      const proposal = events.find((e) => e.type === "ProposalGenerated" && e.payload.proposalId === proposalId);
      if (proposal === undefined) throw new Error(`Proposal ${proposalId} not found`);
      const expectedValue = proposal.payload.expectedValue as { amount: number; currency: string } | undefined;
      if (expectedValue === undefined) throw new Error(`Proposal ${proposalId} has no expectedValue`);
      await approveProposalUseCase(deps, {
        tenantId,
        proposalId,
        leadId: String(proposal.payload.leadId ?? ""),
        expectedValue,
      });
      console.log(`ProposalApproved  proposal=${proposalId}`);
      break;
    }
    case "payment:record": {
      const proposalId = requireOpt(values.proposal, "proposal");
      const paymentId = requireOpt(values.payment, "payment");
      const amount = Number(requireOpt(values.amount, "amount"));
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("--amount must be a positive number");
      const currency = loadTenantConfig(tenantId).currency;
      await recordPaymentReceivedUseCase(deps, { tenantId, proposalId, paymentId, amount, currency });
      console.log(`PaymentReceived  proposal=${proposalId}  payment=${paymentId}  ${amount} ${currency}`);
      break;
    }

    // ---- Proposal Generation ----
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

    // ---- Opportunity Discovery ----
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

    // ---- Revenue Visibility v0 (kept) ----
    case "revenue:ingest": {
      const out = await ingestProposalRevenueUseCase(deps, { tenantId });
      console.log(
        `revenue:ingest  ingested=${out.ingested}  confirmed=${out.confirmed}  received=${out.received}`,
      );
      break;
    }
    case "revenue:show": {
      const events = await deps.eventStore.readStream(tenantId);
      const summary = projectExpectedRevenue(events);
      const currency = summary.count === 0 ? loadTenantConfig(tenantId).currency : summary.currency;
      console.log(`expected revenue: ${summary.expected} ${currency}  (${summary.count} estimate(s))`);
      break;
    }

    // ---- Revenue Visibility v1 (new) ----
    case "revenue:create": {
      const amount = Number(requireOpt(values.amount, "amount"));
      if (!Number.isFinite(amount)) throw new Error("--amount must be a number");
      const out = await createEstimateUseCase(deps, {
        tenantId,
        label: requireOpt(values.label, "label"),
        amount,
        currency: loadTenantConfig(tenantId).currency,
        notes: values.notes,
      });
      console.log(`RevenueEstimateCreated  estimate=${out.estimateId}`);
      break;
    }
    case "revenue:update": {
      const amount = values.amount !== undefined ? Number(values.amount) : undefined;
      if (amount !== undefined && !Number.isFinite(amount)) throw new Error("--amount must be a number");
      await updateEstimateUseCase(deps, {
        tenantId,
        estimateId: requireOpt(values.estimate, "estimate"),
        amount,
        notes: values.notes,
      });
      console.log(`RevenueEstimateUpdated  estimate=${values.estimate}`);
      break;
    }
    case "revenue:confirm": {
      const out = await confirmRevenueUseCase(deps, {
        tenantId,
        estimateId: requireOpt(values.estimate, "estimate"),
      });
      console.log(
        out.changed
          ? `RevenueConfirmed  estimate=${values.estimate}`
          : `already confirmed or received  estimate=${values.estimate}`,
      );
      break;
    }
    case "revenue:receive": {
      const out = await receiveRevenueUseCase(deps, {
        tenantId,
        estimateId: requireOpt(values.estimate, "estimate"),
      });
      console.log(
        out.changed
          ? `RevenueReceived  estimate=${values.estimate}`
          : `already received  estimate=${values.estimate}`,
      );
      break;
    }
    case "expense:register": {
      const amount = Number(requireOpt(values.amount, "amount"));
      if (!Number.isFinite(amount)) throw new Error("--amount must be a number");
      const out = await registerExpenseUseCase(deps, {
        tenantId,
        label: requireOpt(values.label, "label"),
        amount,
        currency: loadTenantConfig(tenantId).currency,
      });
      console.log(`ExpenseRegistered  expense=${out.expenseId}  "${values.label}"=${amount}`);
      break;
    }
    case "revenue:snapshot": {
      await takeSnapshotUseCase(deps, { tenantId });
      console.log(`RevenueSnapshotGenerated  tenant=${tenantId}`);
      break;
    }
    case "revenue:summary": {
      const events = await deps.eventStore.readStream(tenantId);
      const s = projectFinancialSummary(events);
      const currency = s.currency.length === 0 ? loadTenantConfig(tenantId).currency : s.currency;
      console.log("=== Financial Summary ===");
      console.log(`currency:        ${currency}`);
      console.log(`expected:        ${s.expected}  (${s.expectedCount} estimate${s.expectedCount === 1 ? "" : "s"})`);
      console.log(`confirmed:       ${s.confirmed}  (${s.confirmedCount})`);
      console.log(`received:        ${s.received}  (${s.receivedCount})`);
      console.log(`expenses:        ${s.expenses}  (${s.expenseCount})`);
      console.log(`margin:          ${s.margin} ${currency}`);
      console.log(`runway (months): ${Number.isFinite(s.runwayMonths) ? s.runwayMonths.toFixed(2) : "∞"}`);
      console.log(`basic state:     ${s.basicState}`);
      break;
    }
    case "revenue:alerts": {
      const out = await evaluateAlertsUseCase(deps, { tenantId });
      if (out.raised.length === 0 && out.cleared.length === 0) {
        console.log("no alert changes");
      } else {
        for (const a of out.raised) {
          console.log(`RAISED  ${a.ruleId}  threshold=${a.threshold}  actual=${a.actual}`);
        }
        for (const id of out.cleared) {
          console.log(`CLEARED  ${id}`);
        }
      }
      break;
    }

    // ---- events dump ----
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
          "Daedalus CLI",
          "Usage: node apps/cli/src/index.ts <command> [--options]",
          "",
          "Commands:",
          "  lead:create        --tenant <id> --customer <name>",
          "  lead:qualify       --tenant <id> --lead <id>",
          "  lead:discard       --tenant <id> --lead <id> --reason <r>",
          "  proposal:approve   --tenant <id> --proposal <id>",
          "  payment:record     --tenant <id> --proposal <id> --payment <id> --amount <n>",
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
          "  revenue:create  --tenant <id> --label <l> --amount <n> [--notes <t>]",
          "  revenue:update  --tenant <id> --estimate <id> [--amount <n>] [--notes <t>]",
          "  revenue:confirm --tenant <id> --estimate <id>",
          "  revenue:receive --tenant <id> --estimate <id>",
          "  expense:register --tenant <id> --label <l> --amount <n>",
          "  revenue:snapshot --tenant <id>",
          "  revenue:summary  --tenant <id>",
          "  revenue:alerts   --tenant <id>",
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