// Read-only contract — Spec 007 AC-1.
// Every non-GET/HEAD request gets 405 with a body that names the CLI command.

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { request } from "node:http";
import type { Server } from "node:http";
import { createAtlasServer } from "../src/server.ts";
import { useTempDataDir } from "./helpers.ts";

before(async () => {
  await useTempDataDir();
});

function req(server: Server, path: string, method: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    if (addr === null || typeof addr === "string") return reject(new Error("not listening"));
    const r = request(
      { hostname: "127.0.0.1", port: addr.port, path, method },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c as Buffer));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
      },
    );
    r.on("error", reject);
    r.end();
  });
}

test("atlas AC-1: POST returns 405 with read-only error and CLI hint", async () => {
  const { server } = createAtlasServer({ port: 0 });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  try {
    const res = await req(server, "/t/tenant-0/welcome", "POST");
    assert.equal(res.status, 405);
    const body = JSON.parse(res.body);
    assert.equal(body.error, "read-only");
    assert.match(body.cliCommand, /apps\/cli\/src\/index\.ts/);
  } finally {
    server.close();
  }
});

test("atlas AC-1: PUT, DELETE, PATCH all return 405", async () => {
  const { server } = createAtlasServer({ port: 0 });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  try {
    for (const m of ["PUT", "DELETE", "PATCH"]) {
      const res = await req(server, "/t/tenant-0/welcome", m);
      assert.equal(res.status, 405, `${m} should be 405`);
    }
  } finally {
    server.close();
  }
});

test("atlas AC-1: GET and HEAD succeed", async () => {
  const { server } = createAtlasServer({ port: 0 });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  try {
    const g = await req(server, "/t/tenant-0/welcome", "GET");
    assert.equal(g.status, 200);
    const h = await req(server, "/t/tenant-0/welcome", "HEAD");
    assert.equal(h.status, 200);
  } finally {
    server.close();
  }
});