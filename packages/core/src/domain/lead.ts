// Core aggregate: Lead. Minimal by design (review M2: not a CRM).
// Pure domain — returns EventIntents, never touches infrastructure.

import type { EventIntent } from "./event.ts";
import { LeadCreated, LeadQualified, LeadDiscarded } from "./value-chain.ts";

export type LeadState = "unqualified" | "qualified" | "discarded";

export type Lead = {
  id: string;
  customer: string;
  state: LeadState;
};

export function createLead(id: string, customer: string, opportunityId?: string): { lead: Lead; events: EventIntent[] } {
  if (customer.trim().length === 0) {
    throw new Error("Lead requires a customer name");
  }
  const lead: Lead = { id, customer, state: "unqualified" };
  const payload: Record<string, unknown> = { leadId: id, customer };
  if (opportunityId !== undefined) {
    payload.opportunityId = opportunityId;
  }
  return { lead, events: [{ type: LeadCreated, payload }] };
}

export function qualifyLead(lead: Lead): EventIntent[] {
  if (lead.state === "qualified") {
    throw new Error(`Lead ${lead.id} is already qualified`);
  }
  if (lead.state === "discarded") {
    throw new Error(`Lead ${lead.id} is discarded and cannot be qualified`);
  }
  return [{ type: LeadQualified, payload: { leadId: lead.id } }];
}

export function discardLead(lead: Lead, reason: string): EventIntent[] {
  if (lead.state === "discarded") {
    throw new Error(`Lead ${lead.id} is already discarded`);
  }
  return [{ type: LeadDiscarded, payload: { leadId: lead.id, reason } }];
}
