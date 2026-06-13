// Proposal Generation — the ProposalDraft aggregate (work-area).
// Per Spec 002 §6, the draft is a mutable read-model: edits emit NO events.
// Only start / finalize / discard are deliberate milestones that emit events.
// ProposalGenerated (a CORE event) is composed by the finalize use case, not here,
// so the module never owns a Core event type.

import type { EventIntent } from "../core/event.ts";
import type { PricingLineItem, ExpectedValue } from "./value-objects.ts";
import { sumLineItems } from "./value-objects.ts";
import {
  ProposalDraftCreated,
  ProposalDraftFinalized,
  ProposalDraftDiscarded,
} from "./events.ts";

export type DraftState = "draft" | "finalized" | "discarded";

export type ProposalDraft = {
  id: string;
  tenantId: string;
  leadId: string;
  template: string;
  scope: string;
  lineItems: PricingLineItem[];
  state: DraftState;
};

function assertEditable(draft: ProposalDraft): void {
  if (draft.state !== "draft") {
    throw new Error(`Draft ${draft.id} is ${draft.state}; it can no longer be edited`);
  }
}

export function startDraft(
  id: string,
  tenantId: string,
  leadId: string,
  template: string,
): { draft: ProposalDraft; events: EventIntent[] } {
  const draft: ProposalDraft = {
    id,
    tenantId,
    leadId,
    template,
    scope: "",
    lineItems: [],
    state: "draft",
  };
  return {
    draft,
    events: [{ type: ProposalDraftCreated, payload: { draftId: id, leadId, template } }],
  };
}

// Mutations: pure, no events (the work-area is a read-model).
export function addLineItem(draft: ProposalDraft, item: PricingLineItem): ProposalDraft {
  assertEditable(draft);
  if (item.label.trim().length === 0) throw new Error("Line item requires a label");
  return { ...draft, lineItems: [...draft.lineItems, item] };
}

export function setScope(draft: ProposalDraft, text: string): ProposalDraft {
  assertEditable(draft);
  return { ...draft, scope: text };
}

// Finalize: emits the module milestone and yields the expectedValue. The CORE
// ProposalGenerated is emitted by the use case from this expectedValue (single, no dup).
export function finalizeDraft(
  draft: ProposalDraft,
  currency: string,
): { draft: ProposalDraft; expectedValue: ExpectedValue; events: EventIntent[] } {
  assertEditable(draft);
  const expectedValue = sumLineItems(draft.lineItems, currency);
  return {
    draft: { ...draft, state: "finalized" },
    expectedValue,
    events: [{ type: ProposalDraftFinalized, payload: { draftId: draft.id } }],
  };
}

export function discardDraft(draft: ProposalDraft): { draft: ProposalDraft; events: EventIntent[] } {
  assertEditable(draft);
  return {
    draft: { ...draft, state: "discarded" },
    events: [{ type: ProposalDraftDiscarded, payload: { draftId: draft.id } }],
  };
}
