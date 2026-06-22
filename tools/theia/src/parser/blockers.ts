// Theia (Spec 012) — blocker graph parser (PR 5).
//
// `parseBlockers(specs)` augments the parsed spec cards with their
// unblocker lists; `computeNextUnlocks(specs)` ranks non-Ratified
// specs by how many BLOCKED specs each one would unblock.
//
// **Blocker convention (Spec §11 Q2 resolution):** the parser tries
// three sources, in order:
//   1. `**Unblocked by:**` line — preferred, explicit. Format:
//      `**Unblocked by:** [Spec 008](../008-.../spec.md) (B1) · [Spec 010]`
//   2. `**Depends on:**` line — same format, fallback.
//   3. `## N. Blockers` / `## Blockers` section — last-resort text
//      scan for `Spec NNN-...` or `ADR-NNN` references.
//
// Specs without any of these get an empty blockers list (no
// inference). The fallback `tools/theia/data/blockers.json`
// mentioned in Q2 is **not** shipped in PR 5 — the convention above
// covers every real spec in the repo. Add the file later if a
// spec lacks the metadata.

import type { BlockerEntry, SpecCard } from "../types.ts";

const UNBLOCKED_BY_RE = /^\*\*(?:Unblocked by|Depends on):\*\*\s*(.+?)\s*$/m;
const SECTION_HEADER_RE = /^##\s+(?:\d+\.\s+)?Blockers?\s*$/m;
// Match a spec or ADR reference: "Spec 008-...", "008-...", "ADR-007".
const SPEC_REF_RE = /(?:Spec\s+)?(\d{3})-[a-z0-9-]+|ADR-(\d{3})/gi;
const SPEC_LINK_RE = /\[(?:Spec\s+)?(\d{3})-[a-z0-9-]+\]\(([^)]+)\)/g;

export function parseBlockers(specs: SpecCard[], specContents: Map<string, string>): void {
  for (const card of specs) {
    const content = specContents.get(card.slug) ?? "";
    card.blockers = extractBlockers(content);
  }
}

function extractBlockers(content: string): BlockerEntry[] {
  if (content.length === 0) return [];
  // 1. Try `**Unblocked by:**` / `**Depends on:**` line.
  const lineMatch = content.match(UNBLOCKED_BY_RE);
  if (lineMatch !== null && lineMatch[1] !== undefined) {
    return parseRefList(lineMatch[1]);
  }
  // 2. Try a `## Blockers` section.
  const sectionMatch = content.match(SECTION_HEADER_RE);
  if (sectionMatch !== null) {
    const tail = content.slice(sectionMatch.index! + sectionMatch[0].length);
    // Stop at the next `## ` heading.
    const nextSection = tail.search(/^##\s+/m);
    const sectionBody = nextSection >= 0 ? tail.slice(0, nextSection) : tail;
    return parseRefList(sectionBody);
  }
  return [];
}

function parseRefList(text: string): BlockerEntry[] {
  const seen = new Set<string>();
  const entries: BlockerEntry[] = [];
  // First try the markdown link form `[Spec NNN-slug](path)` — it
  // carries the slug and is preferred.
  for (const match of text.matchAll(SPEC_LINK_RE)) {
    const num = match[1];
    if (num === undefined) continue;
    const slug = num;
    if (seen.has(slug)) continue;
    seen.add(slug);
    entries.push({ unblockerSlug: slug, unblockerKind: "spec" });
  }
  // Then the loose form: "Spec NNN-slug", "NNN-slug", "ADR-NNN".
  for (const match of text.matchAll(SPEC_REF_RE)) {
    const num = match[1] ?? match[2];
    if (num === undefined) continue;
    const isAdr = match[2] !== undefined;
    const slug = `${isAdr ? "ADR-" : ""}${num}`;
    if (seen.has(slug)) continue;
    seen.add(slug);
    entries.push({ unblockerSlug: slug, unblockerKind: isAdr ? "adr" : "spec" });
  }
  return entries;
}

// Rank non-Ratified specs by how many BLOCKED specs list them as
// an unblocker. Higher = more impactful. Ratified specs are excluded
// from the ranking (already shipped; no point unblocking with them).
export type NextUnlock = { slug: string; unlocksCount: number };

export function computeNextUnlocks(specs: readonly SpecCard[]): NextUnlock[] {
  const counts = new Map<string, number>();
  for (const card of specs) {
    if (card.status !== "Blocked") continue;
    for (const b of card.blockers) {
      if (b.unblockerKind !== "spec") continue;
      counts.set(b.unblockerSlug, (counts.get(b.unblockerSlug) ?? 0) + 1);
    }
  }
  const ratified = new Set(specs.filter((s) => s.status === "Ratified").map((s) => s.slug));
  const out: NextUnlock[] = [];
  for (const [slug, unlocksCount] of counts) {
    if (ratified.has(slug)) continue;
    out.push({ slug, unlocksCount });
  }
  // Sort by count descending, then slug ascending for stability.
  out.sort((a, b) => b.unlocksCount - a.unlocksCount || a.slug.localeCompare(b.slug));
  return out;
}