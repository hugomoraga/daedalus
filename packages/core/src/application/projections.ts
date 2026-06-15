// Read-model projections: rebuild state by replaying events (validates the event-first model).

import type { DomainEvent } from "../domain/event.ts";
import type { Lead } from "../domain/lead.ts";
import type { Proposal } from "../domain/proposal.ts";
import type { Project } from "../domain/project.ts";
import type { Invoice } from "../domain/invoice.ts";
import {
  LeadCreated,
  LeadQualified,
  LeadDiscarded,
  ProposalGenerated,
  ProposalSubmitted,
  ProposalApproved,
  ProposalRejected,
  ProjectCreated,
  ProjectDelivered,
  ProjectClosed,
  InvoiceIssued,
  InvoiceSent,
  InvoicePaid,
  InvoiceOverdue,
} from "../domain/value-chain.ts";

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

export function projectProposal(events: DomainEvent[], proposalId: string): Proposal | null {
  let proposal: Proposal | null = null;
  for (const event of events) {
    if (event.payload.proposalId !== proposalId) continue;
    switch (event.type) {
      case ProposalGenerated:
        proposal = {
          id: proposalId,
          tenantId: event.tenantId,
          leadId: String(event.payload.leadId ?? ""),
          draftId: String(event.payload.draftId ?? ""),
          expectedValue: event.payload.expectedValue as { amount: number; currency: string },
          state: "generated",
          rejectionReason: null,
        };
        break;
      case ProposalSubmitted:
        if (proposal) proposal = { ...proposal, state: "submitted" };
        break;
      case ProposalApproved:
        if (proposal) proposal = { ...proposal, state: "approved" };
        break;
      case ProposalRejected:
        if (proposal) {
          proposal = {
            ...proposal,
            state: "rejected",
            rejectionReason: String(event.payload.reason ?? ""),
          };
        }
        break;
    }
  }
  return proposal;
}

export function projectProject(events: DomainEvent[], projectId: string): Project | null {
  let project: Project | null = null;
  for (const event of events) {
    if (event.payload.projectId !== projectId) continue;
    switch (event.type) {
      case ProjectCreated:
        project = {
          id: projectId,
          tenantId: event.tenantId,
          proposalId: String(event.payload.proposalId ?? ""),
          leadId: String(event.payload.leadId ?? ""),
          customer: String(event.payload.customer ?? ""),
          expectedValue: event.payload.expectedValue as { amount: number; currency: string },
          state: "created",
          closedReason: null,
        };
        break;
      case ProjectDelivered:
        if (project) project = { ...project, state: "delivered" };
        break;
      case ProjectClosed:
        if (project) {
          project = {
            ...project,
            state: "closed",
            closedReason: String(event.payload.reason ?? ""),
          };
        }
        break;
    }
  }
  return project;
}

export function projectInvoice(events: DomainEvent[], invoiceId: string): Invoice | null {
  let invoice: Invoice | null = null;
  for (const event of events) {
    if (event.payload.invoiceId !== invoiceId) continue;
    switch (event.type) {
      case InvoiceIssued:
        invoice = {
          id: invoiceId,
          tenantId: event.tenantId,
          projectId: String(event.payload.projectId ?? ""),
          proposalId: String(event.payload.proposalId ?? ""),
          amount: Number(event.payload.amount ?? 0),
          currency: String(event.payload.currency ?? ""),
          state: "issued",
          isOverdue: false,
          paidByPaymentId: null,
        };
        break;
      case InvoiceSent:
        if (invoice) invoice = { ...invoice, state: "sent" };
        break;
      case InvoicePaid:
        if (invoice) {
          invoice = {
            ...invoice,
            state: "paid",
            paidByPaymentId: String(event.payload.paymentId ?? ""),
            isOverdue: false,
          };
        }
        break;
      case InvoiceOverdue:
        if (invoice && invoice.state !== "paid") invoice = { ...invoice, isOverdue: true };
        break;
    }
  }
  return invoice;
}

// Helper for close-project: returns true if there are unpaid invoices for the given proposal.
export function hasUnpaidInvoices(events: DomainEvent[], proposalId: string): boolean {
  const invoiceIds = new Set<string>();
  for (const e of events) {
    if (e.type === InvoiceIssued && e.payload.proposalId === proposalId) {
      invoiceIds.add(String(e.payload.invoiceId));
    }
  }
  for (const invoiceId of invoiceIds) {
    const inv = projectInvoice(events, invoiceId);
    if (inv !== null && inv.state !== "paid") return true;
  }
  return false;
}