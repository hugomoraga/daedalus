// FilesystemPolicyStore (Spec 009 task P-10) — reads policies from
// <baseDir>/<rulesUri>. Calls validatePolicyProvenance before returning.
// Throws PolicyNotFound / PolicyProvenanceMissing / PolicyVersionMismatch
// as documented in policy-store-port.ts. Mirrors the FilesystemRuleSetLoaderAdapter
// pattern from Spec 008.

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import type {
  Policy,
  PolicyRef,
} from "../../domain/policy/policy.ts";
import type {
  PolicyOutcome,
  PolicyMatch,
} from "../../domain/policy/policy.ts";
import type { PolicyProvenance } from "../../domain/policy/policy-provenance.ts";
import { validatePolicyProvenance } from "../../application/policy/validate-policy-provenance.ts";
import {
  PolicyNotFound,
  PolicyProvenanceMissing,
  PolicyVersionMismatch,
  type PolicyStorePort,
} from "../../application/policy/ports/policy-store-port.ts";

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

type PolicyFile = {
  ref: {
    policyId: string;
    version: string;
    effectiveFrom: string;
    provenance: PolicyProvenance;
    rulesUri?: string;
  };
  rules: Array<{
    ruleId: string;
    match: PolicyMatch;
    outcome: PolicyOutcome;
    escalateTo?: string;
    reason?: string;
  }>;
};

// Narrow type-check for PolicyMatch (only matters at validation time;
// the file loader uses a permissive read shape and the strict PolicyRule
// type does the narrowing).
function isPolicyFile(value: unknown): value is PolicyFile {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v["ref"] === null || typeof v["ref"] !== "object") return false;
  const r = v["ref"] as Record<string, unknown>;
  return (
    typeof r["policyId"] === "string" &&
    typeof r["version"] === "string" &&
    typeof r["effectiveFrom"] === "string" &&
    typeof r["provenance"] === "object" &&
    Array.isArray(v["rules"])
  );
}

export class FilesystemPolicyStore implements PolicyStorePort {
  #baseDir: string;

  constructor(baseDir: string) {
    this.#baseDir = baseDir;
  }

  async load(ref: PolicyRef, tenantId: string): Promise<Policy> {
    assertSafeSegment(tenantId, "tenantId");
    const file = join(this.#baseDir, ref.rulesUri);
    const resolved = resolve(file);
    const baseResolved = resolve(this.#baseDir);
    if (!resolved.startsWith(baseResolved + "/") && resolved !== baseResolved) {
      throw new PolicyNotFound(`rulesUri escapes baseDir: ${ref.rulesUri}`);
    }
    if (!existsSync(resolved)) {
      throw new PolicyNotFound(`policy file not found: ${ref.rulesUri}`);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(resolved, "utf8"));
    } catch (e) {
      throw new PolicyNotFound(
        `policy file unreadable or malformed: ${ref.rulesUri} (${e instanceof Error ? e.message : String(e)})`,
      );
    }
    if (!isPolicyFile(parsed)) {
      throw new PolicyProvenanceMissing(
        `policy file missing required ref/rules shape: ${ref.rulesUri}`,
      );
    }
    if (parsed.ref.version !== ref.version) {
      throw new PolicyVersionMismatch(
        `policy version mismatch: ref=${ref.version} file=${parsed.ref.version} (${ref.rulesUri})`,
      );
    }
    const policy: Policy = {
      ref: {
        policyId: parsed.ref.policyId,
        version: parsed.ref.version,
        effectiveFrom: parsed.ref.effectiveFrom,
        provenance: parsed.ref.provenance,
        rulesUri: ref.rulesUri,
      },
      rules: parsed.rules,
    };
    validatePolicyProvenance(policy);
    return policy;
  }
}