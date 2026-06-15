// Use case: close a Project. Requires delivered state; unpaid invoices require an explicit reason.

import type { CoreDeps } from "./deps.ts";
import { appendIntents, startLineage } from "./lineage.ts";
import { closeProject } from "../domain/project.ts";
import { hasUnpaidInvoices, projectProject } from "./projections.ts";

export type CloseProjectCommand = {
  tenantId: string;
  projectId: string;
  reason?: string;
};

export async function closeProjectUseCase(
  deps: CoreDeps,
  cmd: CloseProjectCommand,
): Promise<{ changed: boolean }> {
  const events = await deps.eventStore.readStream(cmd.tenantId);
  const project = projectProject(events, cmd.projectId);
  if (project === null) {
    throw new Error(`Project ${cmd.projectId} not found in tenant ${cmd.tenantId}`);
  }
  const unpaid = hasUnpaidInvoices(events, project.proposalId);
  const { events: intents } = closeProject(project, cmd.reason ?? null, unpaid);
  if (intents.length === 0) return { changed: false };
  await appendIntents(deps, cmd.tenantId, intents, startLineage(deps.newId));
  return { changed: true };
}