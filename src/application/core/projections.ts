// Read-model projections: rebuild state by replaying events (validates the event-first model).

import type { DomainEvent } from "../../domain/core/event.ts";
import type { Lead } from "../../domain/core/lead.ts";
import { LeadCreated, LeadQualified } from "../../domain/core/value-chain.ts";

export function projectLead(events: DomainEvent[], leadId: string): Lead | null {
  let lead: Lead | null = null;
  for (const event of events) {
    if (event.payload.leadId !== leadId) continue;
    if (event.type === LeadCreated) {
      lead = { id: leadId, customer: String(event.payload.customer ?? ""), state: "unqualified" };
    } else if (event.type === LeadQualified && lead !== null) {
      lead = { ...lead, state: "qualified" };
    }
  }
  return lead;
}
