// Opportunity Discovery — dependency kernel.
// Extends CoreDeps with the module's own port (OpportunityStorePort).

import type { CoreDeps } from "@daedalus/core";
import type { OpportunityStorePort } from "./ports/opportunity-store.ts";

export type OpportunityDiscoveryDeps = CoreDeps & {
  opportunityStore: OpportunityStorePort;
};