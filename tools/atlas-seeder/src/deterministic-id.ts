// Deterministic UUID-shaped ids for the seed scenario.
// Derives an id from sha256(seed || ":" || counter). Stable across runs and
// across machines — the seed scenario emits the same ids everywhere.
//
// UUID format (RFC 4122 §4.3): 32 hex chars with dashes at 8-4-4-4-12.
// We take 30 hex chars of the hash, then patch in version (4) and variant
// (10xx) so the id looks like a real v4 UUID to consumers that check.

import { createHash } from "node:crypto";

export function deterministicId(seed: string, counter: number): string {
  const hash = createHash("sha256").update(`${seed}:${counter}`).digest("hex");
  const v4Nibble = `4${hash[1] ?? "0"}${hash[2] ?? "0"}${hash[3] ?? "0"}`;          // group 3
  const variantNibble = (((parseInt(hash[5] ?? "0", 16) & 0x3) | 0x8).toString(16));   // 1 hex char
  const group4 = `${variantNibble}${hash[6] ?? "0"}${hash[7] ?? "0"}${hash[8] ?? "0"}`; // group 4
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${v4Nibble}-${group4}-${hash.slice(9, 21)}`;
}
