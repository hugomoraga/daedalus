// seed.ts — turn the scenario into a DomainEvent[] with full lineage.
//
// Lineage rules (match @daedalus/core/application/lineage.ts):
//   - causes === null        → startLineage: fresh correlationId, causationId = null
//   - causes === "<stable>"  → followFrom(prior): same correlationId as the prior event,
//                              causationId = prior.eventId
//
// Determinism: eventIds come from sha256(seed + counter); occurredAt is anchored
// to "today at 00:00 UTC" so re-runs in the same calendar day produce identical
// timestamps. Across midnight the seed rolls over cleanly (every test uses
// mkdtemp + an explicit anchor when it needs byte-stability).

import type { DomainEvent } from "@daedalus/core";
import { deterministicId } from "./deterministic-id.ts";
import { SCENARIO, type ScenarioEvent } from "./scenario.ts";

export const SEED = "atlas-demo-2026-06-22";

const MS_PER_DAY = 86_400_000;
const MS_PER_HOUR = 3_600_000;

export function todayUtcMidnight(now: Date = new Date()): Date {
  const d = new Date(now.getTime());
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export type SeedOptions = {
  readonly tenantId: string;
  readonly actor?: string;
  readonly now?: Date;
};

export type SeedResult = {
  readonly events: ReadonlyArray<DomainEvent>;
  readonly stableIdToEventId: ReadonlyMap<string, string>;
};

export function buildSeedEvents(opts: SeedOptions): SeedResult {
  const now = opts.now ?? new Date();
  const anchor = todayUtcMidnight(now);
  const events: DomainEvent[] = [];
  const stableToEventId = new Map<string, string>();
  const stableToCorrelation = new Map<string, string>();

  let counter = 0;
  for (const entry of SCENARIO) {
    const eventId = deterministicId(SEED, counter);
    const occurredAt = computeOccurredAt(anchor, entry, counter);

    let correlationId: string;
    let causationId: string | null;
    if (entry.causes === null) {
      // Fresh correlation — same seed family as eventId but a different counter slot.
      correlationId = deterministicId(`${SEED}#corr`, counter);
      causationId = null;
    } else {
      const priorId = stableToEventId.get(entry.causes);
      const priorCorr = stableToCorrelation.get(entry.causes);
      if (priorId === undefined || priorCorr === undefined) {
        throw new Error(
          `Scenario references unknown cause "${entry.causes}" at index ${counter}. ` +
            `Every non-null cause must point to an earlier entry.`,
        );
      }
      correlationId = priorCorr;
      causationId = priorId;
    }

    const event: DomainEvent = {
      eventId,
      type: entry.type,
      tenantId: opts.tenantId,
      occurredAt,
      actor: entry.actor,
      causationId,
      correlationId,
      payload: entry.payload,
    };
    events.push(event);

    // Register this event under its own `key` so subsequent entries can
    // reference it via `causes`. The key is per-scenario-entry, not derived
    // from payload entity ids (those collide: e.g. every Story-A event
    // carries the leadId in payload).
    stableToEventId.set(entry.key, eventId);
    stableToCorrelation.set(entry.key, correlationId);
    counter++;
  }

  return { events, stableIdToEventId: stableToEventId };
}

function computeOccurredAt(anchor: Date, entry: ScenarioEvent, counter: number): string {
  // Sub-second jitter from the counter keeps identical (daysAgo, hourOfDay)
  // entries strictly ordered, which avoids JSONL-line tie-breaking relying on
  // lexicographic eventId (deterministic but harder to reason about).
  const ts = anchor.getTime() - entry.daysAgo * MS_PER_DAY + entry.hourOfDay * MS_PER_HOUR + counter;
  return new Date(ts).toISOString();
}

// Convenience: full JSONL string for a given tenant. Used by the CLI.
export function buildSeedJsonl(opts: SeedOptions): string {
  const { events } = buildSeedEvents(opts);
  return events.map((e) => JSON.stringify(e)).join("\n") + "\n";
}
