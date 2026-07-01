# ADR-012 — Adopt the ui-ux-pro-max agent skill (with guard rails)

**Status:** Proposed
**Date:** 2026-07-01
**Deciders:** Stewards
**Trigger:** The founder installed `ui-ux-pro-max-cli` on 2026-06-30 and applied 4 items from the skill's pre-delivery checklist to the Theia polish work (UX-008, PR #108). The install and application happened *before* an ADR recorded the decision. UX-008's PR description flagged the missing ADR as the "open decision" follow-up. This ADR records the install, the scope, and the guard rails.
**Related:** [Constitution](../../memory/constitution.md), [Technical Principles](../../memory/technical-principles.md), [Identity](../../docs/identity.md), [Roadmap](../../docs/roadmap.md), [ADR-002](./ADR-002-adopt-technical-framework.md), [ADR-005](./ADR-005-atlas-driving-adapter.md) (Atlas owns the design tokens), [ADR-007](./ADR-007-theia-as-tools-directory.md) (Theia reuses Atlas's tokens), [ADR-010](./ADR-010-platform-api-driving-adapter.md) (the Platform API is the consumer of any new visual surface), [ADR-011](./ADR-011-athena-driving-adapter.md) (Athena is the next visual surface after Theia), [Spec 007](../../specs/007-atlas-mission-control/spec.md) (Atlas AC-5 token linter), [Spec 012](../../specs/012-theia/spec.md) (Theia reuses Atlas's tokens, read-only), [Spec 017](../../specs/017-athena-founder-cockpit/spec.md) (Athena design discipline), [AGENTS.md](../../AGENTS.md)

---

## Context

Daedalus's organisational Core is opinionated about *what* the system does and *how* it's built (Constitution, Technical Principles, ADRs). It is also opinionated about the visual language: a single token scale lives in `apps/atlas/src/tokens.ts`, the typography trio is fixed (Inter Tight / Inter / JetBrains Mono, Atlas AC-11), and every surface that displays to a human — Atlas, Theia, the future Athena — reuses those tokens. The discipline is structural, not advisory: Atlas AC-5 (token linter) and AC-11 (canonical typography) are binding acceptance criteria, and every PR is checked against them in CI.

What the canon has **not** formalised is the *process* of arriving at a design decision when a new visual surface is being built. Today, a contributor picking the right palette, the right typography mood, or the right spacing rhythm for a new panel has no documented playbook. They improvise within the token constraints, which is correct but slow, and the result is uneven across surfaces.

On 2026-06-30 the founder installed [ui-ux-pro-max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) — a community-maintained agent skill (≈100k stars, MIT, last release 4 days prior) that bundles:
- 161 reasoning rules for industry-specific design systems (data-dense dashboards, mission control, founder cockpits, etc.)
- 67 UI styles (editorial paper, Swiss, glassmorphism, dark mode OLED, …)
- 161 colour palettes, 57 font pairings, design-token generators
- A pre-delivery checklist (cursor-pointer, hover states, contrast 4.5:1, focus-visible, prefers-reduced-motion, responsive 375/768/1024/1440)
- A stack-specific guideline library covering 22 stacks (React Native, Jetpack Compose, SwiftUI, …)
- A BM25 search engine over the reference data (`python3 .opencode/skills/ui-ux-pro-max/scripts/search.py "…" --design-system`)
- A CLI installer (`npm install -g ui-ux-pro-max-cli`; `uipro init --ai <platform>`) supporting 20+ AI agents including **OpenCode**

The skill is **not** a framework, **not** a runtime dep, and **not** something the platform ships. It is *agent context* — material the opencode (or any other agent) reads to make better design recommendations during a session.

UX-008 (PR #108, Theia overview polish) was the first task to consult the skill. The result, as documented in the PR description and in `docs/backlog.md` UX-008, was: **adopted 4 items, rejected 5**. Adopted: hover transitions, `:focus-visible` outline, `prefers-reduced-motion: reduce` media query, and a documented WCAG 4.5:1 contrast pass on Atlas tokens (all pairs verified AA or better). Rejected: dark mode OLED (`#0F172A` + `#22C55E`), Fira Code / Fira Sans typography, Google Fonts `@import url(...)`, Heroicons / Phosphor, and a 2-column overview layout — each conflicts with the Daedalus canon (Atlas AC-5 token linter, Atlas AC-11 typography trio, Spec 012 §7 no external network / no CDN / zero runtime deps).

The install + adoption happened without an ADR. Per the Canon (Constitution §5: *Decisions live in the repo, not in any agent's chat memory*), the decision deserves an ADR. This is that ADR.

---

## Decision

1. **Adopt `ui-ux-pro-max` as authorised agent tooling.** The skill is installed under `.opencode/skills/ui-ux-pro-max/` per session/worktree (re-installed on demand via `uipro init --ai opencode`; the install is local agent context, not platform code). The skill is **not** an architectural change to the platform; it is a process aid for the agents that build the platform.

2. **Scope is narrow: only when designing a *new* user-facing visual surface.** Specifically:
   - **In scope:** new Atlas panels, the Athena founder cockpit (Spec 017), future web surfaces (docs site, landing). Each new surface consults the skill's design-system generator to pick a style/colour/typography mood, then translates those into Atlas tokens (Atlas AC-5 + AC-11).
   - **Out of scope (explicit):** Theia (Spec 012). Theia is intentionally minimal — its discipline is "no new design system, reuse Atlas's tokens" (Spec 012 §1, ADR-007 §5). The skill's recommendations that would *change* Theia's tokens are rejected; the recommendations that *complement* Atlas's discipline (hover, focus, reduced-motion, contrast) are reusable but token-disciplined.
   - **Out of scope (explicit):** platform infrastructure (parsers, runners, use cases, projections), tests, ADRs themselves, and any non-UI work. The skill is not relevant there.

3. **Guard rails (binding, not advisory):**
   - **Token discipline is the only output.** The skill suggests colour hex, font names, spacing values; those are *inputs to the design process*, not final values. The final colour, font, or spacing comes from `apps/atlas/src/tokens.ts` (Atlas AC-5 linter) — the skill's suggestion must be added there, never inlined in any view file. The token linter (Spec 012 AC-11, Atlas AC-5) runs in CI and would reject an inline colour literal in `tools/theia/src/views/*.ts` regardless of which agent proposed it.
   - **No external network, no CDN, no runtime dep.** Spec 012 §7 forbids any external network or CDN. The skill's recommendations that imply loading fonts from Google Fonts (e.g. its typography catalogue) are rejected. The skill's recommendations that imply runtime icon libraries (Heroicons, Phosphor) are rejected. Only the *design language* is adopted; the assets stay local.
   - **No new design system.** Atlas's tokens are the single source. If the skill suggests a colour that doesn't exist in Atlas's palette, the steward (1) decides whether to add it to `apps/atlas/src/tokens.ts` (then both Atlas and Theia re-import) or (2) maps it to the closest existing token. Same for typography and spacing.
   - **Theia's reuse pattern is unchanged.** Per ADR-007 §5 and Spec 012 §1, Theia re-uses Atlas's tokens. The skill may inform *which* existing token is the best fit, but it cannot introduce a Theia-only token.

4. **The pre-delivery checklist items are reusable.** The skill's pre-delivery checklist enumerates universal a11y hygiene:
   - cursor-pointer on interactive elements
   - hover states with smooth transitions (150–300ms ease)
   - `:focus-visible` outline for keyboard nav
   - text contrast 4.5:1 (WCAG AA)
   - `prefers-reduced-motion: reduce` media query
   - responsive at 375 / 768 / 1024 / 1440 px
   - no emojis as functional icons
   These are platform-agnostic best practices. **Adopting them is encouraged for every visual surface in scope**, but the *implementation* must use Atlas tokens (transition: 200ms ease, not arbitrary; outline: 2px solid var(--accent), not arbitrary). UX-008 (PR #108) adopted 4 of these (hover, focus-visible, reduced-motion, contrast) for Theia; future Atlas/Athena work adopts the rest where they apply.

5. **Documentation obligations when the skill informs a change.** When an agent uses the skill to inform a UI change, the PR description must:
   - List the skill's recommendations that were **adopted** and how they map to Atlas tokens.
   - List the skill's recommendations that were **rejected** and why (conflict with which canon item).
   - List the design-system prompt used (so a reviewer can reproduce the consultation).
   This keeps the audit trail honest (Constitution §4: *Auditability by Default*) without forcing a separate ADR per design decision. A standalone ADR is only needed when the change introduces a *new* design discipline (e.g. adopting dark mode would require its own ADR per the "Web UI" item in the Technical Principles' Avoid-for-now list).

6. **Update cadence.** The skill is on semantic-release (each `feat:` → minor). Pin a specific version in the session that installs it (`uipro init` records the version in the install path); upgrade deliberately, with steward approval, not via `latest`. The skill's last release as of this ADR was 2.10.0 (4 days before install). Upgrades that change the pre-delivery checklist or the design-system search API require a brief note in `docs/backlog.md` (no separate ADR).

7. **Premium version is NOT adopted.** The skill's README mentions a paid Premium version with deeper coverage. The open-source Basic version (the one installed) is full-featured for our scope; no paid APIs, no steward approval needed. **If the Premium version is ever adopted, this ADR requires amendment** (or a superseding ADR) before any consultation uses it.

---

## Consequences

**Positive.**

- **Better first-pass design decisions.** A new Atlas panel or Athena surface starts with a *referenced* style/colour/typography mood instead of an improvised one. The skill's 161 reasoning rules surface options the contributor wouldn't think of ("for a founder cockpit with mission-control density, the editorial paper palette + Swiss layout is the canonical fit, not dark mode"). The 161-colour palette saves an hour of `oklch()` experimentation per surface.
- **A11y hygiene by default.** The pre-delivery checklist (hover, focus-visible, contrast, reduced-motion) is already adopted for Theia (UX-008). Extending it to Atlas panels and Athena from day one saves the steward review from flagging the same five issues every PR.
- **No new platform code.** The skill is local agent context (`.opencode/skills/`), gitignored since UX-008 commit 1. It does not appear in any package, runtime, build, or test. The platform stays canonical.
- **Auditable process.** The PR description obligation (§5) means a reviewer can see *which* skill prompts were consulted and *which* recommendations were adopted or rejected. The auditability principle (Constitution §4) is upheld without forcing a separate ADR per design touch.

**Negative / accepted.**

- **Skill is a moving target.** Semantic-release means the recommendation catalogue evolves. Pinning to a version (§6) is the mitigation; the version is recorded in the install path and re-installed per session.
- **Discipline drift risk.** An over-eager agent might apply skill recommendations that *look* aligned with Atlas tokens but introduce a new style (e.g. an unjustified glassmorphism effect via `backdrop-filter`). *Mitigation:* Atlas AC-5 token linter + the PR description's adopted/rejected list + steward review. Three layers of defence; drift would have to pass all three.
- **The Premium version may eventually be tempting** (deeper coverage, better search, paid assets). *Mitigation:* §7 requires an ADR amendment or a superseding ADR before any Premium adoption. The canon is not a moving target even if the tooling is.
- **Theia's reuse pattern could drift.** The skill's recommendations that *would* add a Theia-only style are explicitly out of scope (§3), but an over-eager agent could still propose them. *Mitigation:* the same Theia-rejects-external-style rule that ADR-007 §5 documents; the AGENTS.md note (companion change) reminds the agent that Theia is intentionally minimal.

**Cost.**

- The skill data (~2.9 MB, 147 files) lives under `.opencode/skills/`. UX-008 commit 1 added `.opencode/` to `.gitignore`; the data is never committed, never deployed. Re-install per session via `uipro init --ai opencode` (≈1 s after the global `npm install -g ui-ux-pro-max-cli`).
- One new ADR (this one) + one small companion change to `AGENTS.md` that documents the skill as authorised agent tooling under the conditions above. No spec amendment, no canon change, no new package.
- PR descriptions for in-scope UI work grow by ~10 lines (the adopted/rejected list). Negligible.

---

## What this ADR does NOT do

- Does **not** authorise the Premium version of the skill. See §7.
- Does **not** authorise a new design system or new design tokens *outside* `apps/atlas/src/tokens.ts`. Token discipline is unchanged.
- Does **not** authorise external network calls (Google Fonts CDN, font/image CDNs). Spec 012 §7 stands.
- Does **not** authorise external icon libraries (Heroicons, Phosphor, Lucide). Spec 012 §7 stands.
- Does **not** amend the Constitution, Technical Principles, Identity, or Roadmap. This ADR records the *process* of arriving at design decisions, not the decisions themselves.
- Does **not** change the "Web UI" item in the Technical Principles' Avoid-for-now list. That list's three named exceptions (Atlas, the Platform API, Athena) stand; the skill is a process aid for working within those exceptions, not a fourth exception.
- Does **not** amend any ratified spec's intent. Specs 007, 012, 017 are unaffected in their text; the skill is referenced from this ADR only.

---

## Acceptance (gate for steward ratification)

This ADR becomes **Accepted** when **all** of the following hold:

1. **A steward ratifies this ADR explicitly.** The decision to retroactively cover the 2026-06-30 install + UX-008 application is taken, with awareness that both happened before this ADR was drafted. *(Pending — this PR.)*
2. **The companion change to `AGENTS.md`** documents the skill in the agent-tooling section (where `ui-ux-pro-max` is named, scope is restated, and the AGENTS.md footnote that the skill is a process aid — not a runtime dep — is included). *(Pending — this PR.)*
3. **No spec is amended** by this ADR; no canon document is amended; the project's CI is unchanged (the token linter + no-platform-imports linter already enforce the relevant constraints). *(Met.)*

Once ratified, future UI work (Atlas panels, Athena, public web) follows §2 scope + §3 guard rails + §5 PR description obligations. No new ADR is needed for routine design decisions; an ADR is needed only when adopting a *new* design discipline (e.g. dark mode, a new typography family, an external icon set) or when upgrading to the Premium version (§7).

---

## Companion change

This ADR ships together with a minimal amendment to [AGENTS.md](../../AGENTS.md):

- Add `ui-ux-pro-max` to the agent-tooling section, named as authorised per ADR-012 with the scope + guard rails restated in a single paragraph.
- Footnote: the skill is a process aid (design-language reference data + a11y checklist), not a runtime dep; not visible in the platform's runtime; `.opencode/` is gitignored since UX-008 commit 1.

No other sections of AGENTS.md change. The Canon (Constitution, Technical Principles, Identity, Roadmap) is untouched. No ratified spec is amended.

---

*Subordinate to the [Constitution](../../memory/constitution.md) and [Technical Principles](../../memory/technical-principles.md). Adopts a process aid, not a new design discipline. The skill informs; the canon decides.*