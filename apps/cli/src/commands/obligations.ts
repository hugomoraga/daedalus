// CLI: obligations:* — list, ack, sweep obligation lifecycle events for a tenant.
// NO business logic lives here (per CommandContext pattern). Each command
// just parses args, dispatches to a use case in @daedalus/tax-compliance-guard,
// and renders the result.

import {
  acknowledgeObligationUseCase,
  listObligationsUseCase,
  ObligationNotPending,
  sweepDeadlinesUseCase,
  UnknownObligation,
  watchFinancialEventsUseCase,
  type ObligorState,
} from "@daedalus/tax-compliance-guard";
import {
  InvoiceIssued,
  InvoicePaid,
  PaymentReceived,
  type CoreDeps,
  type DomainEvent,
} from "@daedalus/core";
import type { CommandHandler } from "./types.ts";
import { requireOpt } from "./types.ts";

// Known financial trigger event types (Spec 004 §3.1).
// Spec 004 keeps the trigger vocabulary small on purpose: the Module
// doesn't invent triggers; it consumes the Core value-chain vocabulary.
const FINANCIAL_TRIGGERS: readonly string[] = [
  PaymentReceived,
  InvoiceIssued,
  InvoicePaid,
];

const obligationsList: CommandHandler = async ({ tenantId, values, deps }) => {
  const watch = values.watch === true;

  if (watch) {
    // Run the watcher over the most recent event of each known financial
    // trigger type. Idempotent at the state-derivation level (first
    // ObligationDue wins per obligationId).
    const events = await deps.eventStore.readStream(tenantId);
    const latestByType = new Map<string, DomainEvent>();
    for (const event of events) {
      if (!FINANCIAL_TRIGGERS.includes(event.type)) continue;
      const existing = latestByType.get(event.type);
      if (existing === undefined || existing.occurredAt < event.occurredAt) {
        latestByType.set(event.type, event);
      }
    }
    for (const trigger of latestByType.values()) {
      await watchFinancialEventsUseCase(deps as Parameters<typeof watchFinancialEventsUseCase>[0], {
        trigger,
        actor: deps.actor,
      });
    }
  }

  const result = await listObligationsUseCase(deps as Parameters<typeof listObligationsUseCase>[0], {
    tenantId,
  });
  if (result.obligations.length === 0) {
    console.log(`(no obligations tracked for tenant ${tenantId})`);
    return;
  }
  const headers = ["obligation", "rule", "due", "status", "trigger", "evaluation"];
  const lines = [headers.join("\t")];
  for (const o of result.obligations) {
    lines.push(formatRow(o));
  }
  console.log(lines.join("\n"));
  console.log(`asOf=${result.asOf}  obligations=${result.obligations.length}`);
};

const obligationsAck: CommandHandler = async ({ tenantId, values, deps }) => {
  const obligationId = requireOpt(values.obligation, "obligation");
  const dueEventId = requireOpt(values["due-event"], "due-event");
  const notes = values.notes;
  try {
    const result = await acknowledgeObligationUseCase(
      deps as Parameters<typeof acknowledgeObligationUseCase>[0],
      {
        tenantId,
        obligationId,
        dueEventId,
        actor: deps.actor,
        ...(notes !== undefined ? { notes } : {}),
      },
    );
    console.log(
      `ObligationMet  tenant=${tenantId}  obligation=${obligationId}  eventId=${result.event.eventId}`,
    );
  } catch (e) {
    if (e instanceof UnknownObligation) {
      console.error(`error: ${e.message}`);
      process.exitCode = 2;
      return;
    }
    if (e instanceof ObligationNotPending) {
      console.error(`error: ${e.message}`);
      process.exitCode = 2;
      return;
    }
    throw e;
  }
};

const obligationsSweep: CommandHandler = async ({ tenantId, deps }) => {
  const result = await sweepDeadlinesUseCase(
    deps as Parameters<typeof sweepDeadlinesUseCase>[0],
    { tenantId, actor: deps.actor },
  );
  console.log(
    `obligations:sweep  tenant=${tenantId}  scanned=${result.scanned}  missed=${result.missed}`,
  );
  for (const id of result.missedObligationIds) {
    console.log(`  ObligationMissed  obligation=${id}`);
  }
  void (deps as CoreDeps);
};

function formatRow(o: ObligorState): string {
  const evalCol = o.lastEvaluation !== undefined
    ? `${o.lastEvaluation.outcome}(${o.lastEvaluation.reason})`
    : "-";
  return [
    o.obligationId,
    `${o.ruleSetId}@${o.ruleSetVersion}`,
    o.dueAt,
    o.status,
    o.triggerEventType,
    evalCol,
  ].join("\t");
}

export const handlers: Array<[string, CommandHandler]> = [
  ["obligations:list", obligationsList],
  ["obligations:ack", obligationsAck],
  ["obligations:sweep", obligationsSweep],
];
