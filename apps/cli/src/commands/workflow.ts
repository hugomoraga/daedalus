import { appendIntents } from "@daedalus/core";
import { HumanApproved, HumanRejected } from "@daedalus/workflow-engine";
import type { CommandHandler } from "./types.ts";
import { requireOpt } from "./types.ts";

const humanApprove: CommandHandler = async ({ tenantId, values, deps }) => {
  const instanceId = requireOpt(values.instance, "instance");
  const workflowName = requireOpt(values.workflow, "workflow");
  const engineLineage = { correlationId: instanceId, causationId: null };
  await appendIntents(
    deps,
    tenantId,
    [
      {
        type: HumanApproved,
        payload: { workflowName, instanceId },
      },
    ],
    engineLineage,
  );
  console.log(`${HumanApproved}  workflow=${workflowName}  instance=${instanceId}`);
};

const humanReject: CommandHandler = async ({ tenantId, values, deps }) => {
  const instanceId = requireOpt(values.instance, "instance");
  const workflowName = requireOpt(values.workflow, "workflow");
  const reason = requireOpt(values.reason, "reason");
  const engineLineage = { correlationId: instanceId, causationId: null };
  await appendIntents(
    deps,
    tenantId,
    [
      {
        type: HumanRejected,
        payload: { workflowName, instanceId, reason },
      },
    ],
    engineLineage,
  );
  console.log(`${HumanRejected}  workflow=${workflowName}  instance=${instanceId}  reason="${reason}"`);
};

export const handlers: Array<[string, CommandHandler]> = [
  ["human:approve", humanApprove],
  ["human:reject", humanReject],
];
