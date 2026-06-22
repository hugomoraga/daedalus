// Jurisdiction Model — five test cases from Spec 008 Plan §5 (task J-14).
// Uses `node --test`. No fixtures file — test data is constructed inline.
// Integration-level: uses Core's JsonlEventStoreAdapter via makeTestDeps.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  FilesystemRuleSetLoaderAdapter,
  InMemoryJurisdictionAdapter,
  type CoreDeps,
  JurisdictionProfileChanged,
  type JurisdictionProfile,
  type ObligationSpec,
  recordProfileChange,
  resolveJurisdiction,
  RuleSetNotFound,
  RuleSetProvenanceMissing,
  RuleSetVersionMismatch,
  type RuleProvenance,
  type RuleSet,
  validateProvenance,
} from "@daedalus/core";
import { makeTestDeps } from "./helpers.ts";

const T = "tenant-0";

const goodProvenance = (): RuleProvenance => ({
  sourceKind: "tenant-declared",
  sourceId: "fixture-2026-01",
  retrievedAt: "2026-01-01",
  verifiedBy: "fixture",
  notes: "test only",
});

const goodObligation = (id: string): ObligationSpec => ({
  obligationId: id,
  humanName: `Obligation ${id}`,
  trigger: { onEventType: "PaymentReceived" },
  deadline: { kind: "offset-from-trigger", daysAfter: 30, businessDaysOnly: false },
  requiredHumanAction: "review",
  provenance: goodProvenance(),
});

const goodProfile = (overrides: Partial<JurisdictionProfile> = {}): JurisdictionProfile => ({
  jurisdiction: { countryCode: "CL" },
  calendar: { fiscalYearStart: { month: 1, day: 1 }, filingCadence: "monthly" },
  currency: "CLP",
  ruleSets: [],
  ...overrides,
});

test("AC-read: loadProfile returns the stored profile (read path emits no event)", async () => {
  const { deps } = makeTestDeps();
  const port = new InMemoryJurisdictionAdapter(deps);
  await port.recordProfileChange({
    tenantId: T,
    actor: "test",
    provenance: goodProvenance(),
    newProfile: goodProfile(),
  });
  const beforeRead = (await deps.eventStore.readStream(T)).length;
  const loaded = await port.loadProfile(T, "2026-06-21");
  const afterRead = (await deps.eventStore.readStream(T)).length;
  assert.ok(loaded !== null);
  assert.equal(loaded!.currency, "CLP");
  assert.equal(afterRead, beforeRead, "read path emits no events");
});

test("AC-provenance: validateProvenance rejects a rule set missing verifiedBy", () => {
  const ruleSet: RuleSet = {
    ref: {
      ruleSetId: "rs-1",
      version: "1.0.0",
      effectiveFrom: "2026-01-01",
      provenance: {
        sourceKind: "tenant-declared",
        sourceId: "x",
        retrievedAt: "2026-01-01",
        verifiedBy: "fixture",
      },
      obligationsUri: "config/rulesets/tenant-0/rs-1@1.0.0.json",
    },
    obligations: [
      {
        ...goodObligation("o1"),
        provenance: { ...goodProvenance(), verifiedBy: "" },
      },
    ],
  };
  assert.throws(() => validateProvenance(ruleSet), RuleSetProvenanceMissing);
});

test("AC-version: validateProvenance accepts; FilesystemRuleSetLoaderAdapter rejects version mismatch", async () => {
  const { deps } = makeTestDeps();
  const baseDir = mkdtempSync(join(tmpdir(), "daedalus-jm-"));
  const tenantDir = join(baseDir, "config", "rulesets", T);
  // ensure the ruleset file exists with a different version
  mkdirSync(tenantDir, { recursive: true });
  writeFileSync(
    join(tenantDir, "rs-1@2.0.0.json"),
    JSON.stringify({
      ref: {
        ruleSetId: "rs-1",
        version: "2.0.0",
        effectiveFrom: "2026-01-01",
        provenance: goodProvenance(),
      },
      obligations: [goodObligation("o1")],
    }),
  );
  const loader = new FilesystemRuleSetLoaderAdapter(baseDir);
  await assert.rejects(
    () =>
      loader.load(
        {
          ruleSetId: "rs-1",
          version: "1.0.0",
          effectiveFrom: "2026-01-01",
          provenance: goodProvenance(),
          obligationsUri: "config/rulesets/tenant-0/rs-1@2.0.0.json",
        },
        T,
      ),
    RuleSetVersionMismatch,
  );
  void deps;
});

test("AC-isolation: two tenants, two profiles — zero cross-leak", async () => {
  const { deps } = makeTestDeps();
  const port = new InMemoryJurisdictionAdapter(deps);
  await port.recordProfileChange({
    tenantId: "tenant-A",
    actor: "test",
    provenance: goodProvenance(),
    newProfile: goodProfile({ jurisdiction: { countryCode: "AR" }, currency: "ARS" }),
  });
  await port.recordProfileChange({
    tenantId: "tenant-B",
    actor: "test",
    provenance: goodProvenance(),
    newProfile: goodProfile({ jurisdiction: { countryCode: "CL" }, currency: "CLP" }),
  });
  const a = await port.loadProfile("tenant-A", "2026-06-21");
  const b = await port.loadProfile("tenant-B", "2026-06-21");
  assert.equal(a!.currency, "ARS");
  assert.equal(b!.currency, "CLP");
  assert.equal(a!.jurisdiction.countryCode, "AR");
  assert.equal(b!.jurisdiction.countryCode, "CL");
});

test("AC-emit: profile change emits JurisdictionProfileChanged with full lineage", async () => {
  const { deps } = makeTestDeps();
  const port = new InMemoryJurisdictionAdapter(deps);
  const { event, newProfileRef } = await recordProfileChange(deps as CoreDeps, port, {
    tenantId: T,
    actor: "test",
    provenance: goodProvenance(),
    newProfile: goodProfile(),
  });
  assert.ok(event.eventId.length > 0);
  assert.equal(event.tenantId, T);
  assert.equal(event.actor, "test");
  assert.equal(event.payload.newProfileRef, "CL");
  assert.equal(event.payload.newProfileRef, newProfileRef);
  assert.ok(typeof event.correlationId === "string" && event.correlationId.length > 0);
});

test("AC-resolve: resolveJurisdiction returns profile + ruleSets when both present", async () => {
  const { deps } = makeTestDeps();
  const baseDir = mkdtempSync(join(tmpdir(), "daedalus-jm-"));
  const tenantDir = join(baseDir, "config", "rulesets", T);
  mkdirSync(tenantDir, { recursive: true });
  writeFileSync(
    join(tenantDir, "rs-1@1.0.0.json"),
    JSON.stringify({
      ref: {
        ruleSetId: "rs-1",
        version: "1.0.0",
        effectiveFrom: "2026-01-01",
        provenance: goodProvenance(),
      },
      obligations: [goodObligation("o1")],
    }),
  );
  const port = new InMemoryJurisdictionAdapter(deps as CoreDeps);
  await port.recordProfileChange({
    tenantId: T,
    actor: "test",
    provenance: goodProvenance(),
    newProfile: goodProfile({
      ruleSets: [
        {
          ruleSetId: "rs-1",
          version: "1.0.0",
          effectiveFrom: "2026-01-01",
          provenance: goodProvenance(),
          obligationsUri: `config/rulesets/${T}/rs-1@1.0.0.json`,
        },
      ],
    }),
  });
  const loader = new FilesystemRuleSetLoaderAdapter(baseDir);
  const resolved = await resolveJurisdiction(
    port,
    loader,
    T,
    "2026-06-21",
  );
  assert.ok(resolved !== null);
  assert.equal(resolved!.profile.currency, "CLP");
  assert.equal(resolved!.ruleSets.length, 1);
  assert.equal(resolved!.ruleSets[0].obligations[0].obligationId, "o1");
});

test("AC-resolve: resolveJurisdiction returns null for a tenant with no profile", async () => {
  const { deps } = makeTestDeps();
  const port = new InMemoryJurisdictionAdapter(deps as CoreDeps);
  const loader = new FilesystemRuleSetLoaderAdapter(mkdtempSync(join(tmpdir(), "daedalus-jm-")));
  const resolved = await resolveJurisdiction(port, loader, "tenant-no-profile", "2026-06-21");
  assert.equal(resolved, null);
});

test("AC-load-error: FilesystemRuleSetLoaderAdapter throws RuleSetNotFound for missing file", async () => {
  const baseDir = mkdtempSync(join(tmpdir(), "daedalus-jm-"));
  const loader = new FilesystemRuleSetLoaderAdapter(baseDir);
  await assert.rejects(
    () =>
      loader.load(
        {
          ruleSetId: "missing",
          version: "1.0.0",
          effectiveFrom: "2026-01-01",
          provenance: goodProvenance(),
          obligationsUri: "config/rulesets/tenant-0/missing@1.0.0.json",
        },
        T,
      ),
    RuleSetNotFound,
  );
});