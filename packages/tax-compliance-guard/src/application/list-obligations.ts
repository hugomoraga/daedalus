// Tax & Compliance Guard — listObligationsUseCase (Spec 004 Plan §3.4,
// T-08). Returns the structured live-state report for the tenant. Used
// by the `obligations:list` CLI command.

import type { TaxComplianceDeps } from "./deps.ts";
import {
  deriveObligationStates,
  type ObligorState,
} from "./obligation-state.ts";

export type ListObligationsInput = {
  tenantId: string;
  asOf?: string;
};

export type ListObligationsResult = {
  asOf: string;
  obligations: ObligorState[];
};

export async function listObligationsUseCase(
  deps: TaxComplianceDeps,
  input: ListObligationsInput,
): Promise<ListObligationsResult> {
  const asOf = input.asOf ?? (deps.asOf !== undefined ? deps.asOf() : deps.now());
  const events = await deps.eventStore.readStream(input.tenantId);
  const obligations = deriveObligationStates(events, asOf);
  return { asOf, obligations };
}
