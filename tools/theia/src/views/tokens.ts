// Theia (Spec 012) — visual token re-export (PR 8).
//
// This is the **single allowed** exception to AC-15 ("no imports from
// `@daedalus/*`"): `views/tokens.ts` re-exports from Atlas's tokens
// so Theia inherits the project's visual language without diverging.
// Atlas never depends on Theia — this is a one-way read.
//
// Per ADR-007 + Spec 012 §7: Atlas never depends on Theia. The
// relative path is intentional; if Atlas ever gains a
// `"./views"` subpath export, this file can switch to it without
// any other changes (the re-exports below are the surface).

import { tokens, type Tokens } from "../../../../apps/atlas/src/tokens.ts";
import {
  escapeHtml,
  pageStyles,
  card,
  metric,
  tag,
  microLabel,
} from "../../../../apps/atlas/src/templates/paper.ts";

// UX-008: GitHub owner/repo, single source of truth for all
// outbound GitHub links (spec detail "Spec file" + code inventory
// links). Update here if the repo moves.
export const GITHUB_REPO = "hugomoraga/daedalus";

export { tokens, escapeHtml, pageStyles, card, metric, tag, microLabel };
export type { Tokens };