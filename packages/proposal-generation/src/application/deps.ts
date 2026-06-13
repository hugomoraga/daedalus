// Proposal Generation dependencies: the Core kernel plus the module's DraftStorePort.
// Extends CoreDeps (the Core never depends on this — dependency points inward).

import type { CoreDeps } from "@daedalus/core";
import type { DraftStorePort } from "./ports/draft-store.ts";

export type ProposalDeps = CoreDeps & {
  draftStore: DraftStorePort;
};
