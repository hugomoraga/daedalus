// apps/api/tests/api-openapi.test.ts
//
// Spec 016 §8 AC-7 — partial coverage in T-01:
//   GET /openapi.json returns a valid OpenAPI 3.1 document that
//   contains the routes this PR ships. Each new endpoint that
//   lands in subsequent Phase A / B / C PRs must add a matching
//   entry in src/openapi.json (which is also referenced from
//   this file in later test expansions).
//
// Full OpenAPI 3.1 schema validation (a JSON-Schema test against
// the OpenAPI meta-schema) lands with the route cross-check
// in a later PR. T-01 covers the *shape invariants* the spec
// already commits us to:

import { test } from "node:test";
import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { startServer } from "../src/server.ts";
import type { StartedServer, ReadinessProbe } from "../src/server.ts";

const readyTrue = (): ReadinessProbe => async () => ({
  ready: true,
  reason: "test-pin: ready",
});

async function get(
  server: StartedServer,
  path: string,
): Promise<{ status: number; body: string }> {
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
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

test("AC-7 (T-01 slice): GET /openapi.json returns OpenAPI 3.1", async () => {
  const server = await startServer({ readinessProbe: readyTrue() }, { PORT: "0" });
  try {
    const res = await get(server, "/openapi.json");
    assert.equal(res.status, 200);
    const doc = JSON.parse(res.body) as { openapi?: string; info?: { version?: string }; paths?: Record<string, unknown> };
    assert.equal(doc.openapi, "3.1.0");
    assert.ok(doc.info, "OpenAPI document must carry an info block");
    assert.equal(doc.info?.version, "0.0.0");
  } finally {
    await server.close();
  }
});

test("AC-7 (T-01 slice): the OpenAPI document declares every route T-01 ships", async () => {
  const server = await startServer({ readinessProbe: readyTrue() }, { PORT: "0" });
  try {
    const res = await get(server, "/openapi.json");
    const doc = JSON.parse(res.body) as { paths?: Record<string, Record<string, unknown>> };
    assert.ok(doc.paths, "paths block required");
    assert.ok(doc.paths?.["/healthz"], "/healthz must be documented");
    assert.ok(doc.paths?.["/readyz"], "/readyz must be documented");
    assert.ok(doc.paths?.["/openapi.json"], "/openapi.json must be documented");
  } finally {
    await server.close();
  }
});
