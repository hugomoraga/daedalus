// Use case: set the draft scope text. Mutates the work-area. Emits NO event (Spec 002 §6, AC-4).

import type { Deps } from "../shared/deps.ts";
import { setScope } from "../../domain/proposal-generation/proposal-draft.ts";

export type SetScopeCommand = {
  tenantId: string;
  draftId: string;
  text: string;
};

export async function setScopeUseCase(deps: Deps, cmd: SetScopeCommand): Promise<void> {
  const draft = await deps.draftStore.load(cmd.tenantId, cmd.draftId);
  if (draft === null) {
    throw new Error(`Draft ${cmd.draftId} not found`);
  }
  const updated = setScope(draft, cmd.text);
  await deps.draftStore.save(updated);
}
