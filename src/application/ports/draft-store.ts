// Port: persistence for the mutable draft work-area.
// Justified second port (Technical Principles "ports earn their place"): per Spec 002,
// draft edits are NOT events, so the work-area needs its own storage. Isolating it here
// keeps the domain/use cases pure and the non-event state explicitly contained.

import type { ProposalDraft } from "../../domain/proposal-generation/proposal-draft.ts";

export interface DraftStorePort {
  load(tenantId: string, draftId: string): Promise<ProposalDraft | null>;
  save(draft: ProposalDraft): Promise<void>;
}
