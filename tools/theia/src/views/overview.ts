// Theia (Spec 012) — overview view (PR 8).
//
// Renders the single-page overview from a ProjectState. Sections
// (matching Spec §5):
//   - Phase timeline (AC-1)
//   - Spec grid (AC-2)
//   - ADRs (AC-5)
//   - Code inventory (AC-6)
//   - Use cases (AC-7)
//   - Tests (AC-8 — running… placeholder while pendingTests resolves)
//   - Diff summary (AC-9)
//   - Blockers + next-unlocks (AC-10)
//
// The view is read-only by construction: no POST, no forms. The
// browser is a renderer (per §7 "no client-side state for project
// data"); refresh = re-request.

import type { ProjectState, BacklogItem } from "../types.ts";
import { renderLayout } from "./layout.ts";
import { escapeHtml, tag, GITHUB_REPO } from "./tokens.ts";
import { inlineMarkdownToHtml } from "./spec.ts";

export function renderOverview(state: ProjectState, opts: { showDone?: boolean } = {}): string {
  // Section order is intentional — UX-008 reorders by usefulness for
  // a founder opening the page (drift first, low-signal catalog last).
  // No CSS layout change; only the render order and section IDs.
  //
  // UX-009: `opts.showDone` opens the "done" group in the Backlog
  // section so a deep link from a steward review can still see the
  // full view. Default: collapsed (the working states are the
  // signal; done is the noise).
  const body = [
    renderDriftWidget(state),
    renderSpecGrid(state),
    renderTestsSection(state),
    renderBlockersSection(state),
    renderAdrsSection(state),
    renderBacklogSection(state, { showDone: opts.showDone === true }),
    renderPhaseTimeline(state),
    renderDiffSection(state),
    renderCodeInventorySection(state),
    renderUseCasesSection(state),
  ].join("\n");
  return renderLayout({ title: "Overview · Theia", body });
}

// Spec 015 §6 AC-4 — "Specs needing attention" widget. Renders one
// row per (spec, issue) pair. Hidden entirely when no spec has any
// convention issue, so a clean repo shows nothing here.
function renderDriftWidget(state: ProjectState): string {
  const all: Array<{ slug: string; issue: string }> = [];
  for (const s of state.specs) {
    for (const issue of s.conventionIssues) {
      all.push({ slug: s.slug, issue });
    }
  }
  if (all.length === 0) return "";
  const items = all.map(({ slug, issue }) =>
    `<li><code>${escapeHtml(slug)}</code> <span class="muted">— ${escapeHtml(issue)}</span></li>`
  ).join("");
  return section(
    "Specs needing attention",
    `<ul class="theia-mono">${items}</ul>`,
    { id: "specs-needing-attention" },
  );
}

function renderPhaseTimeline(state: ProjectState): string {
  if (state.phases.length === 0) {
    return section("Phases", "<p class=\"muted\">No roadmap phases detected.</p>", { id: "phases" });
  }
  const maxPhase = Math.max(...state.phases.map((p) => p.number));
  const cells: string[] = [];
  for (let n = 0; n <= maxPhase; n++) {
    const phase = state.phases.find((p) => p.number === n);
    const isActive = n === state.activePhase;
    const classes = ["theia-phase-cell"];
    if (isActive) classes.push("is-active");
    if (phase === undefined) classes.push("is-empty");
    const titlePart = phase !== undefined ? `<br><small>${escapeHtml(phase.title)}</small>` : "";
    cells.push(`<a class="${classes.join(" ")}" href="/phases/${n}">Phase ${n}${titlePart}</a>`);
  }
  return section(`Phases (${state.phases.length})`, `<div style="display:flex; gap:8px;">${cells.join("")}</div>`, { id: "phases" });
}

function renderSpecGrid(state: ProjectState): string {
  if (state.specs.length === 0) {
    return section("Specs", "<p class=\"muted\">No specs detected.</p>", { id: "specs" });
  }
  const sorted = [...state.specs].sort((a, b) => {
    if (a.status !== b.status && a.status === "Ratified" && b.status !== "Ratified") return -1;
    if (b.status === "Ratified" && a.status !== "Ratified") return 1;
    return a.slug.localeCompare(b.slug);
  });
  const cards = sorted.map((s) => {
    const done = s.tasksDone + s.planDone;
    const total = s.tasksTotal + s.planTotal;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    const statusTone = s.status === "Ratified" ? "ok" : s.status === "Blocked" ? "alert" : "neutral";
    return `<a class="theia-card theia-card-link" href="/specs/${escapeHtml(s.slug)}">
      <div>${tag(s.status, statusTone)} <strong>${escapeHtml(s.slug)}</strong></div>
      <div class="theia-mono" style="margin-top: 4px;">Phase ${s.phase ?? "?"} · v${escapeHtml(s.version ?? "?")}</div>
      <div style="margin-top: 8px;">${escapeHtml(s.title)}</div>
      <div style="margin-top: 8px;">
        <span class="theia-mono">${done}/${total} tasks</span>
        <span class="theia-progress"><span style="width:${pct}%"></span></span>
      </div>
    </a>`;
  }).join("");
  return section(
    `Specs (${state.specs.length})`,
    `<div class="theia-grid">${cards}</div>`,
    { id: "specs" },
  );
}

function renderAdrsSection(state: ProjectState): string {
  if (state.adrs.length === 0) {
    return section("ADRs", "<p class=\"muted\">No ADRs detected.</p>", { id: "adrs" });
  }
  const rows = state.adrs.map((a) => {
    const tone = a.status === "Accepted" ? "ok" : a.status === "Superseded" ? "neutral" : "neutral";
    return `<tr>
      <td style="padding: 4px 8px;">${tag(a.status, tone)}</td>
      <td style="padding: 4px 8px;" class="theia-mono">ADR-${String(a.number).padStart(3, "0")}</td>
      <td style="padding: 4px 8px;">${escapeHtml(a.title)}</td>
      <td style="padding: 4px 8px;" class="theia-mono">${escapeHtml(a.date ?? "")}</td>
    </tr>`;
  }).join("");
  return section(
    `ADRs (${state.adrs.length})`,
    `<table style="width:100%; border-collapse: collapse;">${rows}</table>`,
    { id: "adrs" },
  );
}

// UX-004: render `docs/backlog.md` as a single grouped table. Rows are
// grouped by `Status` (open / in-progress / wontfix / done) — the
// working states first, then the closed ones. Each row carries the
// `id` (mono), `kind` badge, the title (escaped), and an optional
// collapsed `<details>` with the prose body.
function renderBacklogSection(state: ProjectState, opts: { showDone?: boolean } = {}): string {
  if (state.backlog.length === 0) {
    return section("Backlog", "<p class=\"muted\">No backlog detected.</p>", { id: "backlog" });
  }
  // Group by status, preserving a stable in-group order (sorted by id).
  const order: ReadonlyArray<string> = ["open", "in-progress", "wontfix", "done"];
  const groups = new Map<string, typeof state.backlog>();
  for (const item of state.backlog) {
    const list = groups.get(item.status) ?? [];
    list.push(item);
    groups.set(item.status, list);
  }
  // Sort items within each group by id (the parser already does this,
  // but be defensive against any future parser change).
  for (const list of groups.values()) {
    list.sort((a, b) => a.id.localeCompare(b.id));
  }
  // Render: ordered groups first, then any unknown status at the end.
  // UX-009: the "done" group is collapsed by default — 13 of 14
  // entries are done in the live repo, and the founder opens the
  // page looking for *what to do next*, not the history. The
  // working states (open, in-progress, wontfix) stay visible. A
  // deep link with `?show=done` opens it for steward review.
  //
  // UX-010: each entry is a card-list <li> (not a table row). The
  // id + kind badges are inline with the title; the affects line
  // sits below, optionally truncated to "first path +N more".
  const groupKeys = [
    ...order.filter((k) => groups.has(k)),
    ...[...groups.keys()].filter((k) => !order.includes(k)),
  ];
  const parts: string[] = [];
  for (const key of groupKeys) {
    const list = groups.get(key) ?? [];
    if (list.length === 0) continue;
    const groupTone = key === "open" ? "alert" : key === "in-progress" ? "neutral" : key === "wontfix" ? "neutral" : "ok";
    const items = list.map((b) => renderBacklogItem(b)).join("");
    if (key === "done") {
      // Collapsed by default; open when `?show=done` is on the URL.
      const openAttr = opts.showDone === true ? " open" : "";
      parts.push(`<details class="theia-backlog-done"${openAttr}>`
        + `<summary class="theia-backlog-done-summary">${tag(key, groupTone)} <span class="muted">(${list.length})</span> — show ${list.length} done</summary>`
        + `<ul class="theia-backlog-list">${items}</ul>`
        + `</details>`);
    } else {
      parts.push(`<h4 class="theia-backlog-group-head">${tag(key, groupTone)} <span class="muted">(${list.length})</span></h4>`);
      parts.push(`<ul class="theia-backlog-list">${items}</ul>`);
    }
  }
  return section(`Backlog (${state.backlog.length})`, parts.join(""), { id: "backlog" });
}

// Render one backlog entry as a card-list item. The shape is:
//   <li>
//     <div class="theia-backlog-head">
//       [id-badge] [kind-badge] <strong>title</strong>
//     </div>
//     <div class="theia-backlog-meta">
//       affects: <code>first path +N more</code>   (or single path; or omitted)
//     </div>
//     <details class="theia-backlog-body">
//       <summary>▸ context</summary>
//       <div>…rendered markdown…</div>
//     </details>
//   </li>
function renderBacklogItem(b: BacklogItem): string {
  const kindTone = b.kind === "bug" ? "alert" : b.kind === "deprecation" ? "alert" : "neutral";
  const head = `<div class="theia-backlog-head">${tag(b.id, "neutral")} ${tag(b.kind, kindTone)} <strong>${escapeHtml(b.title)}</strong></div>`;
  const affects = b.affects !== null
    ? `<div class="theia-mono theia-backlog-affects">affects: <code${truncateAffectsTitle(b.affects) === null ? "" : ` title="${truncateAffectsTitle(b.affects)}"`}>${truncateAffectsDisplay(b.affects)}</code></div>`
    : "";
  const body = b.body.length > 0
    ? `<details class="theia-backlog-body"><summary class="muted">context</summary><div class="theia-backlog-body-inner">${inlineMarkdownToHtml(b.body)}</div></details>`
    : "";
  return `<li class="theia-backlog-item">${head}${affects}${body}</li>`;
}

// Truncate an affects string to its first comma-separated path. If
// there's only one path, return null (no truncation). If there are
// multiple, return "first +N more" where N is the count of the
// remaining paths.
function truncateAffectsDisplay(affects: string): string {
  const parts = affects.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
  if (parts.length <= 1) return escapeHtml(affects);
  const rest = parts.length - 1;
  return `${escapeHtml(parts[0] ?? "")} <span class="muted">+${rest} more</span>`;
}

// Same as truncateAffectsDisplay but returns the full affects for
// the title attribute (HTML-escaped, for the hover tooltip). null
// when the affects has only one path.
function truncateAffectsTitle(affects: string): string | null {
  const parts = affects.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
  if (parts.length <= 1) return null;
  return escapeHtml(parts.join(", "));
}

function renderCodeInventorySection(state: ProjectState): string {
  if (state.codeInventory.length === 0) {
    return section("Code", "<p class=\"muted\">No code inventory.</p>", { id: "code" });
  }
  const grouped = new Map<string, typeof state.codeInventory>();
  for (const entry of state.codeInventory) {
    const list = grouped.get(entry.kind) ?? [];
    list.push(entry);
    grouped.set(entry.kind, list);
  }
  const parts: string[] = [];
  for (const kind of ["app", "package", "test"] as const) {
    const list = grouped.get(kind) ?? [];
    if (list.length === 0) continue;
    // UX-008 P1-3: every inventory entry becomes a link to its
    // directory in the repo. apps/* and packages/* → the dir;
    // tests/* → the file (matching the spec detail link pattern).
    const items = list.map((e) => {
      const href = kind === "test"
        ? `https://github.com/${GITHUB_REPO}/blob/main/tests/${e.name}`
        : `https://github.com/${GITHUB_REPO}/tree/main/${kind}s/${e.name}`;
      return `<li><a href="${escapeHtml(href)}"><code>${escapeHtml(e.name)}</code></a></li>`;
    }).join("");
    parts.push(`<h3>${kind} (${list.length})</h3><ul>${items}</ul>`);
  }
  return section("Code inventory", parts.join(""), { id: "code-inventory" });
}

function renderUseCasesSection(state: ProjectState): string {
  if (state.useCases.length === 0) {
    return section("CLI commands", "<p class=\"muted\">No commands detected.</p>", { id: "cli-commands" });
  }
  // UX-008 P1-2: group CLI commands by their colon-prefix (e.g.
  // "revenue:*", "proposal:*", "lead:*"). Each group renders under
  // an <h4> with the prefix label and a count. Empty groups are
  // skipped. Prefixes are sorted alphabetically for stability; the
  // "no-prefix" bucket (commands like "version") trails at the end.
  const groups = new Map<string, string[]>();
  for (const u of state.useCases) {
    const idx = u.command.indexOf(":");
    const prefix = idx !== -1 ? u.command.slice(0, idx) : "_other";
    const list = groups.get(prefix) ?? [];
    list.push(u.command);
    groups.set(prefix, list);
  }
  const sortedPrefixes = [...groups.keys()].sort((a, b) => {
    if (a === "_other") return 1;
    if (b === "_other") return -1;
    return a.localeCompare(b);
  });
  const parts: string[] = [];
  for (const prefix of sortedPrefixes) {
    const cmds = groups.get(prefix) ?? [];
    const label = prefix === "_other" ? "other" : `${prefix}:`;
    const items = cmds.map((c) => `<li><code>${escapeHtml(c)}</code></li>`).join("");
    parts.push(`<h4 style="margin-top: 16px; margin-bottom: 8px;">${escapeHtml(label)} <span class="muted">(${cmds.length})</span></h4>`);
    parts.push(`<ul>${items}</ul>`);
  }
  return section(`CLI commands (${state.useCases.length})`, parts.join(""), { id: "cli-commands" });
}

function renderTestsSection(state: ProjectState): string {
  const t = state.tests;
  if (t.running) {
    return section(
      "Tests",
      `<div class="theia-card theia-mono">running…</div>`,
      { id: "tests" },
    );
  }
  if (t.total === null) {
    return section(
      "Tests",
      `<div class="theia-warn-banner">tests unavailable: ${escapeHtml(t.reason ?? "unknown")}</div>`,
      { id: "tests" },
    );
  }
  const ok = t.fail === 0;
  const banner = ok
    ? ""
    : `<div class="theia-fail-banner">${t.fail} test${t.fail === 1 ? "" : "s"} failed</div>`;
  const failList = t.failingNames.length === 0
    ? ""
    : `<details><summary>${t.failingNames.length} failing</summary><ul>${t.failingNames.map((n) => `<li class="theia-mono">${escapeHtml(n)}</li>`).join("")}</ul></details>`;
  return section(
    "Tests",
    `${banner}<div class="theia-card">
      <div class="theia-mono">${t.pass}/${t.total} pass${t.fail !== null && t.fail > 0 ? `, ${t.fail} fail` : ""}</div>
      ${failList}
    </div>`,
    { id: "tests" },
  );
}

function renderDiffSection(state: ProjectState): string {
  const d = state.diff;
  // UX-008 P1-5: hide the section entirely when there is nothing
  // meaningful to say. On `main` the diff parser returns
  // available=true with commits=[] and filesChanged=0 — that case
  // used to render "Diff (branch main) · 0 files · +0 / -0 · No
  // commits ahead of main." which took vertical space and told
  // the user nothing. Now it renders nothing.
  if (!d.available) {
    return section(
      "Diff",
      `<p class="muted">${escapeHtml(d.reason ?? "no diff available")}</p>`,
      { id: "diff" },
    );
  }
  if (d.commits.length === 0 && d.filesChanged === 0) {
    return "";
  }
  const commitList = d.commits.slice(0, 10).map((c) => `<li>${escapeHtml(c.sha.slice(0, 7))} ${escapeHtml(c.subject)}</li>`).join("") + (d.commits.length > 10 ? `<li>… +${d.commits.length - 10} more</li>` : "");
  const branchLabel = d.branch !== null ? `branch <code>${escapeHtml(d.branch)}</code>` : "no branch";
  return section(
    `Diff (${branchLabel})`,
    `<div class="theia-card">
      <div class="theia-mono">${d.filesChanged} files · +${d.insertions} / -${d.deletions}</div>
      <ul class="theia-mono">${commitList}</ul>
    </div>`,
    { id: "diff" },
  );
}

function renderBlockersSection(state: ProjectState): string {
  // UX-008 P1-5: hide the section when there are no blockers AND
  // no next unlocks. Same rationale as the diff section — "No
  // specs currently blocked." took space and said nothing.
  if (state.blockers.length === 0 && state.nextUnlocks.length === 0) {
    return "";
  }
  const parts: string[] = [];
  if (state.blockers.length > 0) {
    const items = state.blockers.map((b) => {
      const unblockers = b.unblockers.map((u) => `<code>${escapeHtml(u.unblockerSlug)}</code>`).join(", ");
      return `<li><code>${escapeHtml(b.blockedSlug)}</code> blocked by ${unblockers}</li>`;
    }).join("");
    parts.push(`<h3>Blocked (${state.blockers.length})</h3><ul>${items}</ul>`);
  }
  if (state.nextUnlocks.length > 0) {
    const items = state.nextUnlocks.map((u) => `<li><code>${escapeHtml(u.slug)}</code> → would unblock ${u.unlocksCount}</li>`).join("");
    parts.push(`<h3>Next unlocks</h3><ul>${items}</ul>`);
  }
  return section("Blockers + next unlocks", parts.join(""), { id: "blockers" });
}

function section(title: string, body: string, opts: { id?: string } = {}): string {
  // UX-008: every section gets a stable id so a future jump-nav
  // (UX-009+) can deep-link without a layout change; browsers can
  // already resolve `#specs` / `#tests` / etc. today.
  const idAttr = opts.id !== undefined ? ` id="${escapeHtml(opts.id)}"` : "";
  return `<section class="theia-section"${idAttr}>
    <h3>${escapeHtml(title)}</h3>
    ${body}
  </section>`;
}