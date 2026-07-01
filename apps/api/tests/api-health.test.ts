// apps/api/tests/api-health.test.ts
//
// Spec 016 §7 AC-6: health checks return a known shape.
//   GET /healthz — 200 { "status": "ok", "version": "<api-version>" }
//                   immediately, no external checks.
//   GET /readyz  — 200 { "status": "ready" } when the readiness probe
//                   reports ready; 503 { "error": "service_unavailable",
//                   "message": "<reason>", "requestId": "<uuid>" }
//                   otherwise. Anonymous (no Authorization required).
//
// Both probes are anonymous: tests assert no Authorization header
// is needed.

import { test } from "node:test";
import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { startServer } from "../src/server.ts";
import type { StartedServer, ReadinessProbe } from "../src/server.ts";
import { API_VERSION } from "../src/server.ts";

type Fetch = (
  method: "GET",
  path: string,
) => Promise<{ status: number; body: string; headers: Record<string, string> }>;

function startOnEphemeral(deps: Parameters<typeof startServer>[0]): Promise<StartedServer> {
  return startServer(deps, { PORT: "0" });
}

async function get(server: StartedServer, path: string): Promise<{
  status: number;
  body: string;
  headers: Record<string, string>;
}> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: "127.0.0.1",
        port: server.port,
        method: "GET",
        path,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            if (typeof v === "string") headers[k] = v;
            else if (Array.isArray(v)) headers[k] = v.join(", ");
          }
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
            headers,
          });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

const readyTrue = (): ReadinessProbe => async () => ({
  ready: true,
  reason: "test-pin: ready",
});
const readyFalse = (reason = "test-pin: unready"): ReadinessProbe => async () => ({
  ready: false,
  reason,
});

test("AC-6 /healthz returns 200 with status ok + api-version (anonymous)", async () => {
  const server = await startOnEphemeral({ readinessProbe: readyTrue() });
  try {
    const res = await get(server, "/healthz");
    assert.equal(res.status, 200);
    assert.equal(res.headers["content-type"], "application/json");
    const body = JSON.parse(res.body) as Record<string, unknown>;
    assert.equal(body.status, "ok");
    assert.equal(body.version, API_VERSION);
  } finally {
    await server.close();
  }
});

test("AC-6 /readyz returns 200 with status ready when probe reports ready (anonymous)", async () => {
  const server = await startOnEphemeral({ readinessProbe: readyTrue() });
  try {
    const res = await get(server, "/readyz");
    assert.equal(res.status, 200);
    assert.equal(res.headers["content-type"], "application/json");
    const body = JSON.parse(res.body) as Record<string, unknown>;
    assert.equal(body.status, "ready");
  } finally {
    await server.close();
  }
});

test("AC-6 /readyz returns 503 + service_unavailable envelope when probe is unready", async () => {
  const reason = "phase-A-test: store behind on a write lock";
  const server = await startOnEphemeral({ readinessProbe: readyFalse(reason) });
  try {
    const res = await get(server, "/readyz");
    assert.equal(res.status, 503);
    assert.equal(res.headers["content-type"], "application/json");
    const body = JSON.parse(res.body) as Record<string, unknown>;
    assert.equal(body.error, "service_unavailable");
    assert.equal(body.message, reason);
    assert.ok(typeof body.requestId === "string" && (body.requestId as string).length > 0);
  } finally {
    await server.close();
  }
});

test("/healthz and /readyz require no Authorization header (anonymous probes)", async () => {
  // Probe shape: a request with NO Authorization header succeeds on
  // both endpoints. Spec 016 §7 binds both probes to be auth-free.
  const server = await startOnEphemeral({ readinessProbe: readyTrue() });
  try {
    const h = await get(server, "/healthz");
    const r = await get(server, "/readyz");
    assert.equal(h.status, 200);
    assert.equal(r.status, 200);
  } finally {
    await server.close();
  }
});
