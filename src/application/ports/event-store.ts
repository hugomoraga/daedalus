// Port: the append-only, tenant-scoped event store. The domain and use cases
// depend on this interface only — they never know it is JSONL (Infrastructure as Detail).

import type { DomainEvent } from "../../domain/core/event.ts";

export interface EventStorePort {
  append(event: DomainEvent): Promise<void>;
  readStream(tenantId: string): Promise<DomainEvent[]>;
}
