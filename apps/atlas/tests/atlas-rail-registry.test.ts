// AC-14 (Spec 007 v1.4) — Left rail registry alignment.
// Integration: render multiple pages and assert the rail lists all 11
// panels in registry order with the active panel highlighted.

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

test("AC-14: rail lists all 11 panels in registry order", async () => {
  await clearAll();
  await seedTenant("tenant-0", []);
  const { server } = createAtlasServer({ port: 0, deps: buildAtlasDeps() });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  try {
    const res = await get(server, "/t/tenant-0/welcome");
    assert.equal(res.status, 200);
    // The rail is inside the layout's <nav>/<aside> structure; extract it
    // by looking for the <li><a href="/t/tenant-0/{slug}"> markup pattern.
    for (const panel of PANELS) {
      const railLink = res.body.match(
        new RegExp(`<li[^>]*>[\\s\\S]*?href="/t/tenant-0/${panel.slug}"[\\s\\S]*?</li>`),
      );
      assert.ok(railLink !== null, `expected rail link to /t/tenant-0/${panel.slug} (${panel.label})`);
      assert.ok(
        railLink[0].includes(panel.label),
        `expected rail link for ${panel.slug} to show label "${panel.label}"`,
      );
    }
  } finally {
    server.close();
  }
});

test("AC-14: rail order matches the registry (not a hardcoded list)", async () => {
  await clearAll();
  await seedTenant("tenant-0", []);
  const { server } = createAtlasServer({ port: 0, deps: buildAtlasDeps() });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  try {
    const res = await get(server, "/t/tenant-0/welcome");
    assert.equal(res.status, 200);
    // For each pair of adjacent panels, the rail link for the first must
    // appear before the rail link for the second in the rendered body.
    let cursor = 0;
    for (let i = 0; i < PANELS.length - 1; i++) {
      const a = PANELS[i].slug;
      const b = PANELS[i + 1].slug;
      const aIdx = res.body.indexOf(`href="/t/tenant-0/${a}"`, cursor);
      const bIdx = res.body.indexOf(`href="/t/tenant-0/${b}"`, cursor);
      assert.ok(aIdx >= 0, `rail link for ${a} not found`);
      assert.ok(bIdx >= 0, `rail link for ${b} not found`);
      assert.ok(aIdx < bIdx, `rail order wrong: ${a} (idx=${aIdx}) appears after ${b} (idx=${bIdx})`);
      cursor = aIdx + 1;
    }
  } finally {
    server.close();
  }
});

test("AC-14: active panel is highlighted in the rail when navigating", async () => {
  await clearAll();
  await seedTenant("tenant-0", []);
  const { server } = createAtlasServer({ port: 0, deps: buildAtlasDeps() });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  try {
    // Visit the Compliance panel — its rail link should be highlighted
    // (font-weight: 500), and the Welcome rail link should NOT be (400).
    const res = await get(server, "/t/tenant-0/compliance");
    assert.equal(res.status, 200);

    // Extract individual <li>...</li> rail items and inspect each one.
    // (We avoid cross-element regex matches by splitting on </li> first.)
    const liMatches = res.body.match(/<li[^>]*>[\s\S]*?<\/li>/g) ?? [];
    assert.ok(liMatches.length >= PANELS.length, `expected ≥ ${PANELS.length} rail <li> items`);

    const liFor = (slug: string): string | undefined =>
      liMatches.find((li) => li.includes(`href="/t/tenant-0/${slug}"`));

    // The compliance rail link should be the active one (font-weight 500).
    const complianceLi = liFor("compliance");
    assert.ok(complianceLi !== undefined, "expected a rail <li> for compliance");
    assert.match(
      complianceLi,
      /font-weight:\s*500/,
      "compliance rail link should be highlighted (font-weight: 500) when on /compliance",
    );

    // The welcome rail link should NOT be the active one (font-weight 400).
    const welcomeLi = liFor("welcome");
    assert.ok(welcomeLi !== undefined, "expected a rail <li> for welcome");
    assert.doesNotMatch(
      welcomeLi,
      /font-weight:\s*500/,
      "welcome rail link should NOT be highlighted (font-weight: 500) when on /compliance",
    );
  } finally {
    server.close();
  }
});
