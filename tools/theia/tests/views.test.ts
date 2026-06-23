// Theia (Spec 012) — view rendering tests (PR 8).
//
// Verifies the overview + per-spec detail HTML contains the expected
// sections, badges, and links. The view functions are pure: given a
// ProjectState, they return a string of HTML.

import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { parseRepo } from "../src/parser.ts";
import { renderOverview } from "../src/views/overview.ts";
import { renderSpecDetail } from "../src/views/spec.ts";

const FIXTURE = fileURLToPath(new URL("./fixtures/repo-typical", import.meta.url));

test("AC-1: overview renders a phase timeline (active phase highlighted)", async () => {
  const { state } = await parseRepo(FIXTURE);
  const html = renderOverview(state);
  assert.match(html, /Phase 0/);
  assert.match(html, /Phase 1/);
  assert.match(html, /Phase 2/);
  // Active phase (2) should appear; the visual highlighting is CSS
  // we don't introspect here.
  assert.match(html, /Phases \(3\)/);
});

test("AC-2: overview renders a spec grid (one card per spec)", async () => {
  const { state } = await parseRepo(FIXTURE);
  const html = renderOverview(state);
  assert.match(html, /Specs \(4\)/);
  // Each fixture spec is mentioned.
  assert.match(html, /001-ratified-p2/);
  assert.match(html, /002-draft-p0/);
  assert.match(html, /003-blocked/);
  assert.match(html, /004-unknown/);
});

test("UX-002: each spec grid card links to /specs/<slug>", async () => {
  const { state } = await parseRepo(FIXTURE);
  const html = renderOverview(state);
  for (const s of state.specs) {
    const re = new RegExp(`href="/specs/${s.slug.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}"`);
    assert.match(html, re);
  }
});

test("AC-3: status badges include Ratified + Unknown for the fixture", async () => {
  const { state } = await parseRepo(FIXTURE);
  const html = renderOverview(state);
  assert.match(html, /Ratified/);
  assert.match(html, /Unknown/);
  // Unknown fallback surfaces a warn-banner.
  assert.match(html, /theia-warn-banner/);
});

test("AC-5: ADRs section renders the 2 fixture ADRs", async () => {
  const { state } = await parseRepo(FIXTURE);
  const html = renderOverview(state);
  assert.match(html, /ADRs \(2\)/);
  assert.match(html, /ADR-001/);
  assert.match(html, /ADR-007/);
});

test("AC-6: code inventory section lists apps + packages", async () => {
  const { state } = await parseRepo(FIXTURE);
  const html = renderOverview(state);
  assert.match(html, /Code inventory/);
  assert.match(html, /app \(/);
  assert.match(html, /package \(/);
});

test("AC-7: CLI commands section lists 5 use cases", async () => {
  const { state } = await parseRepo(FIXTURE);
  const html = renderOverview(state);
  assert.match(html, /CLI commands \(5\)/);
  for (const cmd of ["alpha:create", "beta:list", "gamma:delete", "delta:status", "epsilon:run"]) {
    const re = new RegExp(cmd);
    assert.match(html, re);
  }
});

test("AC-8: tests panel shows 'running…' placeholder while pendingTests resolves", async () => {
  const { state } = await parseRepo(FIXTURE);
  // parseRepo's state.tests starts with running=true (placeholder).
  assert.equal(state.tests.running, true);
  const html = renderOverview(state);
  assert.match(html, /Tests/);
  assert.match(html, /running…/);
});

test("AC-10: blockers + next-unlocks sections render when present", async () => {
  // The repo-blocked fixture has 1 BLOCKED spec (100-blocked) with
  // 2 unblockers (101 + 102). Both unblockers are Draft so they
  // appear in next-unlocks. Spec 103 is Ratified → must NOT appear.
  const BLOCKED_FIXTURE = fileURLToPath(new URL("./fixtures/repo-blocked", import.meta.url));
  const { state } = await parseRepo(BLOCKED_FIXTURE);
  const html = renderOverview(state);
  assert.match(html, /Blockers \+ next unlocks/);
  // Spec 103 is Ratified so it must NOT appear in next-unlocks.
  assert.equal(state.nextUnlocks.find((u) => u.slug === "103"), undefined);
  // The unblockers (101 + 102) DO appear.
  assert.ok(state.nextUnlocks.some((u) => u.slug === "101"));
  assert.ok(state.nextUnlocks.some((u) => u.slug === "102"));
});

test("spec detail view renders the requested spec", async () => {
  const { state } = await parseRepo(FIXTURE);
  const html = renderSpecDetail("001-ratified-p2", state);
  assert.match(html, /001-ratified-p2/);
  assert.match(html, /Ratified/);
  assert.match(html, /Phase 2/);
  // Back link.
  assert.match(html, /back to overview/);
});

test("spec detail view for an unknown slug renders a 'not found' page", async () => {
  const { state } = await parseRepo(FIXTURE);
  const html = renderSpecDetail("999-does-not-exist", state);
  assert.match(html, /not found/i);
  assert.match(html, /back to overview/);
});

test("UX-003: spec detail view enumerates each task with its state", async () => {
  const { state } = await parseRepo(FIXTURE);
  const html = renderSpecDetail("001-ratified-p2", state);
  // Done task: id + text + done styling class.
  assert.match(html, /<code>T-01<\/code>/);
  assert.match(html, /first task done/);
  assert.match(html, /theia-task-done/);
  // Pending task: id + text + pending styling class.
  assert.match(html, /<code>T-03<\/code>/);
  assert.match(html, /third task pending/);
  assert.match(html, /theia-task-pending/);
});

test("UX-003: spec detail view groups tasks by ## section heading", async () => {
  const { state } = await parseRepo(FIXTURE);
  const html = renderSpecDetail("001-ratified-p2", state);
  // The fixture tasks.md has two `##` sections: "PR 1 — Foundation"
  // and "PR 2 — Wiring". Each renders as its own .theia-task-section.
  assert.match(html, /theia-task-section[^>]*>PR 1 — Foundation</);
  assert.match(html, /theia-task-section[^>]*>PR 2 — Wiring</);
  assert.match(html, /theia-task-list/);
});

test("UX-003: spec detail view with empty taskList omits the task block", async () => {
  const { state } = await parseRepo(FIXTURE);
  const html = renderSpecDetail("002-draft-p0", state);
  // No <li class="theia-task-*"> should appear in the body. (The CSS
  // selector string itself lives inside <style>, so we check the
  // rendered markup only — an <li> with a theia-task- class.)
  assert.doesNotMatch(html, /<li[^>]*theia-task-/);
  assert.doesNotMatch(html, /<h3[^>]*theia-task-section/);
  assert.doesNotMatch(html, /<div[^>]*theia-task-block/);
});

// ----------------------------------------------------------------------------
// Spec 015 — drift widget (AC-4)
// ----------------------------------------------------------------------------

test("AC-4: drift widget is hidden when no spec has issues", async () => {
  const { state } = await parseRepo(FIXTURE);
  // Force every spec to be clean: empty conventionIssues array.
  for (const s of state.specs) {
    s.conventionIssues = [];
  }
  const html = renderOverview(state);
  assert.doesNotMatch(html, /Specs needing attention/);
});

test("AC-4: drift widget lists each (spec, issue) pair when populated", async () => {
  const { state } = await parseRepo(FIXTURE);
  // Inject issues on two specs.
  const card1 = state.specs[0]!;
  const card2 = state.specs[1]!;
  card1.conventionIssues = ["tasks.md missing"];
  card2.conventionIssues = ["tasks.md has 0 checkboxes", "Unknown status: oops"];
  const html = renderOverview(state);
  assert.match(html, /Specs needing attention/);
  // Each issue should appear (escapeHtml encodes the slug verbatim).
  assert.match(html, new RegExp(card1.slug));
  assert.match(html, new RegExp(card2.slug));
  assert.match(html, /tasks\.md missing/);
  assert.match(html, /tasks\.md has 0 checkboxes/);
  assert.match(html, /Unknown status: oops/);
});

test("AC-4: drift widget renders between Specs and ADRs sections", async () => {
  const { state } = await parseRepo(FIXTURE);
  state.specs[0]!.conventionIssues = ["tasks.md missing"];
  const html = renderOverview(state);
  const specsIdx = html.indexOf("Specs (");
  const driftIdx = html.indexOf("Specs needing attention");
  const adrsIdx = html.indexOf("ADRs (");
  assert.ok(specsIdx !== -1 && driftIdx !== -1 && adrsIdx !== -1);
  assert.ok(specsIdx < driftIdx, "drift widget should appear after Specs");
  assert.ok(driftIdx < adrsIdx, "drift widget should appear before ADRs");
});