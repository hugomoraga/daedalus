// Smoke test: the v0.1 server compiles, the panel renders, the read-only contract holds.
// Full AC-1..AC-8 test suite lands in v0.4.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createAtlasServer } from "../src/server.ts";
import { request } from "node:http";

function get(server: import("node:http").Server, path: string, method: string = "GET"): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    if (addr === null || typeof addr === "string") {
      reject(new Error("server not listening"));
      return;
    }
    const req = request(
      { hostname: "127.0.0.1", port: addr.port, path, method },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c as Buffer));
        res.on("end", () =>
          resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }),
        );
      },
    );
    req.on("error", reject);
    req.end();
  });
}

test("atlas v0.1: server returns 200 for /t/tenant-0/welcome", async () => {
  const { server } = createAtlasServer({ port: 0 });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  try {
    const res = await get(server, "/t/tenant-0/welcome");
    assert.equal(res.status, 200);
    assert.match(res.body, /ATLAS/);
    assert.match(res.body, /Welcome/);
    assert.match(res.body, /tenant-0/);
  } finally {
    server.close();
  }
});

test("atlas v0.1: read-only — POST returns 405 with cliCommand", async () => {
  const { server } = createAtlasServer({ port: 0 });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  try {
    const res = await get(server, "/t/tenant-0/welcome", "POST");
    assert.equal(res.status, 405);
    const body = JSON.parse(res.body);
    assert.equal(body.error, "read-only");
    assert.match(body.cliCommand, /apps\/cli/);
  } finally {
    server.close();
  }
});

test("atlas v0.1: unknown tenant returns 404", async () => {
  const { server } = createAtlasServer({ port: 0 });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  try {
    const res = await get(server, "/t/no-such-tenant/welcome");
    assert.equal(res.status, 404);
  } finally {
    server.close();
  }
});

test("atlas v0.1: unknown panel returns 404 (AC-6 — absent, not empty)", async () => {
  const { server } = createAtlasServer({ port: 0 });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  try {
    const res = await get(server, "/t/tenant-0/health");
    assert.equal(res.status, 404);
  } finally {
    server.close();
  }
});