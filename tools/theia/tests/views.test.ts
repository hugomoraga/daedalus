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
import { renderPhaseDetail } from "../src/views/phase.ts";

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

// UX-008 P0-2: the "Spec file" link is a direct GitHub blob URL,
// not a search URL (the latter rendered `github.com/search?q=…`
// and never landed on the file).
test("UX-008: spec detail 'Spec file' link points to the GitHub blob URL", async () => {
  const { state } = await parseRepo(FIXTURE);
  const card = state.specs.find((s) => s.slug === "001-ratified-p2");
  assert.ok(card !== undefined, "fixture must include 001-ratified-p2");
  const html = renderSpecDetail("001-ratified-p2", state);
  // The path is shown verbatim AND as an href.
  assert.match(html, new RegExp(`href="https://github\\.com/hugomoraga/daedalus/blob/main/${card.links.spec.replace(/\//g, "\\/")}"`));
  // The old search URL must NOT appear.
  assert.doesNotMatch(html, /github\.com\/search\?q=/);
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
  // Done task: id + done styling class.
  assert.match(html, /<code>T-01<\/code>/);
  assert.match(html, /theia-task-done/);
  // Pending task: id + pending styling class.
  assert.match(html, /<code>T-03<\/code>/);
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

test("AC-4 + UX-008: drift widget renders before Specs (signal-first order)", async () => {
  const { state } = await parseRepo(FIXTURE);
  state.specs[0]!.conventionIssues = ["tasks.md missing"];
  const html = renderOverview(state);
  const driftIdx = html.indexOf("Specs needing attention");
  const specsIdx = html.indexOf("Specs (");
  const adrsIdx = html.indexOf("ADRs (");
  assert.ok(specsIdx !== -1 && driftIdx !== -1 && adrsIdx !== -1);
  // UX-008: when a spec needs attention, the drift widget is the
  // very first signal — it must appear BEFORE the spec grid so a
  // founder opening the page sees the action item before browsing.
  assert.ok(driftIdx < specsIdx, "drift widget should appear before Specs");
  assert.ok(specsIdx < adrsIdx, "Specs should still appear before ADRs");
});

// ----------------------------------------------------------------------------
// UX-004 — backlog panel
// ----------------------------------------------------------------------------

test("UX-004: overview renders the Backlog section with the fixture's 3 items", async () => {
  const { state } = await parseRepo(FIXTURE);
  const html = renderOverview(state);
  assert.match(html, /Backlog \(3\)/);
  for (const id of ["BUG-001", "UX-001", "UX-002"]) {
    assert.match(html, new RegExp(id));
  }
});

test("UX-004: backlog section is grouped by status (open / in-progress / done)", async () => {
  const { state } = await parseRepo(FIXTURE);
  const html = renderOverview(state);
  // The view wraps each status in <h4> with a status badge; the count
  // appears as <span class="muted">(N)</span> just after. Check both
  // pieces independently.
  for (const status of ["open", "in-progress", "done"]) {
    assert.match(html, new RegExp(`<h4[^>]*>[^<]*<span[^>]*>${status}</span>[^<]*<span class="muted">\\(1\\)</span></h4>`));
  }
});

test("UX-004: each backlog row carries the id, kind, title, and (when present) the affects file", async () => {
  const { state } = await parseRepo(FIXTURE);
  const html = renderOverview(state);
  // id, kind, title.
  assert.match(html, /fixture bug entry/);
  assert.match(html, /fixture UX entry \(in-progress\)/);
  // affects is rendered as a <code> block.
  assert.match(html, /<code>tools\/theia\/<\/code>/);
  assert.match(html, /<code>apps\/atlas\/src\/<\/code>/);
});

test("UX-004: backlog section renders between ADRs and Code inventory", async () => {
  const { state } = await parseRepo(FIXTURE);
  const html = renderOverview(state);
  const adrsIdx = html.indexOf("ADRs (");
  const backlogIdx = html.indexOf("Backlog (");
  const codeIdx = html.indexOf("Code inventory");
  assert.ok(adrsIdx !== -1 && backlogIdx !== -1 && codeIdx !== -1);
  assert.ok(adrsIdx < backlogIdx, "backlog should appear after ADRs");
  assert.ok(backlogIdx < codeIdx, "backlog should appear before Code inventory");
});

// ----------------------------------------------------------------------------
// UX-005 — clickable phase cells + per-phase detail view
// ----------------------------------------------------------------------------

test("UX-005: each phase cell in the overview is a link to /phases/<n>", async () => {
  const { state } = await parseRepo(FIXTURE);
  const html = renderOverview(state);
  for (const n of [0, 1, 2]) {
    assert.match(html, new RegExp(`<a class="[^"]*theia-phase-cell[^"]*" href="/phases/${n}">`));
  }
});

test("UX-005: the active phase cell carries the is-active class", async () => {
  const { state } = await parseRepo(FIXTURE);
  const html = renderOverview(state);
  // state.activePhase is 2 for the fixture (highest Ratified phase).
  assert.match(html, /<a class="[^"]*theia-phase-cell[^"]*is-active[^"]*" href="\/phases\/2">/);
});

test("UX-005: phase detail view renders the title, milestone count, and specs in that phase", async () => {
  const { state } = await parseRepo(FIXTURE);
  const html = renderPhaseDetail(2, state);
  // Phase 2 is the "Organizational Core" / "Workflow Engine" phase
  // in the fixture. Assert the title and metadata.
  assert.match(html, /Phase 2/);
  assert.match(html, /roadmap milestones:/);
  assert.match(html, /specs in this phase:/);
  // Fixture: spec 001-ratified-p2 has phase=2.
  assert.match(html, /<a href="\/specs\/001-ratified-p2">/);
});

test("UX-005: phase detail view for an empty phase shows 'no specs' message", async () => {
  const { state } = await parseRepo(FIXTURE);
  // Phase 5 doesn't exist in the fixture's roadmap.
  const html = renderPhaseDetail(5, state);
  assert.match(html, /not found/i);
  assert.match(html, /back to overview/);
});

test("UX-005: phase detail view for a known phase with no specs shows 'no specs assigned'", async () => {
  const { state } = await parseRepo(FIXTURE);
  // Phase 1 exists in the fixture roadmap but no spec has phase=1.
  const html = renderPhaseDetail(1, state);
  assert.match(html, /Phase 1/);
  assert.match(html, /No specs assigned to this phase yet/);
});

test("UX-005: phase detail view shows the 'active' marker when the phase is the active one", async () => {
  const { state } = await parseRepo(FIXTURE);
  const html = renderPhaseDetail(2, state);
  assert.match(html, />active</);
});

// ----------------------------------------------------------------------------
// UX-006 — human-readable task rendering
// ----------------------------------------------------------------------------

test("UX-006: each task is a two-line block with mark + id on line 1, text on line 2", async () => {
  const { state } = await parseRepo(FIXTURE);
  const html = renderSpecDetail("001-ratified-p2", state);
  // Each <li> has .theia-task class with a .theia-task-line1 + .theia-task-text child.
  assert.match(html, /<li class="theia-task[^"]*">\s*<div class="theia-task-line1">/);
  // Line 1 carries the mark + id.
  assert.match(html, /theia-task-mark">\[x\]<\/span>\s*<code>T-01<\/code>/);
  assert.match(html, /theia-task-text">/);
});

test("UX-006: backticks in the task text render as <code> spans", async () => {
  const { state } = await parseRepo(FIXTURE);
  const html = renderSpecDetail("001-ratified-p2", state);
  // Fixture T-01 has `tools/theia/` and `package.json` in its text.
  assert.match(html, /<code>tools\/theia\/<\/code>/);
  assert.match(html, /<code>package\.json<\/code>/);
});

test("UX-006: **bold** in the task text renders as <strong> spans", async () => {
  const { state } = await parseRepo(FIXTURE);
  const html = renderSpecDetail("001-ratified-p2", state);
  // Fixture T-02 starts with **strict**.
  assert.match(html, /<strong>strict<\/strong>/);
  // Fixture T-04 starts with **ship**.
  assert.match(html, /<strong>ship<\/strong>/);
});

test("UX-006: (AC-N) references are extracted into styled pills at the end of the text", async () => {
  const { state } = await parseRepo(FIXTURE);
  const html = renderSpecDetail("001-ratified-p2", state);
  // Fixture T-01 has (AC-4) → rendered as a pill.
  assert.match(html, /<span class="theia-task-ac">AC-4<\/span>/);
  // Fixture T-03 has (AC-1, AC-2) → two pills.
  assert.match(html, /<span class="theia-task-ac">AC-1<\/span>/);
  assert.match(html, /<span class="theia-task-ac">AC-2<\/span>/);
  // Pills are wrapped in a <span class="theia-task-ac-wrap">.
  assert.match(html, /<span class="theia-task-ac-wrap">/);
});

test("UX-006: done tasks render the entire block with strikethrough; the mark stays non-struck", async () => {
  const { state } = await parseRepo(FIXTURE);
  const html = renderSpecDetail("001-ratified-p2", state);
  // T-01 is done. The <li> has theia-task-done which gets text-decoration: line-through.
  assert.match(html, /<li class="theia-task theia-task-done"[^>]*>/);
  // T-03 is pending. Different class.
  assert.match(html, /<li class="theia-task theia-task-pending"[^>]*>/);
});

// ----------------------------------------------------------------------------
// UX-008 — overview polish
// ----------------------------------------------------------------------------

test("UX-008: every overview section carries a stable id for deep linking", async () => {
  const { state } = await parseRepo(FIXTURE);
  const html = renderOverview(state);
  // The founder's-eye order (UX-008): drift → specs → tests → blockers
  // → adrs → backlog → phases → diff → code → cli. The id="…" lives
  // on the <section> wrapper.
  for (const id of [
    "specs-needing-attention",
    "specs",
    "tests",
    "blockers",
    "adrs",
    "backlog",
    "phases",
    "diff",
    "code-inventory",
    "cli-commands",
  ]) {
    assert.match(html, new RegExp(`<section class="theia-section" id="${id}">`));
  }
});

test("UX-008: overview section order matches the founder's-eye hierarchy", async () => {
  const { state } = await parseRepo(FIXTURE);
  // Inject drift to make sure the widget renders (otherwise it's
  // hidden by renderDriftWidget's early-return).
  state.specs[0]!.conventionIssues = ["tasks.md missing"];
  const html = renderOverview(state);
  const positions = {
    drift: html.indexOf("Specs needing attention"),
    specs: html.indexOf("Specs ("),
    tests: html.indexOf("Tests"),
    blockers: html.indexOf("Blockers"),
    adrs: html.indexOf("ADRs ("),
    backlog: html.indexOf("Backlog ("),
    phases: html.indexOf("Phases ("),
    diff: html.indexOf("Diff ("),
    code: html.indexOf("Code inventory"),
    cli: html.indexOf("CLI commands ("),
  };
  for (const [k, v] of Object.entries(positions)) {
    assert.ok(v !== -1, `${k} section must render`);
  }
  const ordered = Object.entries(positions).sort((a, b) => a[1] - b[1]).map(([k]) => k);
  assert.deepEqual(ordered, [
    "drift",
    "specs",
    "tests",
    "blockers",
    "adrs",
    "backlog",
    "phases",
    "diff",
    "code",
    "cli",
  ]);
});

test("UX-007: done task body is dimmed (not struck through); only the id carries strikethrough", async () => {
  const { state } = await parseRepo(FIXTURE);
  const html = renderSpecDetail("001-ratified-p2", state);
  // T-01 is done. The text body should NOT be struck through.
  // The CSS rule ".theia-task-done .theia-task-line1 code" is the
  // only place strikethrough appears on a done task. We assert by
  // checking the inline CSS: the text container is NOT styled with
  // line-through.
  //
  // Simpler check: the .theia-task-text for a done task does not
  // carry a style attribute with line-through. The strikethrough
  // is applied via the parent's class + the CSS rule, so we
  // assert the CSS file has the right rule, not the inline style.
  assert.match(html, /\.theia-task-done \{\s*color: var\(--neutral\);?\s*\}/);
  assert.match(html, /\.theia-task-done \.theia-task-line1 code \{ text-decoration: line-through; \}/);
});

test("UX-007: summary runs through the inline-markdown helper (bold + code + links)", async () => {
  const { state } = await parseRepo(FIXTURE);
  const html = renderSpecDetail("001-ratified-p2", state);
  // Fixture summary: "**Ratified** Phase-2 spec ... `status = ...` ... [Spec 012 (Theia)](...)".
  // Bold becomes <strong>.
  assert.match(html, /<strong>Ratified<\/strong>/);
  // Backticks become <code> (with HTML-escaped content — quotes
  // become &quot;).
  assert.match(html, /<code>status = &quot;Ratified&quot;<\/code>|<code>status = "Ratified"<\/code>/);
  // Markdown link becomes <a href=...>.
  assert.match(html, /<a href="\.\.\/\.\.\/012-theia\/spec\.md">Spec 012 \(Theia\)<\/a>/);
  // No raw markdown should leak into the summary.
  assert.doesNotMatch(html, /\*\*Ratified\*\*/);
  assert.doesNotMatch(html, /\[Spec 012/);
});

test("UX-007: (spec|plan §N[-M]) refs render as muted .theia-section-ref labels, not raw text", async () => {
  const { state } = await parseRepo(FIXTURE);
  const html = renderSpecDetail("001-ratified-p2", state);
  // Fixture T-01 has (spec §1-§4, AC-4) — the section ref and the
  // AC ref live in the same paren group. After UX-007, the group
  // is fully consumed and rendered as both a .theia-section-ref
  // label and a .theia-task-ac pill.
  assert.match(html, /<span class="theia-section-ref">spec §1–4<\/span>/);
  assert.match(html, /<span class="theia-task-ac">AC-4<\/span>/);
  // T-02 has (plan §3, AC-5) — single-number section ref.
  assert.match(html, /<span class="theia-section-ref">plan §3<\/span>/);
  // T-03 has (plan §5, AC-1, AC-2) — multiple AC refs in one group.
  assert.match(html, /<span class="theia-section-ref">plan §5<\/span>/);
  // The raw "(spec §1-§4, AC-4)" group is no longer in the text.
  assert.doesNotMatch(html, /\(spec §1-§4/);
  assert.doesNotMatch(html, /\(plan §3/);
});

test("UX-007: section-ref label has its own CSS class (distinct from AC pill)", async () => {
  const { state } = await parseRepo(FIXTURE);
  const html = renderSpecDetail("001-ratified-p2", state);
  // The section ref has the .theia-section-ref class — distinct
  // from .theia-task-ac (no background, just mono + neutral color).
  assert.match(html, /<span class="theia-section-ref-wrap"><span class="theia-section-ref">plan §3<\/span>/);
});