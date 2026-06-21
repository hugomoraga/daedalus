// Design tokens — the single source of truth for color, typography, and spacing.
// Spec 007 §10. No file outside tokens.ts may declare a raw color literal, a
// font-family outside the canonical trio, or a numeric spacing outside the scale.

export type Tokens = {
  color: {
    paper: string;
    card: string;
    ink: string;
    neutral: string;
    accent: string;
    rule: string;
    ok: string;
    warn: string;
    alert: string;
  };
  type: {
    display: string;
    body: string;
    mono: string;
  };
  space: {
    readonly scale: readonly number[];
    s1: number;
    s2: number;
    s3: number;
    s4: number;
    s5: number;
    s6: number;
    s7: number;
    s8: number;
    s9: number;
  };
};

const SPACING_SCALE = [4, 8, 12, 16, 24, 32, 48, 64, 96] as const;

export const tokens: Tokens = {
  color: {
    paper: "#F7F5F2",
    card: "#FBFAF8",
    ink: "#111111",
    neutral: "#6A6A6A",
    accent: "#4A6FA5",
    rule: "rgba(17, 17, 17, 0.08)",
    ok: "#3F6E4A",
    warn: "#8A6A2E",
    alert: "#8A3E3E",
  },
  type: {
    display: '"Inter Tight", system-ui, -apple-system, "Segoe UI", sans-serif',
    body: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
    mono: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace',
  },
  space: {
    scale: SPACING_SCALE,
    s1: SPACING_SCALE[0],
    s2: SPACING_SCALE[1],
    s3: SPACING_SCALE[2],
    s4: SPACING_SCALE[3],
    s5: SPACING_SCALE[4],
    s6: SPACING_SCALE[5],
    s7: SPACING_SCALE[6],
    s8: SPACING_SCALE[7],
    s9: SPACING_SCALE[8],
  },
};