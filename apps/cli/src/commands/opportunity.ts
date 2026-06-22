import {
  surfaceOpportunityUseCase,
  enrichOpportunityUseCase,
  qualifyOpportunityUseCase,
  dismissOpportunityUseCase,
  projectPipeline,
} from "@daedalus/opportunity-discovery";
import type { CommandHandler } from "./types.ts";
import { requireOpt } from "./types.ts";

const opportunitySurface: CommandHandler = async ({ tenantId, values, deps }) => {
  const out = await surfaceOpportunityUseCase(deps, {
    tenantId,
    label: requireOpt(values.label, "label"),
    source: requireOpt(values.source, "source"),
  });
  console.log(`OpportunitySurfaced  opportunity=${out.opportunityId}`);
};

const opportunityEnrich: CommandHandler = async ({ tenantId, values, deps }) => {
  await enrichOpportunityUseCase(deps, {
    tenantId,
    opportunityId: requireOpt(values.opportunity, "opportunity"),
    description: values.description,
    contact: values.contact,
  });
  console.log(`OpportunityEnriched  opportunity=${values.opportunity}`);
};

const opportunityQualify: CommandHandler = async ({ tenantId, values, deps }) => {
  const out = await qualifyOpportunityUseCase(deps, {
    tenantId,
    opportunityId: requireOpt(values.opportunity, "opportunity"),
  });
  console.log(`OpportunityQualified + LeadCreated + LeadQualified  lead=${out.leadId}`);
};

const opportunityDismiss: CommandHandler = async ({ tenantId, values, deps }) => {
  await dismissOpportunityUseCase(deps, {
    tenantId,
    opportunityId: requireOpt(values.opportunity, "opportunity"),
    reason: requireOpt(values.reason, "reason"),
  });
  console.log(`OpportunityDismissed  opportunity=${values.opportunity}`);
};

const opportunityShow: CommandHandler = async ({ tenantId, values, deps }) => {
  const opp = await deps.opportunityStore.load(tenantId, requireOpt(values.opportunity, "opportunity"));
  if (opp === null) throw new Error(`Opportunity ${values.opportunity} not found`);
  console.log(JSON.stringify(opp, null, 2));
};

const opportunityPipeline: CommandHandler = async ({ tenantId, deps }) => {
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
};

export const handlers: Array<[string, CommandHandler]> = [
  ["opportunity:surface", opportunitySurface],
  ["opportunity:enrich", opportunityEnrich],
  ["opportunity:qualify", opportunityQualify],
  ["opportunity:dismiss", opportunityDismiss],
  ["opportunity:show", opportunityShow],
  ["opportunity:pipeline", opportunityPipeline],
];
