// Opportunity Discovery — pipeline projection (read-model).
// Rebuilds the current state of all opportunities by replaying events.
// Emits no event on recomputation (per Spec 003 §6 and AC-5).

import type { DomainEvent } from "@daedalus/core";
import {
  OpportunitySurfaced,
  OpportunityEnriched,
  OpportunityQualified,
  OpportunityDismissed,
} from "../domain/events.ts";

export type OpportunityPipeline = {
  surfaced: Array<{ id: string; label: string; source: string }>;
  qualified: Array<{ id: string; label: string; leadId: string }>;
  dismissed: Array<{ id: string; label: string; reason: string }>;
};

type OpportunityEntry = {
  id: string;
  label: string;
  source: string;
  description: string;
  contact: string;
  state: "surfaced" | "qualified" | "dismissed";
  leadId: string | null;
  dismissedReason: string | null;
};

export function projectPipeline(events: DomainEvent[]): OpportunityPipeline {
  const opportunities = new Map<string, OpportunityEntry>();

  for (const event of events) {
    const id = event.payload.opportunityId as string | undefined;
    if (id === undefined) continue;

    switch (event.type) {
      case OpportunitySurfaced:
        opportunities.set(id, {
          id,
          label: String(event.payload.label ?? ""),
          source: String(event.payload.source ?? ""),
          description: "",
          contact: "",
          state: "surfaced",
          leadId: null,
          dismissedReason: null,
        });
        break;
      case OpportunityEnriched: {
        const opp = opportunities.get(id);
        if (opp) {
          opp.description = String(event.payload.description ?? opp.description);
          opp.contact = String(event.payload.contact ?? opp.contact);
        }
        break;
      }
      case OpportunityQualified: {
        const opp = opportunities.get(id);
        if (opp) {
          opp.state = "qualified";
          opp.leadId = String(event.payload.leadId ?? "");
        }
        break;
      }
      case OpportunityDismissed: {
        const opp = opportunities.get(id);
        if (opp) {
          opp.state = "dismissed";
          opp.dismissedReason = String(event.payload.reason ?? "");
        }
        break;
      }
    }
  }

  const pipeline: OpportunityPipeline = { surfaced: [], qualified: [], dismissed: [] };
  for (const opp of opportunities.values()) {
    if (opp.state === "surfaced") {
      pipeline.surfaced.push({ id: opp.id, label: opp.label, source: opp.source });
    } else if (opp.state === "qualified") {
      pipeline.qualified.push({ id: opp.id, label: opp.label, leadId: opp.leadId! });
    } else {
      pipeline.dismissed.push({ id: opp.id, label: opp.label, reason: opp.dismissedReason! });
    }
  }
  return pipeline;
}