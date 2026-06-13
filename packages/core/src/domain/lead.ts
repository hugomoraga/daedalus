// Core aggregate: Lead. Minimal by design (review M2: not a CRM).
// Pure domain — returns EventIntents, never touches infrastructure.

import type { EventIntent } from "./event.ts";
import { LeadCreated, LeadQualified } from "./value-chain.ts";

export type LeadState = "unqualified" | "qualified";

export type Lead = {
  id: string;
  customer: string;
  state: LeadState;
};

export function createLead(id: string, customer: string): { lead: Lead; events: EventIntent[] } {
  if (customer.trim().length === 0) {
    throw new Error("Lead requires a customer name");
  }
  const lead: Lead = { id, customer, state: "unqualified" };
  return { lead, events: [{ type: LeadCreated, payload: { leadId: id, customer } }] };
}

export function qualifyLead(lead: Lead): EventIntent[] {
  if (lead.state === "qualified") {
    throw new Error(`Lead ${lead.id} is already qualified`);
  }
  return [{ type: LeadQualified, payload: { leadId: lead.id } }];
}
