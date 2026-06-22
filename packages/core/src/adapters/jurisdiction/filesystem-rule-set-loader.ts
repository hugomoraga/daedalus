// FilesystemRuleSetLoaderAdapter (Spec 008 Plan §1, task J-10).
// Reads rule sets from <baseDir>/<obligationsUri>. Calls validateProvenance
// before returning. Throws RuleSetNotFound / RuleSetVersionMismatch /
// RuleSetProvenanceMissing as documented in rule-set-loader-port.ts.

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import type { RuleSet, RuleSetRef } from "../../domain/jurisdiction/rule-set.ts";
import type { ObligationSpec, RuleProvenance } from "../../domain/jurisdiction/rule-provenance.ts";
import { validateProvenance } from "../../application/jurisdiction/validate-provenance.ts";
import {
  RuleSetNotFound,
  RuleSetProvenanceMissing,
  RuleSetVersionMismatch,
  type RuleSetLoaderPort,
} from "../../application/jurisdiction/ports/rule-set-loader-port.ts";

function assertSafeSegment(value: string, name: string): void {
  if (value.length === 0) throw new Error(`${name} must not be empty`);
  if (
    isAbsolute(value) ||
    value.includes("..") ||
    value.includes("\0") ||
    value === "." ||
    value === ".."
  ) {
    throw new Error(`${name} must be a single safe path segment`);
  }
}

type RuleSetFile = {
  ref: {
    ruleSetId: string;
    version: string;
    effectiveFrom: string;
    source: RuleProvenance;
    obligationsUri?: string;
  };
  obligations: ObligationSpec[];
};

function isRuleSetFile(value: unknown): value is RuleSetFile {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v["ref"] === null || typeof v["ref"] !== "object") return false;
  const r = v["ref"] as Record<string, unknown>;
  return (
    typeof r["ruleSetId"] === "string" &&
    typeof r["version"] === "string" &&
    typeof r["effectiveFrom"] === "string" &&
    typeof r["provenance"] === "object" &&
    Array.isArray(v["obligations"])
  );
}

export class FilesystemRuleSetLoaderAdapter implements RuleSetLoaderPort {
  #baseDir: string;

  constructor(baseDir: string) {
    this.#baseDir = baseDir;
  }

  async load(ruleSetRef: RuleSetRef, tenantId: string): Promise<RuleSet> {
    // tenantId is a single path segment (defense in depth; rulesets live
    // under config/rulesets/<tenant>/).
    assertSafeSegment(tenantId, "tenantId");
    // obligationsUri is relative to baseDir; resolve and verify it stays under.
    const file = join(this.#baseDir, ruleSetRef.obligationsUri);
    const resolved = resolve(file);
    const baseResolved = resolve(this.#baseDir);
    if (!resolved.startsWith(baseResolved + "/") && resolved !== baseResolved) {
      throw new RuleSetNotFound(`obligationsUri escapes baseDir: ${ruleSetRef.obligationsUri}`);
    }
    if (!existsSync(resolved)) {
      throw new RuleSetNotFound(`rule set file not found: ${ruleSetRef.obligationsUri}`);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(resolved, "utf8"));
    } catch (e) {
      throw new RuleSetNotFound(
        `rule set file unreadable or malformed: ${ruleSetRef.obligationsUri} (${e instanceof Error ? e.message : String(e)})`,
      );
    }
    if (!isRuleSetFile(parsed)) {
      throw new RuleSetProvenanceMissing(
        `rule set file missing required ref/obligation shape: ${ruleSetRef.obligationsUri}`,
      );
    }
    if (parsed.ref.version !== ruleSetRef.version) {
      throw new RuleSetVersionMismatch(
        `rule set version mismatch: ref=${ruleSetRef.version} file=${parsed.ref.version} (${ruleSetRef.obligationsUri})`,
      );
    }
    const ruleSet: RuleSet = {
      ref: {
        ruleSetId: parsed.ref.ruleSetId,
        version: parsed.ref.version,
        effectiveFrom: parsed.ref.effectiveFrom,
        provenance: parsed.ref.provenance,
        obligationsUri: ruleSetRef.obligationsUri,
      },
      obligations: parsed.obligations,
    };
    validateProvenance(ruleSet); // throws RuleSetProvenanceMissing if any field is missing
    return ruleSet;
  }
}