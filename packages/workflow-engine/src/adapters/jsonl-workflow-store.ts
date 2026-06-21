// Driven adapter: reads workflow artifacts from disk.
//   <baseDir>/blueprints/workflows/*.json              (defaults, versioned, immutable)
//   <baseDir>/config/tenants/<tenant>/workflows.json   (tenant overrides)
// Per-tenant overrides take precedence on (name, version) collision. A
// malformed artifact fails the load (Spec 008 §7 — engine fails closed).

import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import type { Workflow } from "../domain/workflow.ts";
import type { WorkflowStorePort } from "../application/ports/workflow-store.ts";

function assertSafeSegment(value: string, name: string): void {
  if (value.length === 0) throw new Error(`${name} must not be empty`);
  if (
    isAbsolute(value) ||
    value.includes("/") ||
    value.includes("\\") ||
    value.includes("\0") ||
    value === "." ||
    value === ".."
  ) {
    throw new Error(`${name} must be a single path segment`);
  }
}

function assertUnder(base: string, candidate: string, label: string): void {
  const resolved = resolve(candidate);
  const baseResolved = resolve(base);
  if (!resolved.startsWith(baseResolved + "/") && resolved !== baseResolved) {
    throw new Error(`${label} escapes baseDir: ${candidate}`);
  }
}

function isWorkflow(value: unknown): value is Workflow {
  if (value === null || typeof value !== "object") return false;
  const w = value as Record<string, unknown>;
  return (
    typeof w["name"] === "string" &&
    typeof w["version"] === "string" &&
    typeof w["initial"] === "string" &&
    Array.isArray(w["terminal"]) &&
    typeof w["states"] === "object" &&
    w["states"] !== null &&
    typeof w["contexts"] === "object" &&
    w["contexts"] !== null
  );
}

export class JsonlWorkflowStoreAdapter implements WorkflowStorePort {
  #baseDir: string;

  constructor(baseDir: string) {
    this.#baseDir = baseDir;
  }

  async loadFor(tenantId: string): Promise<Workflow[]> {
    assertSafeSegment(tenantId, "tenantId");
    const defaults: Workflow[] = [];
    const defaultDir = join(this.#baseDir, "blueprints", "workflows");
    if (existsSync(defaultDir)) {
      const files = await readdir(defaultDir);
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const path = join(defaultDir, file);
        assertUnder(defaultDir, path, "workflow file");
        const parsed = JSON.parse(await readFile(path, "utf8"));
        if (!isWorkflow(parsed)) {
          throw new Error(`malformed workflow artifact: ${path}`);
        }
        defaults.push(parsed);
      }
    }
    const overrides: Workflow[] = [];
    const tenantFile = join(this.#baseDir, "config", "tenants", tenantId, "workflows.json");
    if (existsSync(tenantFile)) {
      assertUnder(this.#baseDir, tenantFile, "tenant workflows file");
      const parsed = JSON.parse(await readFile(tenantFile, "utf8"));
      if (!Array.isArray(parsed)) {
        throw new Error(`tenant workflows.json must be an array: ${tenantFile}`);
      }
      for (const entry of parsed) {
        if (!isWorkflow(entry)) {
          throw new Error(`malformed workflow override in ${tenantFile}`);
        }
        overrides.push(entry);
      }
    }
    // Tenant overrides replace defaults on (name, version) collision.
    const map = new Map<string, Workflow>();
    for (const w of defaults) map.set(`${w.name}@${w.version}`, w);
    for (const w of overrides) map.set(`${w.name}@${w.version}`, w);
    return Array.from(map.values());
  }
}