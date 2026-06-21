// Panel manifest — Spec 007 AC-6.
// Every panel must declare a backing model; unknown slugs return 404.

import { test } from "node:test";
import assert from "node:assert/strict";
import { PANELS, findPanel } from "../src/panels/register.ts";

test("atlas AC-6: every registered panel declares a non-empty backing model", () => {
  for (const p of PANELS) {
    assert.ok(p.backingModel.length > 0, `panel ${p.slug} has empty backingModel`);
    assert.ok(p.label.length > 0, `panel ${p.slug} has empty label`);
  }
});

test("atlas AC-6: findPanel returns null for unregistered slug", () => {
  assert.equal(findPanel("does-not-exist"), null);
  assert.equal(findPanel(""), null);
});

test("atlas AC-6: findPanel returns the panel for registered slugs", () => {
  for (const p of PANELS) {
    const found = findPanel(p.slug);
    assert.ok(found !== null, `panel ${p.slug} not found by slug`);
    assert.equal(found.slug, p.slug);
  }
});

test("atlas AC-6: panel slugs are unique", () => {
  const slugs = PANELS.map((p) => p.slug);
  assert.equal(new Set(slugs).size, slugs.length, `duplicate slugs: ${slugs.join(", ")}`);
});