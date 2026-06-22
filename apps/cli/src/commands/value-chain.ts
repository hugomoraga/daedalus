import {
  recordPaymentReceivedUseCase,
  createProjectUseCase,
  markProjectDeliveredUseCase,
  closeProjectUseCase,
  issueInvoiceUseCase,
  sendInvoiceUseCase,
  payInvoiceUseCase,
  markInvoiceOverdueUseCase,
  projectProject,
  projectInvoice,
} from "@daedalus/core";
import type { CommandHandler } from "./types.ts";
import { requireOpt, tenantCurrency } from "./types.ts";

const paymentRecord: CommandHandler = async ({ tenantId, values, deps }) => {
  const proposalId = requireOpt(values.proposal, "proposal");
  const paymentId = requireOpt(values.payment, "payment");
  const amount = Number(requireOpt(values.amount, "amount"));
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("--amount must be a positive number");
  const currency = tenantCurrency(tenantId);
  await recordPaymentReceivedUseCase(deps, { tenantId, proposalId, paymentId, amount, currency });
  console.log(`PaymentReceived  proposal=${proposalId}  payment=${paymentId}  ${amount} ${currency}`);
};

const projectCreate: CommandHandler = async ({ tenantId, values, deps }) => {
  const out = await createProjectUseCase(deps, { tenantId, proposalId: requireOpt(values.proposal, "proposal") });
  console.log(out.created ? `ProjectCreated  project=${out.projectId}` : `project already exists  proposal=${values.proposal}`);
};

const projectDeliver: CommandHandler = async ({ tenantId, values, deps }) => {
  const out = await markProjectDeliveredUseCase(deps, { tenantId, projectId: requireOpt(values.project, "project") });
  console.log(out.changed ? `ProjectDelivered  project=${values.project}` : `already delivered  project=${values.project}`);
};

const projectClose: CommandHandler = async ({ tenantId, values, deps }) => {
  const out = await closeProjectUseCase(deps, {
    tenantId,
    projectId: requireOpt(values.project, "project"),
    reason: values.reason,
  });
  console.log(out.changed ? `ProjectClosed  project=${values.project}` : `already closed  project=${values.project}`);
};

const projectStatus: CommandHandler = async ({ tenantId, values, deps }) => {
  const events = await deps.eventStore.readStream(tenantId);
  const p = projectProject(events, requireOpt(values.project, "project"));
  if (p === null) throw new Error(`Project ${values.project} not found`);
  console.log(JSON.stringify(p, null, 2));
};

const invoiceIssue: CommandHandler = async ({ tenantId, values, deps }) => {
  const out = await issueInvoiceUseCase(deps, { tenantId, projectId: requireOpt(values.project, "project") });
  console.log(out.created ? `InvoiceIssued  invoice=${out.invoiceId}` : `invoice already exists  project=${values.project}`);
};

const invoiceSend: CommandHandler = async ({ tenantId, values, deps }) => {
  const out = await sendInvoiceUseCase(deps, { tenantId, invoiceId: requireOpt(values.invoice, "invoice") });
  console.log(out.changed ? `InvoiceSent  invoice=${values.invoice}` : `already sent  invoice=${values.invoice}`);
};

const invoicePay: CommandHandler = async ({ tenantId, values, deps }) => {
  const out = await payInvoiceUseCase(deps, {
    tenantId,
    invoiceId: requireOpt(values.invoice, "invoice"),
    paymentId: requireOpt(values.payment, "payment"),
  });
  console.log(out.changed ? `InvoicePaid  invoice=${values.invoice}` : `already paid  invoice=${values.invoice}`);
};

const invoiceOverdue: CommandHandler = async ({ tenantId, values, deps }) => {
  await markInvoiceOverdueUseCase(deps, { tenantId, invoiceId: requireOpt(values.invoice, "invoice") });
  console.log(`InvoiceOverdue  invoice=${values.invoice}`);
};

const invoiceStatus: CommandHandler = async ({ tenantId, values, deps }) => {
  const events = await deps.eventStore.readStream(tenantId);
  const i = projectInvoice(events, requireOpt(values.invoice, "invoice"));
  if (i === null) throw new Error(`Invoice ${values.invoice} not found`);
  console.log(JSON.stringify(i, null, 2));
};

export const handlers: Array<[string, CommandHandler]> = [
  ["payment:record", paymentRecord],
  ["project:create", projectCreate],
  ["project:deliver", projectDeliver],
  ["project:close", projectClose],
  ["project:status", projectStatus],
  ["invoice:issue", invoiceIssue],
  ["invoice:send", invoiceSend],
  ["invoice:pay", invoicePay],
  ["invoice:overdue", invoiceOverdue],
  ["invoice:status", invoiceStatus],
];
