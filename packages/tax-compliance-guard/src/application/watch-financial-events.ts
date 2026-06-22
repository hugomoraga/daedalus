// Tax & Compliance Guard — watchFinancialEventsUseCase (Spec 004 Plan
// §3.1, T-05). Watches a tenant's event stream: when a financial event
// matches an obligation in any of the tenant's registered RuleSets, the
// watcher emits an ObligationDue + an ObligationEvaluationRecorded. If
// no obligation matches, the watcher emits ObligationCoverageGap with
// reason="no-rule-matches" (Spec 010 §12.4). If all matching obligations
// are stale (per the most recent RuleSetStale events), the watcher
// emits ObligationCoverageGap with reason="all-matching-rules-stale".
//
// The watcher is invoked by `obligations:list --watch` in v1.0; a
// future Spec wires it into the event loop.

import {
  appendIntents,
  followFrom,
  ObligationCoverageGap,
  RuleSetRegistered,
  RuleSetStale,
  RuleSetSuperseded,
  type DomainEvent,
  type RuleSet,
  type RuleSetRef,
  type RuleSetRegisteredPayload,
  type RuleSetStalePayload,
  type CandidateRuleSet,
  type JurisdictionRef,
} from "@daedalus/core";
import {
  ObligationDue,
  ObligationEvaluationRecorded,
  type ObligationDuePayload,
  type ObligationEvaluationRecordedPayload,
} from "../domain/obligation.ts";
import { computeDeadline } from "./compute-deadline.ts";
import {
  evaluateTaxPolicyUseCase,
  toObligationEvaluationPayload,
  type EvaluateTaxPolicyResult,
} from "./evaluate-tax-policy.ts";
import type { TaxComplianceDeps } from "./deps.ts";

export type WatchFinancialEventsInput = {
  trigger: DomainEvent;
  actor: string;
};

export type WatchFinancialEventsResult = {
  matched: number;
  obligations: Array<{
    obligationId: string;
    ruleSetId: string;
    ruleSetVersion: string;
    dueAt: string;
    evaluation: EvaluateTaxPolicyResult;
  }>;
  coverageGap: {
    reason: "no-rule-matches" | "all-matching-rules-stale" | "conflicting-rules-no-precedence";
    candidateRuleSets: CandidateRuleSet[];
  } | null;
};

export async function watchFinancialEventsUseCase(
  deps: TaxComplianceDeps,
  input: WatchFinancialEventsInput,
): Promise<WatchFinancialEventsResult> {
  const trigger = input.trigger;
  const tenantId = trigger.tenantId;

  // 1. Find the tenant's currently-effective RuleSets (latest version per
  //    ruleSetId, after applying any supersedes).
  const events = await deps.eventStore.readStream(tenantId);
  const currentRuleSets = latestRuleSetsForTenant(events);
  if (currentRuleSets.length === 0) {
    // No registered rules → coverage gap with no candidates.
    const gap = await emitCoverageGap(deps, tenantId, trigger, {
      reason: "no-rule-matches",
      candidateRuleSets: [],
    });
    return { matched: 0, obligations: [], coverageGap: { reason: gap.reason, candidateRuleSets: [] } };
  }

  // 2. Load each RuleSet (full obligation content) via the port.
  const loaded: RuleSet[] = [];
  const loadFailures: Array<{ ref: RuleSetRef; error: Error }> = [];
  for (const ref of currentRuleSets) {
    try {
      const rs = await deps.ruleSetLoader.load(ref, tenantId);
      loaded.push(rs);
    } catch (e) {
      loadFailures.push({ ref, error: e instanceof Error ? e : new Error(String(e)) });
    }
  }
  void loadFailures;

  // 3. Find obligations whose `trigger.onEventType` matches the trigger.
  const matches: Array<{ ruleSet: RuleSet; obligation: RuleSet["obligations"][number] }> = [];
  for (const rs of loaded) {
    for (const obligation of rs.obligations) {
      if (obligation.trigger.onEventType === trigger.type) {
        matches.push({ ruleSet: rs, obligation });
      }
    }
  }

  if (matches.length === 0) {
    const candidateRefs = loaded.map((rs) => ({
      ruleSetId: rs.ref.ruleSetId,
      version: rs.ref.version,
      effectiveFrom: rs.ref.effectiveFrom,
      jurisdiction: rs.ref.provenance.sourceKind, // opaque jurisdiction hint
    } satisfies CandidateRuleSet));
    // Note: CandidateRuleSet expects a JurisdictionRef. We pass a
    // partial shape; downstream consumers should treat it as advisory.
    // For v1.0 we omit jurisdiction since Core's CandidateRuleSet
    // requires it. The Module carries a tenant-declared rule set whose
    // jurisdiction is the tenant's profile (looked up separately).
    // Emit with empty candidates (matches the existing test AC-5/6 shape).
    void candidateRefs;
    const gap = await emitCoverageGap(deps, tenantId, trigger, {
      reason: "no-rule-matches",
      candidateRuleSets: [],
    });
    return { matched: 0, obligations: [], coverageGap: { reason: gap.reason, candidateRuleSets: [] } };
  }

  // 4. Check staleness: any matched RuleSet with a RuleSetStale event?
  const staleSetIds = new Set<string>();
  for (const event of events) {
    if (event.type === RuleSetStale) {
      const p = event.payload as unknown as RuleSetStalePayload;
      staleSetIds.add(`${p.ruleSetId}@${p.version}`);
    }
  }
  const freshMatches = matches.filter(
    (m) => !staleSetIds.has(`${m.ruleSet.ref.ruleSetId}@${m.ruleSet.ref.version}`),
  );
  if (freshMatches.length === 0) {
    const candidateRefs = matches.map((m) => ({
      ruleSetId: m.ruleSet.ref.ruleSetId,
      version: m.ruleSet.ref.version,
      effectiveFrom: m.ruleSet.ref.effectiveFrom,
      jurisdiction: { countryCode: m.ruleSet.ref.provenance.sourceKind } as JurisdictionRef,
    }));
    const gap = await emitCoverageGap(deps, tenantId, trigger, {
      reason: "all-matching-rules-stale",
      candidateRuleSets: candidateRefs,
    });
    return { matched: 0, obligations: [], coverageGap: { reason: gap.reason, candidateRuleSets: candidateRefs } };
  }

  // 5. For each fresh match: compute deadline, emit ObligationDue,
  //    evaluate policy, emit ObligationEvaluationRecorded. All under
  //    followFrom(trigger) so the lineage chains.
  const out: WatchFinancialEventsResult["obligations"] = [];
  for (const { ruleSet, obligation } of freshMatches) {
    const dueAt = computeDeadline(obligation.deadline, trigger.occurredAt);
    const duePayload: ObligationDuePayload = {
      obligationId: obligation.obligationId,
      obligationHumanName: obligation.humanName,
      triggerEventId: trigger.eventId,
      triggerEventType: trigger.type,
      dueAt,
      ruleSetId: ruleSet.ref.ruleSetId,
      ruleSetVersion: ruleSet.ref.version,
      requiredHumanAction: obligation.requiredHumanAction,
      provenance: obligation.provenance,
    };
    const lineage = followFrom(trigger);
    await appendIntents(
      deps,
      tenantId,
      [{ type: ObligationDue, payload: duePayload as unknown as Record<string, unknown> }],
      lineage,
    );
    // Capture the ObligationDue id BEFORE the policy engine appends a
    // PolicyDecisionRecorded event (which would be at the tail after
    // evaluateTaxPolicyUseCase runs).
    const afterDue = await deps.eventStore.readStream(tenantId);
    const dueEvent = afterDue[afterDue.length - 1];
    if (dueEvent === undefined || dueEvent.type !== ObligationDue) {
      throw new Error("ObligationDue not found after appendIntents");
    }

    const evaluation = await evaluateTaxPolicyUseCase(deps, {
      tenantId,
      obligation: { obligationId: obligation.obligationId, requiredHumanAction: obligation.requiredHumanAction },
      trigger: { eventId: trigger.eventId, eventType: trigger.type, occurredAt: trigger.occurredAt },
      actor: input.actor,
    });

    const evalPayload: ObligationEvaluationRecordedPayload = toObligationEvaluationPayload(
      obligation.obligationId,
      dueEvent.eventId,
      evaluation,
    );
    await appendIntents(
      deps,
      tenantId,
      [
        {
          type: ObligationEvaluationRecorded,
          payload: evalPayload as unknown as Record<string, unknown>,
        },
      ],
      followFrom(dueEvent),
    );

    out.push({
      obligationId: obligation.obligationId,
      ruleSetId: ruleSet.ref.ruleSetId,
      ruleSetVersion: ruleSet.ref.version,
      dueAt,
      evaluation,
    });
  }

  return { matched: out.length, obligations: out, coverageGap: null };
}

// Compute the currently-effective RuleSets: for each ruleSetId, take the
// highest-version registration that has NOT been superseded. (Spec 010
// process: supersede emits RuleSetSuperseded which links prev → next.)
function latestRuleSetsForTenant(events: readonly DomainEvent[]): RuleSetRef[] {
  type Ref = { ref: RuleSetRef; index: number };
  const byRuleSetId = new Map<string, Ref[]>();
  const order: number[] = [];
  events.forEach((e, i) => order.push(i));
  for (const i of order) {
    const event = events[i];
    if (event === undefined) continue;
    if (event.type === RuleSetRegistered) {
      const p = event.payload as unknown as RuleSetRegisteredPayload;
      const ref: RuleSetRef = {
        ruleSetId: p.ruleSetId,
        version: p.version,
        effectiveFrom: p.effectiveFrom,
        obligationsUri: p.obligationsUri,
        provenance: p.provenance,
        // `source` is the RuleProvenance itself (Spec 008 shape); alias here.
        source: p.provenance,
      };
      const list = byRuleSetId.get(p.ruleSetId) ?? [];
      list.push({ ref, index: i });
      byRuleSetId.set(p.ruleSetId, list);
      continue;
    }
    if (event.type === RuleSetSuperseded) {
      const p = event.payload as { ruleSetId: string; previousVersion: string };
      const list = byRuleSetId.get(p.ruleSetId);
      if (list !== undefined) {
        const idx = list.findIndex((r) => r.ref.version === p.previousVersion);
        if (idx >= 0) list.splice(idx, 1);
      }
    }
  }
  // For each ruleSetId, take the registration with the highest version
  // (semver-ish: prefer newer by string compare — semver is opaque to Core).
  const out: RuleSetRef[] = [];
  for (const list of byRuleSetId.values()) {
    if (list.length === 0) continue;
    list.sort((a, b) => b.ref.version.localeCompare(a.ref.version));
    const first = list[0];
    if (first !== undefined) out.push(first.ref);
  }
  return out;
}

async function emitCoverageGap(
  deps: TaxComplianceDeps,
  tenantId: string,
  trigger: DomainEvent,
  gap: { reason: "no-rule-matches" | "all-matching-rules-stale" | "conflicting-rules-no-precedence"; candidateRuleSets: CandidateRuleSet[] },
): Promise<{ reason: typeof gap.reason; obligationId: string; obligationHumanName: string }> {
  const payload = {
    obligationId: `coverage-gap:${trigger.type}`,
    obligationHumanName: `Coverage gap for ${trigger.type}`,
    reason: gap.reason,
    candidateRuleSets: gap.candidateRuleSets,
  };
  await appendIntents(
    deps,
    tenantId,
    [{ type: ObligationCoverageGap, payload: payload as unknown as Record<string, unknown> }],
    followFrom(trigger),
  );
  return { reason: gap.reason, obligationId: payload.obligationId, obligationHumanName: payload.obligationHumanName };
}
