// CLI: rules:* — register, list, sweep RuleSets for a tenant.
// NO business logic lives here (per CommandContext pattern). Each command
// just parses args, dispatches to a use case in @daedalus/core, and renders
// the result.

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import {
  appendIntents,
  listRuleSourcesUseCase,
  startLineage,
  sweepStalenessUseCase,
  RuleSetRegistered,
  type CoreDeps,
} from "@daedalus/core";
import { defaultStalenessConfig } from "@daedalus/core/adapters";
import type { CommandHandler } from "./types.ts";
import { requireOpt } from "./types.ts";

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

const rulesRegister: CommandHandler = async ({ tenantId, values, deps }) => {
  const ruleset = requireOpt(values.ruleset, "ruleset");
  const file = requireOpt(values.file, "file");
  const at = ruleset.indexOf("@");
  if (at <= 0 || at === ruleset.length - 1) {
    throw new Error(`--ruleset must be "<ruleSetId>@<version>", got "${ruleset}"`);
  }
  const ruleSetId = ruleset.slice(0, at);
  const version = ruleset.slice(at + 1);
  assertSafeSegment(ruleSetId, "ruleSetId");
  assertSafeSegment(version, "version");
  assertSafeSegment(tenantId, "tenantId");

  const fullPath = isAbsolute(file) ? file : join("config/rulesets", tenantId, file);
  const resolved = resolve(fullPath);
  if (!existsSync(resolved)) {
    throw new Error(`rule set file not found: ${resolved}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(resolved, "utf8"));
  } catch (e) {
    throw new Error(
      `rule set file unreadable or malformed: ${resolved} (${e instanceof Error ? e.message : String(e)})`,
    );
  }
  if (parsed === null || typeof parsed !== "object") {
    throw new Error(`rule set file not an object: ${resolved}`);
  }
  const v = parsed as Record<string, unknown>;
  if (v["ref"] === null || typeof v["ref"] !== "object") {
    throw new Error(`rule set file missing "ref" object`);
  }
  const r = v["ref"] as Record<string, unknown>;
  if (r["ruleSetId"] !== ruleSetId || r["version"] !== version) {
    throw new Error(
      `rule set file does not match --ruleset: file says ${r["ruleSetId"]}@${r["version"]}, --ruleset says ${ruleSetId}@${version}`,
    );
  }

  const core = deps as CoreDeps;
  const lineage = startLineage(core.newId);
  const before = await core.eventStore.readStream(tenantId);
  await appendIntents(
    core,
    tenantId,
    [
      {
        type: RuleSetRegistered,
        payload: {
          ruleSetId: String(r["ruleSetId"]),
          version: String(r["version"]),
          effectiveFrom: String(r["effectiveFrom"] ?? ""),
          obligationsUri: file,
          ruleCount: Array.isArray(v["obligations"]) ? (v["obligations"] as unknown[]).length : 0,
          provenance: r["provenance"],
        },
      },
    ],
    lineage,
  );
  const after = await core.eventStore.readStream(tenantId);
  const event = after[after.length - 1];
  console.log(
    `${RuleSetRegistered}  tenant=${tenantId}  ruleset=${ruleSetId}@${version}  eventId=${event?.eventId ?? "?"}`,
  );
};

const rulesList: CommandHandler = async ({ tenantId, deps }) => {
  const baseDir = (deps.eventStore as unknown as { baseDir?: string }).baseDir ?? ".data";
  const fileExists = async (uri: string): Promise<boolean> => {
    return existsSync(resolve(join(baseDir, uri)));
  };
  const result = await listRuleSourcesUseCase(deps, defaultStalenessConfig(), {
    tenantId,
    fileExists,
  });
  if (result.rows.length === 0) {
    console.log(`(no registered rule sets for tenant ${tenantId})`);
    return;
  }
  const headers = ["ruleset", "version", "sourceKind", "verifiedBy", "ageM", "thM", "status"];
  const lines = [headers.join("\t")];
  for (const r of result.rows) {
    lines.push(
      [
        `${r.ruleSetId}@${r.version}`,
        r.effectiveFrom,
        r.sourceKind,
        r.verifiedBy,
        String(r.ageMonths),
        String(r.thresholdMonths),
        r.status,
      ].join("\t"),
    );
  }
  console.log(lines.join("\n"));
  console.log(
    `scanned=${result.scanned} ok=${result.ok} stale=${result.stale} missing=${result.missing}`,
  );
};

const rulesSweep: CommandHandler = async ({ tenantId, deps }) => {
  const result = await sweepStalenessUseCase(deps, defaultStalenessConfig(), { tenantId });
  console.log(
    `rules:sweep  tenant=${tenantId}  scanned=${result.scanned}  stale=${result.stale}`,
  );
};

export const handlers: Array<[string, CommandHandler]> = [
  ["rules:register", rulesRegister],
  ["rules:list", rulesList],
  ["rules:sweep", rulesSweep],
];