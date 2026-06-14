// Read-model projections: rebuild state by replaying events (validates the event-first model).

import type { DomainEvent } from "../domain/event.ts";
import type { Lead } from "../domain/lead.ts";
import { LeadCreated, LeadQualified, LeadDiscarded } from "../domain/value-chain.ts";

export function projectLead(events: DomainEvent[], leadId: string): Lead | null {
  let lead: Lead | null = null;
  for (const event of events) {
    if (event.payload.leadId !== leadId) continue;
    if (event.type === LeadCreated) {
      lead = { id: leadId, customer: String(event.payload.customer ?? ""), state: "unqualified" };
    } else if (event.type === LeadQualified && lead !== null) {
      lead = { ...lead, state: "qualified" };
    } else if (event.type === LeadDiscarded && lead !== null) {
      lead = { ...lead, state: "discarded" };
    }
  }
  return lead;
}
