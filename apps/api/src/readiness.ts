// apps/api/src/readiness.ts
//
// Readiness = "the event store is reachable AND projections can
// be computed." v0 only proves reachability (a no-op readStream
// completes); the projection surface itself lands in a later PR
// (T-03 — read paths). When projections exist the probe will
// additionally call `project(name)` on at least one projection
// to prove the read path is wired.
//
// Structural type, NOT imported from @daedalus/core, so the API
// keeps `dependencies: {}` per Spec 016 §8 AC-8 (the API is a pure
// composition root — Core / modules are *passed in*, not
// imported). The duck type matches `EventStorePort.readStream`
// from @daedalus/core exactly: (tenantId) => Promise<DomainEvent[]>.

export type ReadinessResult = {
  ready: boolean;
  reason: string;
};

export type ReadinessProbe = () => Promise<ReadinessResult>;

export type ReadableEventStore = {
  readStream(tenantId: string): Promise<readonly unknown[]>;
};

// v0 minimum: the event store is reachable. If the platform has
// no event-store adapter configured yet (e.g. during tests that
// skip the read paths), the caller is responsible for providing
// a probe that reflects its own readiness surface — this is the
// same seam a future T-03 uses to also touch projections.
export const noEventStoreAvailable = (): ReadinessResult => ({
  ready: false,
  reason: "no event-store adapter wired (Phase A T-01 ships the seam; T-03 supplies a real probe)",
});

export const eventStoreReachable =
  (eventStore: ReadableEventStore, tenantId = "tenant-0"): ReadinessProbe =>
  async () => {
    try {
      // Reachability: an empty tenant stream is the cheapest
      // operation the EventStorePort exposes. Reading it proves
      // the file handle / lock / journal is in a state where
      // reads would succeed for a non-empty tenant too.
      await eventStore.readStream(tenantId);
      return { ready: true, reason: "event-store reachable" };
    } catch (err) {
      return {
        ready: false,
        reason: `event-store unreachable: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  };
