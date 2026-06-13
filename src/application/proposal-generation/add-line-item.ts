// Use case: add a pricing line item to a draft. Mutates the work-area. Emits NO event (Spec 002 §6, AC-4).

import type { Deps } from "../shared/deps.ts";
import { addLineItem } from "../../domain/proposal-generation/proposal-draft.ts";

export type AddLineItemCommand = {
  tenantId: string;
  draftId: string;
  label: string;
  amount: number;
};

export async function addLineItemUseCase(deps: Deps, cmd: AddLineItemCommand): Promise<void> {
  const draft = await deps.draftStore.load(cmd.tenantId, cmd.draftId);
  if (draft === null) {
    throw new Error(`Draft ${cmd.draftId} not found`);
  }
  const updated = addLineItem(draft, { label: cmd.label, amount: cmd.amount });
  await deps.draftStore.save(updated);
}
