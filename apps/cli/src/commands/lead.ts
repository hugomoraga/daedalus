import { createLeadUseCase, qualifyLeadUseCase, discardLeadUseCase } from "@daedalus/core";
import type { CommandHandler } from "./types.ts";
import { requireOpt } from "./types.ts";

const leadCreate: CommandHandler = async ({ tenantId, values, deps }) => {
  const out = await createLeadUseCase(deps, { tenantId, customer: requireOpt(values.customer, "customer") });
  console.log(`LeadCreated  lead=${out.leadId}`);
};

const leadQualify: CommandHandler = async ({ tenantId, values, deps }) => {
  await qualifyLeadUseCase(deps, { tenantId, leadId: requireOpt(values.lead, "lead") });
  console.log(`LeadQualified  lead=${values.lead}`);
};

const leadDiscard: CommandHandler = async ({ tenantId, values, deps }) => {
  await discardLeadUseCase(deps, {
    tenantId,
    leadId: requireOpt(values.lead, "lead"),
    reason: requireOpt(values.reason, "reason"),
  });
  console.log(`LeadDiscarded  lead=${values.lead}`);
};

export const handlers: Array<[string, CommandHandler]> = [
  ["lead:create", leadCreate],
  ["lead:qualify", leadQualify],
  ["lead:discard", leadDiscard],
];
