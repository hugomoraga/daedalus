import {
  startDraftUseCase,
  addLineItemUseCase,
  setScopeUseCase,
  finalizeDraftUseCase,
  discardDraftUseCase,
} from "@daedalus/proposal-generation";
import type { CommandHandler } from "./types.ts";
import { requireOpt, tenantCurrency } from "./types.ts";

const proposalStart: CommandHandler = async ({ tenantId, values, deps }) => {
  const out = await startDraftUseCase(deps, {
    tenantId,
    leadId: requireOpt(values.lead, "lead"),
    template: values.template ?? "standard",
  });
  console.log(`ProposalDraftCreated  draft=${out.draftId}`);
};

const proposalAddItem: CommandHandler = async ({ tenantId, values, deps }) => {
  const amount = Number(requireOpt(values.amount, "amount"));
  if (!Number.isFinite(amount)) throw new Error("--amount must be a number");
  await addLineItemUseCase(deps, {
    tenantId,
    draftId: requireOpt(values.draft, "draft"),
    label: requireOpt(values.label, "label"),
    amount,
  });
  console.log(`item added (no event)  draft=${values.draft}  "${values.label}"=${amount}`);
};

const proposalSetScope: CommandHandler = async ({ tenantId, values, deps }) => {
  await setScopeUseCase(deps, {
    tenantId,
    draftId: requireOpt(values.draft, "draft"),
    text: requireOpt(values.text, "text"),
  });
  console.log(`scope set (no event)  draft=${values.draft}`);
};

const proposalShow: CommandHandler = async ({ tenantId, values, deps }) => {
  const draft = await deps.draftStore.load(tenantId, requireOpt(values.draft, "draft"));
  if (draft === null) throw new Error(`Draft ${values.draft} not found`);
  console.log(JSON.stringify(draft, null, 2));
};

const proposalFinalize: CommandHandler = async ({ tenantId, values, deps }) => {
  const out = await finalizeDraftUseCase(deps, {
    tenantId,
    draftId: requireOpt(values.draft, "draft"),
    currency: tenantCurrency(tenantId),
  });
  console.log(
    `ProposalDraftFinalized + ProposalGenerated  proposal=${out.proposalId}  ` +
      `expectedValue=${out.expectedValue.amount} ${out.expectedValue.currency}`,
  );
};

const proposalDiscard: CommandHandler = async ({ tenantId, values, deps }) => {
  await discardDraftUseCase(deps, { tenantId, draftId: requireOpt(values.draft, "draft") });
  console.log(`ProposalDraftDiscarded  draft=${values.draft}`);
};

export const handlers: Array<[string, CommandHandler]> = [
  ["proposal:start", proposalStart],
  ["proposal:add-item", proposalAddItem],
  ["proposal:set-scope", proposalSetScope],
  ["proposal:show", proposalShow],
  ["proposal:finalize", proposalFinalize],
  ["proposal:discard", proposalDiscard],
];
