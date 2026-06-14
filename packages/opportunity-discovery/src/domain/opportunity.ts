// Opportunity Discovery — the Opportunity aggregate.
// Lifecycle: surfaced → qualified | dismissed.
// Enrichment mutates the work-area AND emits an event (per Spec 003 §6: enrichment
// records what was known at decision time).
// After qualification or dismissal, the opportunity is closed for further editing.

import type { EventIntent } from "@daedalus/core";
import {
  OpportunitySurfaced,
  OpportunityEnriched,
  OpportunityQualified,
  OpportunityDismissed,
} from "./events.ts";

export type OpportunityState = "surfaced" | "qualified" | "dismissed";

export type Opportunity = {
  id: string;
  tenantId: string;
  label: string;
  source: string;
  description: string;
  contact: string;
  state: OpportunityState;
  leadId: string | null;
  dismissedReason: string | null;
};

export function surfaceOpportunity(
  id: string,
  tenantId: string,
  label: string,
  source: string,
): { opportunity: Opportunity; events: EventIntent[] } {
  if (label.trim().length === 0) {
    throw new Error("Opportunity requires a label");
  }
  if (source.trim().length === 0) {
    throw new Error("Opportunity requires a source");
  }
  const opportunity: Opportunity = {
    id,
    tenantId,
    label,
    source,
    description: "",
    contact: "",
    state: "surfaced",
    leadId: null,
    dismissedReason: null,
  };
  return {
    opportunity,
    events: [{ type: OpportunitySurfaced, payload: { opportunityId: id, label, source } }],
  };
}

export function enrichOpportunity(
  opportunity: Opportunity,
  updates: { description?: string; contact?: string },
): { opportunity: Opportunity; events: EventIntent[] } {
  assertMutable(opportunity);
  const updated: Opportunity = {
    ...opportunity,
    description: updates.description ?? opportunity.description,
    contact: updates.contact ?? opportunity.contact,
  };
  return {
    opportunity: updated,
    events: [
      {
        type: OpportunityEnriched,
        payload: {
          opportunityId: opportunity.id,
          description: updated.description,
          contact: updated.contact,
        },
      },
    ],
  };
}

export function qualifyOpportunity(
  opportunity: Opportunity,
  leadId: string,
): { opportunity: Opportunity; events: EventIntent[] } {
  if (opportunity.state === "qualified") {
    throw new Error(`Opportunity ${opportunity.id} is already qualified`);
  }
  if (opportunity.state === "dismissed") {
    throw new Error(`Opportunity ${opportunity.id} is dismissed and cannot be qualified`);
  }
  return {
    opportunity: { ...opportunity, state: "qualified", leadId },
    events: [{ type: OpportunityQualified, payload: { opportunityId: opportunity.id, leadId } }],
  };
}

export function dismissOpportunity(
  opportunity: Opportunity,
  reason: string,
): { opportunity: Opportunity; events: EventIntent[] } {
  if (opportunity.state === "dismissed") {
    throw new Error(`Opportunity ${opportunity.id} is already dismissed`);
  }
  if (opportunity.state === "qualified") {
    throw new Error(`Opportunity ${opportunity.id} is qualified and cannot be dismissed`);
  }
  if (reason.trim().length === 0) {
    throw new Error("Dismissing an opportunity requires a reason");
  }
  return {
    opportunity: { ...opportunity, state: "dismissed", dismissedReason: reason },
    events: [{ type: OpportunityDismissed, payload: { opportunityId: opportunity.id, reason } }],
  };
}

function assertMutable(opportunity: Opportunity): void {
  if (opportunity.state !== "surfaced") {
    throw new Error(
      `Opportunity ${opportunity.id} is ${opportunity.state}; it can no longer be edited`,
    );
  }
}