// Node 22 native http server. Composition root for ATLAS.
// AC-1: read-only — non-GET/HEAD requests get 405 with the equivalent CLI command.
// AC-2: tenant isolation — unknown tenants fail closed.
// AC-7: server-side rendering; the browser never receives raw JSONL.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { resolveTenant } from "./tenant.ts";
import { readTenantEvents } from "./projections.ts";
import { renderPanel } from "./panels/register.ts";
import { renderLayout } from "./templates/layout.ts";

export type ServerOptions = {
  port?: number;
  host?: string;
};

function cliHintFor(route: string, tenantId: string): string {
  if (route.endsWith("/welcome")) {
    return `node apps/cli/src/index.ts events --tenant ${tenantId}`;
  }
  return `node apps/cli/src/index.ts events --tenant ${tenantId}`;
}

function rejectMethod(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const m = url.pathname.match(/^\/t\/([^/]+)\//);
  const tenantId = m !== null ? m[1] : "<tenant>";
  res.writeHead(405, { "content-type": "application/json" });
  res.end(
    JSON.stringify({
      error: "read-only",
      cliCommand: cliHintFor(url.pathname, tenantId),
      hint: "ATLAS is read-only by construction. Use the Daedalus CLI to mutate state.",
    }),
  );
}

function notFound(res: ServerResponse, msg: string): void {
  res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  res.end(msg);
}

export function createAtlasServer(opts: ServerOptions = {}) {
  const port = opts.port ?? 8788;
  const host = opts.host ?? "127.0.0.1";
  const server = createServer(async (req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      rejectMethod(req, res);
      return;
    }
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? `localhost:${port}`}`);
    const m = url.pathname.match(/^\/t\/([^/]+)\/([a-z-]+)\/?$/);
    if (m === null) {
      notFound(res, "not found");
      return;
    }
    const tenantId = m[1];
    const panelSlug = m[2];
    const tenant = resolveTenant(tenantId);
    if (tenant === null) {
      notFound(res, `unknown tenant: ${tenantId}`);
      return;
    }
    const events = await readTenantEvents(tenant.tenantId);
    const panelHtml = renderPanel(panelSlug, { tenant, events });
    if (panelHtml === null) {
      notFound(res, `panel not registered: ${panelSlug}`);
      return;
    }
    const html = renderLayout({ tenant, panelName: panelSlug, panelHtml });
    if (req.method === "HEAD") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "content-length": Buffer.byteLength(html, "utf8") });
      res.end();
      return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  });
  return { server, port, host };
}