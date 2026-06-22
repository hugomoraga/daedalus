// Theia (Spec 012) — server tests (PR 8).
//
// Covers AC-12 (local-only binding: 127.0.0.1 only, reject 0.0.0.0)
// + read-only by construction (non-GET → 405).

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { createTheiaServer } from "../src/server.ts";

const FIXTURE_REPO = fileURLToPath(new URL("./fixtures/repo-typical", import.meta.url));

test("AC-12: server refuses to bind to 0.0.0.0 at startup", async () => {
  await assert.rejects(
    () => createTheiaServer({ port: 0, host: "0.0.0.0", root: FIXTURE_REPO }),
    /127\.0\.0\.1 only/,
  );
});

test("AC-12: server refuses to bind to :: (IPv6 any) at startup", async () => {
  await assert.rejects(
    () => createTheiaServer({ port: 0, host: "::", root: FIXTURE_REPO }),
    /127\.0\.0\.1 only/,
  );
});

test("AC-12: server binds to 127.0.0.1 + /healthz returns 200 JSON", async () => {
  const server = await createTheiaServer({ port: 0, host: "127.0.0.1", root: FIXTURE_REPO });
  await server.listen();
  try {
    // port=0 means the OS picks a free port; resolve it.
    const addr = server.httpServer.address();
    const port = addr.port;
    const res = await fetch(`http://127.0.0.1:${port}/healthz`);
    assert.equal(res.status, 200);
    const body = await res.json() as { status: string };
    assert.equal(body.status, "ok");
  } finally {
    await server.close();
  }
});

test("AC-12: non-GET method on /healthz returns 405", async () => {
  const server = await createTheiaServer({ port: 0, host: "127.0.0.1", root: FIXTURE_REPO });
  await server.listen();
  try {
    const addr = server.httpServer.address();
    const port = addr.port;
    const res = await fetch(`http://127.0.0.1:${port}/healthz`, { method: "POST" });
    assert.equal(res.status, 405);
  } finally {
    await server.close();
  }
});

test("AC-12: non-GET method on / returns 405", async () => {
  const server = await createTheiaServer({ port: 0, host: "127.0.0.1", root: FIXTURE_REPO });
  await server.listen();
  try {
    const addr = server.httpServer.address();
    const port = addr.port;
    const res = await fetch(`http://127.0.0.1:${port}/`, { method: "PUT" });
    assert.equal(res.status, 405);
  } finally {
    await server.close();
  }
});

test("AC-12: GET / returns 200 + HTML for the overview", async () => {
  const server = await createTheiaServer({ port: 0, host: "127.0.0.1", root: FIXTURE_REPO });
  await server.listen();
  try {
    const addr = server.httpServer.address();
    const port = addr.port;
    const res = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Theia/);
    assert.match(html, /Phases/);
    assert.match(html, /Specs/);
  } finally {
    await server.close();
  }
});

test("AC-12: GET /specs/001-ratified-p2 returns 200 + per-spec detail", async () => {
  const server = await createTheiaServer({ port: 0, host: "127.0.0.1", root: FIXTURE_REPO });
  await server.listen();
  try {
    const addr = server.httpServer.address();
    const port = addr.port;
    const res = await fetch(`http://127.0.0.1:${port}/specs/001-ratified-p2`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /001-ratified-p2/);
  } finally {
    await server.close();
  }
});

test("AC-12: GET /unknown-path returns 404", async () => {
  const server = await createTheiaServer({ port: 0, host: "127.0.0.1", root: FIXTURE_REPO });
  await server.listen();
  try {
    const addr = server.httpServer.address();
    const port = addr.port;
    const res = await fetch(`http://127.0.0.1:${port}/no-such-route`);
    assert.equal(res.status, 404);
  } finally {
    await server.close();
  }
});

test("server boots and listens on a non-existent repo without throwing", async () => {
  const base = mkdtempSync(join(tmpdir(), "theia-empty-"));
  const server = await createTheiaServer({ port: 0, host: "127.0.0.1", root: base });
  await server.listen();
  try {
    const addr = server.httpServer.address();
    const port = addr.port;
    const res = await fetch(`http://127.0.0.1:${port}/`);
    // Even with no specs, the server renders an empty overview — 200.
    assert.equal(res.status, 200);
  } finally {
    await server.close();
  }
});