// Use case: mark a Project as delivered. Idempotent.

import type { CoreDeps } from "./deps.ts";
import { appendIntents, startLineage } from "./lineage.ts";
import { deliverProject } from "../domain/project.ts";
import { projectProject } from "./projections.ts";

export type DeliverProjectCommand = {
  tenantId: string;
  projectId: string;
};

export async function markProjectDeliveredUseCase(
  deps: CoreDeps,
  cmd: DeliverProjectCommand,
): Promise<{ changed: boolean }> {
  const events = await deps.eventStore.readStream(cmd.tenantId);
  const project = projectProject(events, cmd.projectId);
  if (project === null) {
    throw new Error(`Project ${cmd.projectId} not found in tenant ${cmd.tenantId}`);
  }
  const { events: intents } = deliverProject(project);
  if (intents.length === 0) return { changed: false };
  await appendIntents(deps, cmd.tenantId, intents, startLineage(deps.newId));
  return { changed: true };
}