// apps/api/src/router.ts
//
// Top-level router (Spec 016 §4 + Plan §1).
//
// v0 routes (T-01):
//   GET  /healthz        — anonymous (liveness)
//   GET  /readyz         — anonymous (readiness)
//   GET  /openapi.json   — anonymous (OpenAPI 3.1 document)
//
// Phase A additions (next PRs, not this one):
//   GET  /v1/tenants/:tenantId/events[/:eventId]
//   GET  /v1/tenants/:tenantId/projections/:name
//   GET  /v1/tenants/:tenantId/obligations
//   GET  /v1/tenants/:tenantId/workflows/instances[/:id]
//
// Phase B (gated on Spec 009 HTTP wiring):
//   POST /v1/tenants/:tenantId/commands/:useCase
//
// The router dispatches by exact path match — no tree, no
// regexes. v0 has only three paths so an exact match is simpler
// than a tree and easier to reason about. A future T-NN moves
// to a path-pattern router (the `/v1/tenants/:tenantId/...`
// patterns need capturing) — until then, exact match is the
// clearest form.

import type { IncomingMessage, ServerResponse } from "node:http";
import { handleHealth, handleReady, API_VERSION } from "./routes/health.ts";
import { handleOpenApi } from "./routes/openapi.ts";
import type { ReadinessProbe } from "./readiness.ts";
import { newRequestId } from "./lineage.ts";
import { renderError, errors } from "./errors.ts";

export type RouterDeps = {
  readinessProbe: ReadinessProbe;
  // Phase A additions land here as explicit `?:` fields above
  // are filled in by the matching PR. Keeping `readinessProbe`
  // for now is the minimum T-01 needs to satisfy AC-6.
};

export type RouterHandler = (
  req: IncomingMessage,
  res: ServerResponse,
) => Promise<void> | void;

export function createRouter(deps: RouterDeps): RouterHandler {
  return async (req, res) => {
    const method = (req.method ?? "GET").toUpperCase();
    const url = req.url ?? "/";
    const requestId = newRequestId();
    res.setHeader("x-request-id", requestId);

    // /healthz
    if (method === "GET" && url === "/healthz") {
      await handleHealth(req, res);
      return;
    }
    // /readyz
    if (method === "GET" && url === "/readyz") {
      await handleReady(req, res, deps.readinessProbe);
      return;
    }
    // /openapi.json
    if (method === "GET" && url === "/openapi.json") {
      await handleOpenApi(req, res);
      return;
    }

    // Unknown route → 404 with the canonical envelope.
    res.statusCode = 404;
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify(
        renderError(errors.notFound(`no route for ${method} ${url}`), requestId),
      ),
    );
  };
}

export { API_VERSION };
