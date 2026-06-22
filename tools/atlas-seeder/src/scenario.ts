// Scenario — the events the seeder emits. Pure data.
//
// Each entry has:
//   - key:      a unique lookup key that OTHER entries can reference via `causes`.
//               This is independent of payload entity ids (which can collide
//               across events in a flow: every value-chain event after LeadCreated
//               also carries the leadId in payload).
//   - type:     the event type (from the catalog).
//   - payload:  the event payload (matches real @daedalus/core shapes).
//   - causes:   either null (start a fresh correlation) or another entry's `key`
//               (derive: share correlation, set causationId = that entry's eventId).
//   - daysAgo / hourOfDay: occurredAt offset from todayUtcMidnight.
//   - actor:    the actor recorded on the event.
//
// To extend: add a new entry with a unique `key`, point downstream `causes`
// at it, and never share a key with another entry.

export type ScenarioEvent = {
  readonly key: string;
  readonly type: string;
  readonly payload: Record<string, unknown>;
  readonly causes: string | null;
  readonly daysAgo: number;
  readonly hourOfDay: number;
  readonly actor: string;
};

// Stable entity ids (referenced in payloads only; not used as `key`/`causes`).
const E = {
  LEAD_1: "lead-acme-001",
  LEAD_2: "lead-startup-002",
  PROPOSAL_1: "prop-acme-001",
  PROJECT_1: "proj-acme-001",
  INVOICE_1: "inv-acme-001",
  PAYMENT_1: "pay-acme-001",
  ESTIMATE_1: "est-acme-001",
  EXPENSE_1: "exp-tools-001",
  EXPENSE_2: "exp-hosting-002",
} as const;

const AMOUNT_PROPOSAL = 1_250_000;
const AMOUNT_EXPENSE_TOOLS = 89_900;
const AMOUNT_EXPENSE_HOSTING = 45_000;

export const SCENARIO: ReadonlyArray<ScenarioEvent> = [
  // --- Story A: full Lead → Paid arc ---
  {
    key: "evt:lead-acme:created",
    type: "LeadCreated",
    payload: { leadId: E.LEAD_1, customer: "Acme SpA", contact: "cto@acme.example", opportunityId: "opp-acme-001" },
    causes: null,
    daysAgo: 9,
    hourOfDay: 9,
    actor: "founder",
  },
  {
    key: "evt:lead-acme:qualified",
    type: "LeadQualified",
    payload: { leadId: E.LEAD_1 },
    causes: "evt:lead-acme:created",
    daysAgo: 8,
    hourOfDay: 11,
    actor: "founder",
  },
  {
    key: "evt:proposal-acme:generated",
    type: "ProposalGenerated",
    payload: {
      proposalId: E.PROPOSAL_1,
      leadId: E.LEAD_1,
      draftId: "draft-acme-001",
      expectedValue: AMOUNT_PROPOSAL,
    },
    causes: "evt:lead-acme:qualified",
    daysAgo: 7,
    hourOfDay: 10,
    actor: "founder",
  },
  {
    key: "evt:proposal-acme:submitted",
    type: "ProposalSubmitted",
    payload: { proposalId: E.PROPOSAL_1 },
    causes: "evt:proposal-acme:generated",
    daysAgo: 6,
    hourOfDay: 16,
    actor: "founder",
  },
  {
    key: "evt:proposal-acme:approved",
    type: "ProposalApproved",
    payload: { proposalId: E.PROPOSAL_1, leadId: E.LEAD_1, expectedValue: AMOUNT_PROPOSAL },
    causes: "evt:proposal-acme:submitted",
    daysAgo: 5,
    hourOfDay: 14,
    actor: "customer-acme",
  },
  {
    key: "evt:project-acme:created",
    type: "ProjectCreated",
    payload: { projectId: E.PROJECT_1, proposalId: E.PROPOSAL_1, leadId: E.LEAD_1, name: "Acme — Atlas rollout" },
    causes: "evt:proposal-acme:approved",
    daysAgo: 5,
    hourOfDay: 15,
    actor: "founder",
  },
  {
    key: "evt:project-acme:delivered",
    type: "ProjectDelivered",
    payload: { projectId: E.PROJECT_1 },
    causes: "evt:project-acme:created",
    daysAgo: 2,
    hourOfDay: 17,
    actor: "founder",
  },
  {
    key: "evt:invoice-acme:issued",
    type: "InvoiceIssued",
    payload: { invoiceId: E.INVOICE_1, projectId: E.PROJECT_1, proposalId: E.PROPOSAL_1, amount: AMOUNT_PROPOSAL, currency: "CLP" },
    causes: "evt:project-acme:delivered",
    daysAgo: 2,
    hourOfDay: 18,
    actor: "founder",
  },
  {
    key: "evt:invoice-acme:sent",
    type: "InvoiceSent",
    payload: { invoiceId: E.INVOICE_1 },
    causes: "evt:invoice-acme:issued",
    daysAgo: 2,
    hourOfDay: 18,
    actor: "founder",
  },
  {
    key: "evt:payment-acme:received",
    type: "PaymentReceived",
    payload: { paymentId: E.PAYMENT_1, invoiceId: E.INVOICE_1, amount: AMOUNT_PROPOSAL, currency: "CLP" },
    causes: "evt:invoice-acme:sent",
    daysAgo: 0,
    hourOfDay: 10,
    actor: "founder",
  },
  {
    key: "evt:invoice-acme:paid",
    type: "InvoicePaid",
    payload: { invoiceId: E.INVOICE_1, paymentId: E.PAYMENT_1, projectId: E.PROJECT_1, proposalId: E.PROPOSAL_1 },
    causes: "evt:payment-acme:received",
    daysAgo: 0,
    hourOfDay: 11,
    actor: "founder",
  },
  {
    key: "evt:project-acme:closed",
    type: "ProjectClosed",
    payload: { projectId: E.PROJECT_1, reason: "delivered and paid" },
    causes: "evt:invoice-acme:paid",
    daysAgo: 0,
    hourOfDay: 12,
    actor: "founder",
  },

  // --- Revenue Visibility: estimate derived from ProposalApproved ---
  // Cross-module derived event: shares correlationId with Story A and uses
  // ProposalApproved's eventId as causationId. This is the followFrom() seam.
  {
    key: "evt:estimate-acme:created",
    type: "RevenueEstimateCreated",
    payload: {
      estimateId: E.ESTIMATE_1,
      sourceProposalId: E.PROPOSAL_1,
      amount: AMOUNT_PROPOSAL,
      currency: "CLP",
      state: "expected",
    },
    causes: "evt:proposal-acme:approved",
    daysAgo: 5,
    hourOfDay: 14,
    actor: "revenue-visibility",
  },
  {
    key: "evt:estimate-acme:confirmed",
    type: "RevenueConfirmed",
    payload: {
      estimateId: E.ESTIMATE_1,
      sourceProposalId: E.PROPOSAL_1,
      amount: AMOUNT_PROPOSAL,
      currency: "CLP",
      state: "confirmed",
    },
    causes: "evt:estimate-acme:created",
    daysAgo: 2,
    hourOfDay: 17,
    actor: "revenue-visibility",
  },
  {
    key: "evt:risk:revenue-concentration",
    type: "FinancialRiskFlagged",
    payload: {
      ruleId: "revenue_concentration",
      threshold: 0.6,
      actual: 0.93,
    },
    causes: "evt:estimate-acme:confirmed",
    daysAgo: 2,
    hourOfDay: 17,
    actor: "revenue-visibility",
  },

  // --- Expenses (independent events, each starts a fresh correlation) ---
  {
    key: "evt:expense:tools",
    type: "ExpenseRegistered",
    payload: {
      expenseId: E.EXPENSE_1,
      label: "Dev tools subscription",
      amount: AMOUNT_EXPENSE_TOOLS,
      currency: "CLP",
      occurredAt: "2026-06-15T00:00:00.000Z",
    },
    causes: null,
    daysAgo: 6,
    hourOfDay: 9,
    actor: "founder",
  },
  {
    key: "evt:expense:hosting",
    type: "ExpenseRegistered",
    payload: {
      expenseId: E.EXPENSE_2,
      label: "Hosting & domain",
      amount: AMOUNT_EXPENSE_HOSTING,
      currency: "CLP",
      occurredAt: "2026-06-20T00:00:00.000Z",
    },
    causes: null,
    daysAgo: 1,
    hourOfDay: 9,
    actor: "founder",
  },

  // --- Story B: a discarded lead (diversity — Activity / Throughput) ---
  {
    key: "evt:lead-startup:created",
    type: "LeadCreated",
    payload: { leadId: E.LEAD_2, customer: "StartupXYZ", contact: "founder@startupxyz.example", opportunityId: "opp-startup-002" },
    causes: null,
    daysAgo: 7,
    hourOfDay: 13,
    actor: "founder",
  },
  {
    key: "evt:lead-startup:discarded",
    type: "LeadDiscarded",
    payload: { leadId: E.LEAD_2, reason: "Out of scope for current capacity" },
    causes: "evt:lead-startup:created",
    daysAgo: 6,
    hourOfDay: 15,
    actor: "founder",
  },
];
