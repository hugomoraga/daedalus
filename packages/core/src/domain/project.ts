// Core aggregate: Project. State machine: created -> delivered -> closed.
// closed is terminal. Per Spec 006 §5.

import type { EventIntent } from "./event.ts";
import { ProjectCreated, ProjectDelivered, ProjectClosed } from "./value-chain.ts";

export type ProjectState = "created" | "delivered" | "closed";

export type Project = {
  id: string;
  tenantId: string;
  proposalId: string;
  leadId: string;
  customer: string;
  expectedValue: { amount: number; currency: string };
  state: ProjectState;
  closedReason: string | null;
};

export function createProject(input: {
  id: string;
  tenantId: string;
  proposalId: string;
  leadId: string;
  customer: string;
  expectedValue: { amount: number; currency: string };
}): { project: Project; events: EventIntent[] } {
  if (input.expectedValue.currency.trim().length === 0) {
    throw new Error("Project expectedValue currency is required");
  }
  const project: Project = {
    id: input.id,
    tenantId: input.tenantId,
    proposalId: input.proposalId,
    leadId: input.leadId,
    customer: input.customer,
    expectedValue: input.expectedValue,
    state: "created",
    closedReason: null,
  };
  return {
    project,
    events: [
      {
        type: ProjectCreated,
        payload: {
          projectId: input.id,
          proposalId: input.proposalId,
          leadId: input.leadId,
          customer: input.customer,
          expectedValue: input.expectedValue,
        },
      },
    ],
  };
}

export function deliverProject(project: Project): { project: Project; events: EventIntent[] } {
  if (project.state === "delivered") return { project, events: [] };
  if (project.state === "closed") {
    throw new Error(`Project ${project.id} is closed and cannot be re-delivered`);
  }
  if (project.state !== "created") {
    throw new Error(`Project ${project.id} is in state ${project.state}; cannot deliver`);
  }
  return {
    project: { ...project, state: "delivered" },
    events: [{ type: ProjectDelivered, payload: { projectId: project.id } }],
  };
}

export function closeProject(
  project: Project,
  reason: string | null,
  hasUnpaidInvoices: boolean,
): { project: Project; events: EventIntent[] } {
  if (project.state === "closed") return { project, events: [] };
  if (project.state === "created") {
    throw new Error(`Project ${project.id} has not been delivered; cannot close`);
  }
  if (hasUnpaidInvoices) {
    // Per Spec 006 R2: an explicit reason is required to close with unpaid invoices.
    if (reason === null || reason.trim().length === 0) {
      throw new Error(
        `Project ${project.id} has unpaid invoices; closing requires an explicit reason`,
      );
    }
  }
  return {
    project: { ...project, state: "closed", closedReason: reason },
    events: [
      {
        type: ProjectClosed,
        payload: { projectId: project.id, reason: reason ?? "" },
      },
    ],
  };
}