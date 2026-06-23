// Theia (Spec 012) — HTTP server (PR 8).
//
// `createTheiaServer({ port, host, root })` returns a `node:http`
// server bound to `host:port`. Routes:
//   - GET /             → overview view
//   - GET /specs/:slug  → spec detail view
//   - GET /phases/:n    → phase detail view (UX-005)
//   - GET /healthz      → 200 OK JSON
//   - any other path    → 404
//   - non-GET method    → 405 (AC-5 / AC-12: read-only by construction)
//
// The server is the composition root: it owns the parser state and
// awaits `pendingTests` on each request so the Tests panel updates
// without a server restart (AC-8).

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { renderOverview } from "./views/overview.ts";
import { renderSpecDetail } from "./views/spec.ts";
import { renderPhaseDetail } from "./views/phase.ts";
import type { ProjectState, TestResult } from "./types.ts";
import { parseRepo } from "./parser.ts";

export type TheiaServerOptions = {
  port: number;
  host: string;
  root: string;
};

export type TheiaServer = {
  listen: () => Promise<void>;
  close: () => Promise<void>;
  // Underlying http.Server, exposed for tests + advanced consumers
  // that need the actual address (port=0 → OS picks).
  httpServer: import("node:http").Server;
};

const REJECT_HOSTS = new Set(["0.0.0.0", "::"]);

export async function createTheiaServer(opts: TheiaServerOptions): Promise<TheiaServer> {
  if (REJECT_HOSTS.has(opts.host)) {
    throw new Error(`Theia binds to 127.0.0.1 only. Rejecting ${opts.host}.`);
  }

  // Parse once at startup. The server's response layer awaits the
  // pendingTests promise on each request to render the current Tests
  // panel state without a server restart.
  const result = await parseRepo(opts.root);
  let state: ProjectState = result.state;
  const pendingTests: Promise<TestResult> = result.pendingTests;

  // Track the latest test result. Updated when `pendingTests` resolves.
  let latestTests: TestResult = state.tests;
  void pendingTests.then((r) => {
    latestTests = r;
  });

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      await handle(req, res, () => state, () => latestTests, opts.root);
    } catch (err) {
      respondJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
  });

  return {
    listen: () => new Promise<void>((resolve, reject) => {
      const onError = (err: Error) => {
        server.off("listening", onListen);
        reject(err);
      };
      const onListen = () => {
        server.off("error", onError);
        resolve();
      };
      server.once("error", onError);
      server.once("listening", onListen);
      server.listen(opts.port, opts.host);
    }),
    close: () => new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err !== undefined) reject(err);
        else resolve();
      });
    }),
    httpServer: server,
  };
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  state: () => ProjectState,
  latestTests: () => TestResult,
  _root: string,
): Promise<void> {
  const method = req.method ?? "GET";
  const url = req.url ?? "/";

  // AC-12: non-GET → 405 with read-only hint.
  if (method !== "GET") {
    respondText(res, 405, "Method Not Allowed — Theia is read-only.");
    return;
  }

  // Route table.
  if (url === "/healthz") {
    respondJson(res, 200, { status: "ok", tests: latestTests() });
    return;
  }
  if (url === "/" || url === "/index.html") {
    // Inject the latest test snapshot into the rendered state.
    const snapshot: ProjectState = { ...state(), tests: latestTests() };
    respondText(res, 200, renderOverview(snapshot), "text/html; charset=utf-8");
    return;
  }
  const specMatch = /^\/specs\/([^/?#]+)\/?$/.exec(url);
  if (specMatch !== null) {
    const slug = decodeURIComponent(specMatch[1] ?? "");
    const snapshot: ProjectState = { ...state(), tests: latestTests() };
    respondText(res, 200, renderSpecDetail(slug, snapshot), "text/html; charset=utf-8");
    return;
  }
  const phaseMatch = /^\/phases\/(\d+)\/?$/.exec(url);
  if (phaseMatch !== null) {
    const n = Number(phaseMatch[1] ?? "");
    if (!Number.isInteger(n) || n < 0) {
      respondText(res, 404, "Not Found");
      return;
    }
    const snapshot: ProjectState = { ...state(), tests: latestTests() };
    const phase = snapshot.phases.find((p) => p.number === n);
    if (phase === undefined) {
      // Unknown phase: render the detail view's "not found" page so
      // the response stays HTML (consistent with the spec detail
      // pattern) rather than a plain text 404.
      respondText(res, 404, renderPhaseDetail(n, snapshot), "text/html; charset=utf-8");
      return;
    }
    respondText(res, 200, renderPhaseDetail(n, snapshot), "text/html; charset=utf-8");
    return;
  }

  respondText(res, 404, "Not Found");
}

function respondJson(res: ServerResponse, code: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(json),
  });
  res.end(json);
}

function respondText(res: ServerResponse, code: number, body: string, contentType = "text/plain; charset=utf-8"): void {
  res.writeHead(code, {
    "content-type": contentType,
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}