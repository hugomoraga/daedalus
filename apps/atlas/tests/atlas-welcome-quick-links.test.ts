// AC-13 (Spec 007 v1.3) — Welcome panel Navigate grid.
// Integration: render the Welcome panel via the SSR server, assert
// the Navigate grid lists the 10 other panels (excludes welcome),
// each link points to the right per-tenant URL, order is stable,
// and adding a hypothetical 11th panel would auto-appear in the grid.

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { request } from "node:http";
import type { Server } from "node:http";
import { createAtlasServer } from "../src/server.ts";
import { buildAtlasDeps } from "../src/deps.ts";
import { PANELS } from "../src/panels/register.ts";
import {
  seedTenant,
  clearAll,
  useTempDataDir,
} from "./helpers.ts";

before(async () => {
  await useTempDataDir();
});

function get(server: Server, path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    if (addr === null || typeof addr === "string") return reject(new Error("not listening"));
    const req = request(
      { hostname: "127.0.0.1", port: addr.port, path, method: "GET" },
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

test("AC-13: Welcome panel renders a Navigate grid with all 10 other panels", async () => {
  await clearAll();
  await seedTenant("tenant-0", []);
  const { server } = createAtlasServer({ port: 0, deps: buildAtlasDeps() });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  try {
    const res = await get(server, "/t/tenant-0/welcome");
    assert.equal(res.status, 200);
    // Section header + count text
    assert.match(res.body, /<h2>Navigate<\/h2>/);
    assert.match(res.body, /10 panels/);
    // Extract the Navigate section so we don't conflate with the
    // layout's left rail (which DOES link to welcome as the active
    // panel — that's a separate navigation surface, not the Welcome
    // panel's own self-link).
    const section = res.body.match(/<h2>Navigate<\/h2>[\s\S]*?<\/div>/)?.[0] ?? "";
    assert.ok(section.length > 0, "expected a Navigate section in the welcome panel body");
    // The Welcome panel itself is NOT linked inside the Navigate section
    assert.doesNotMatch(section, /href="\/t\/tenant-0\/welcome"/);
    // Every other panel in the registry is linked inside the Navigate section
    for (const panel of PANELS) {
      if (panel.slug === "welcome") continue;
      const expectedHref = `href="/t/tenant-0/${panel.slug}"`;
      assert.ok(
        section.includes(expectedHref),
        `expected link to /t/tenant-0/${panel.slug} (${panel.label}) in Navigate section; not found`,
      );
      // The panel's label appears as the link text
      assert.ok(
        section.includes(`>${panel.label}</`),
        `expected label "${panel.label}" in Navigate section; not found`,
      );
    }
  } finally {
    server.close();
  }
});

test("AC-13: link order is stable (matches PANELS order, excluding welcome)", async () => {
  await clearAll();
  await seedTenant("tenant-0", []);
  const { server } = createAtlasServer({ port: 0, deps: buildAtlasDeps() });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  try {
    const res = await get(server, "/t/tenant-0/welcome");
    assert.equal(res.status, 200);
    // Extract the Navigate section and verify link order
    const section = res.body.match(/<h2>Navigate<\/h2>[\s\S]*?<\/div>/)?.[0] ?? "";
    const expectedOrder = PANELS.filter((p) => p.slug !== "welcome").map((p) => p.slug);
    let cursor = 0;
    for (const slug of expectedOrder) {
      const idx = section.indexOf(`/t/tenant-0/${slug}`, cursor);
      assert.ok(idx >= 0, `slug ${slug} not found in expected order`);
      assert.ok(idx >= cursor, `slug ${slug} appears before its expected position (cursor=${cursor}, idx=${idx})`);
      cursor = idx + 1;
    }
  } finally {
    server.close();
  }
});

test("AC-13: links are per-tenant — tenant-other's welcome links to /t/tenant-other/...", async () => {
  await clearAll();
  await seedTenant("tenant-0", []);
  await seedTenant("tenant-other", []);
  const { server } = createAtlasServer({ port: 0, deps: buildAtlasDeps() });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  try {
    const t0 = await get(server, "/t/tenant-0/welcome");
    assert.equal(t0.status, 200);
    // Look only inside the Navigate section, not the rail.
    const t0Section = t0.body.match(/<h2>Navigate<\/h2>[\s\S]*?<\/div>/)?.[0] ?? "";
    assert.match(t0Section, /href="\/t\/tenant-0\/events"/);
    assert.match(t0Section, /href="\/t\/tenant-0\/compliance"/);
    assert.doesNotMatch(t0Section, /href="\/t\/tenant-other\//);

    const tother = await get(server, "/t/tenant-other/welcome");
    assert.equal(tother.status, 200);
    const totherSection = tother.body.match(/<h2>Navigate<\/h2>[\s\S]*?<\/div>/)?.[0] ?? "";
    assert.match(totherSection, /href="\/t\/tenant-other\/events"/);
    assert.doesNotMatch(totherSection, /href="\/t\/tenant-0\/events"/);
  } finally {
    server.close();
  }
});
