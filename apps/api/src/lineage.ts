// apps/api/src/lineage.ts
//
// Per-request lineage handling (Spec 016 §8 AC-10). The API accepts
// X-Causation-Id / X-Correlation-Id from the client; when absent,
// fresh UUIDs are generated and returned in response headers so a
// follow-up request can reuse them.
//
// Phase A only — the read surface doesn't emit DomainEvents, but
// the headers are still surfaced (returned) and the requestId is
// always present in error bodies. The full lineage propagation into
// a DomainEvent's `causationId` / `correlationId` lands in Phase B
// when writes are wired through Policy Engine (Spec 016 §8 AC-10 +
// ADR-013 §Decision 2c).

import { randomUUID } from "node:crypto";

export type LineageHeaders = {
  causationId: string;
  correlationId: string;
  fresh: boolean;
};

const CAUSATION_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const CORRELATION_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function newRequestId(): string {
  return randomUUID();
}

// Read the lineage headers off a request. If both are present,
// they are kept verbatim. If either is missing or malformed, a
// fresh UUID is generated for that field, and `fresh` is set so
// the response can echo the generated IDs back via headers.
export function extractLineage(headers: {
  get(name: string): string | undefined;
}): LineageHeaders {
  const rawCausation = headers.get("x-causation-id");
  const rawCorrelation = headers.get("x-correlation-id");
  const freshCausation = rawCausation === undefined || !CAUSATION_RE.test(rawCausation);
  const freshCorrelation =
    rawCorrelation === undefined || !CORRELATION_RE.test(rawCorrelation);
  const causationId = freshCausation ? randomUUID() : (rawCausation as string);
  const correlationId = freshCorrelation ? randomUUID() : (rawCorrelation as string);
  return {
    causationId,
    correlationId,
    fresh: freshCausation || freshCorrelation,
  };
}
