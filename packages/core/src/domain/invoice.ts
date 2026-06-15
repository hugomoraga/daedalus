// Core aggregate: Invoice. State machine: issued -> sent -> paid (terminal).
// InvoiceOverdue is a FLAG (not a state) — the invoice can also be in `issued` or `sent`.
// paid is reachable from any non-paid state (per Spec 006 §5, Q2 resolution).

import type { EventIntent } from "./event.ts";
import { InvoiceIssued, InvoiceSent, InvoicePaid, InvoiceOverdue } from "./value-chain.ts";

export type InvoiceState = "issued" | "sent" | "paid";

export type Invoice = {
  id: string;
  tenantId: string;
  projectId: string;
  proposalId: string;
  amount: number;
  currency: string;
  state: InvoiceState;
  isOverdue: boolean;
  paidByPaymentId: string | null;
};

export function issueInvoice(input: {
  id: string;
  tenantId: string;
  projectId: string;
  proposalId: string;
  amount: number;
  currency: string;
}): { invoice: Invoice; events: EventIntent[] } {
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    throw new Error("Invoice amount must be a non-negative finite number");
  }
  if (input.currency.trim().length === 0) {
    throw new Error("Invoice currency is required");
  }
  const invoice: Invoice = {
    id: input.id,
    tenantId: input.tenantId,
    projectId: input.projectId,
    proposalId: input.proposalId,
    amount: input.amount,
    currency: input.currency,
    state: "issued",
    isOverdue: false,
    paidByPaymentId: null,
  };
  return {
    invoice,
    events: [
      {
        type: InvoiceIssued,
        payload: {
          invoiceId: input.id,
          projectId: input.projectId,
          proposalId: input.proposalId,
          amount: input.amount,
          currency: input.currency,
        },
      },
    ],
  };
}

export function sendInvoice(invoice: Invoice): { invoice: Invoice; events: EventIntent[] } {
  if (invoice.state === "sent" || invoice.state === "paid") {
    return { invoice, events: [] };
  }
  return {
    invoice: { ...invoice, state: "sent" },
    events: [{ type: InvoiceSent, payload: { invoiceId: invoice.id } }],
  };
}

export function payInvoice(
  invoice: Invoice,
  paymentId: string,
): { invoice: Invoice; events: EventIntent[] } {
  if (invoice.state === "paid") {
    // Idempotent on (invoiceId, paymentId) — reapplying the same payment is a no-op.
    // Applying a DIFFERENT payment to an already-paid invoice is rejected (Q3 alignment).
    if (invoice.paidByPaymentId === paymentId) return { invoice, events: [] };
    throw new Error(`Invoice ${invoice.id} is already paid by ${invoice.paidByPaymentId}; cannot apply ${paymentId}`);
  }
  if (paymentId.trim().length === 0) {
    throw new Error("paymentId is required to pay an invoice");
  }
  return {
    invoice: { ...invoice, state: "paid", paidByPaymentId: paymentId, isOverdue: false },
    events: [
      {
        type: InvoicePaid,
        payload: { invoiceId: invoice.id, paymentId, projectId: invoice.projectId, proposalId: invoice.proposalId },
      },
    ],
  };
}

export function overdueInvoice(invoice: Invoice): { invoice: Invoice; events: EventIntent[] } {
  if (invoice.state === "paid") {
    throw new Error(`Invoice ${invoice.id} is paid; cannot flag as overdue`);
  }
  // overdue is a flag, not a state — it can be re-flagged (the event is a fact that we noticed).
  return {
    invoice: { ...invoice, isOverdue: true },
    events: [{ type: InvoiceOverdue, payload: { invoiceId: invoice.id } }],
  };
}