// Theia (Spec 012) — per-phase detail view (UX-005).
//
// `renderPhaseDetail(n, state)` shows what a single phase contains:
//   - phase number + title (from the roadmap parser),
//   - roadmap milestone count (the parser counts `- **...**` bullets
//     between `## Phase N — ...` and the next `## ...` heading),
//   - active / not-active marker (matches the overview highlight),
//   - the list of specs whose `phase === n`, each linked to its
//     spec detail view.
// Unknown phase → "not found" page, mirrors the spec detail pattern.

import type { ProjectState, SpecCard } from "../types.ts";
import { renderLayout } from "./layout.ts";
import { escapeHtml, tag } from "./tokens.ts";

export function renderPhaseDetail(n: number, state: ProjectState): string {
  const phase = state.phases.find((p) => p.number === n);
  if (phase === undefined) {
    return renderLayout({
      title: `Phase ${n} · Theia`,
      body: `<p>Phase <code>${n}</code> not found.</p>
             <p><a href="/">← back to overview</a></p>`,
    });
  }
  const specsInPhase = state.specs
    .filter((s) => s.phase === n)
    .sort((a, b) => a.slug.localeCompare(b.slug));
  const isActive = n === state.activePhase;
  const activeTag = isActive ? tag("active", "ok") : "";
  const body = `
    <section class="theia-section">
      <h2>Phase ${n} — ${escapeHtml(phase.title)}</h2>
      <div class="theia-mono">phase: <code>${n}</code>${activeTag !== "" ? ` · ${activeTag}` : ""}</div>
      <div class="theia-mono">roadmap milestones: ${phase.milestoneCount}</div>
      <div class="theia-mono">specs in this phase: ${specsInPhase.length}</div>
      <h3 style="margin-top: 24px;">Specs</h3>
      ${renderPhaseSpecList(specsInPhase)}
      <p style="margin-top: 24px;"><a href="/">← back to overview</a></p>
    </section>`;
  return renderLayout({ title: `Phase ${n} · Theia`, body });
}

function renderPhaseSpecList(specs: readonly SpecCard[]): string {
  if (specs.length === 0) {
    return `<p class="muted">No specs assigned to this phase yet.</p>`;
  }
  const rows = specs.map((s) => {
    const tone = s.status === "Ratified" ? "ok" : s.status === "Blocked" ? "alert" : "neutral";
    return `<tr>
      <td style="padding: 4px 8px;" class="theia-mono">${tag(s.status, tone)}</td>
      <td style="padding: 4px 8px;" class="theia-mono"><a href="/specs/${escapeHtml(s.slug)}">${escapeHtml(s.slug)}</a></td>
      <td style="padding: 4px 8px;">${escapeHtml(s.title)}</td>
    </tr>`;
  }).join("");
  return `<table style="width:100%; border-collapse: collapse;">${rows}</table>`;
}
