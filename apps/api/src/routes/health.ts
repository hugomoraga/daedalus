// apps/api/src/routes/health.ts
//
// Health checks per Spec 016 §7 AC-6.
//
//   GET /healthz — liveness; returns 200 { "status": "ok",
//     "version": "<api-version>" } immediately (no external
//     checks). Anonymous.
//
//   GET /readyz — readiness; returns 200 if the event store
//     is reachable and projections can be computed. Otherwise
//     503 with a body explaining the failed check. Anonymous.
//
// Both routes are intentionally minimal — they probe the
// process and the configured event store, nothing else, so a
// /readyz failure signals "cannot serve the v0 read surface"
// rather than a transient downstream blip.

import type { IncomingMessage, ServerResponse } from "node:http";
import { newRequestId } from "../lineage.ts";
import { renderError, errors } from "../errors.ts";
import type { ReadinessProbe } from "../readiness.ts";

export const API_VERSION = "0.0.0";

export async function handleHealth(
  _req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  res.statusCode = 200;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ status: "ok", version: API_VERSION }));
}

export async function handleReady(
  _req: IncomingMessage,
  res: ServerResponse,
  probe: ReadinessProbe,
): Promise<void> {
  const requestId = newRequestId();
  try {
    const result = await probe();
    if (!result.ready) {
      res.statusCode = 503;
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify(
          renderError(errors.serviceUnavailable(result.reason), requestId),
        ),
      );
      return;
    }
    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ status: "ready" }));
  } catch (err) {
    res.statusCode = 503;
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify(
        renderError(
          errors.serviceUnavailable(
            `readiness check threw: ${err instanceof Error ? err.message : String(err)}`,
          ),
          requestId,
        ),
      ),
    );
  }
}
