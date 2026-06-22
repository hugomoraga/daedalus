import type { CommandHandler } from "./types.ts";

const DEFAULT_LIMIT = 50;

const eventsDump: CommandHandler = async ({ tenantId, values, deps }) => {
  const all = await deps.eventStore.readStream(tenantId);
  if (all.length === 0) {
    console.log(`(no events for tenant ${tenantId})`);
    return;
  }

  const rawLimit = values.limit ?? String(DEFAULT_LIMIT);
  const limit = Number.parseInt(rawLimit, 10);
  if (!Number.isFinite(limit) || limit <= 0) {
    throw new Error("--limit must be a positive integer");
  }

  const tail = values.tail !== undefined;
  const shown = tail ? all.slice(-limit) : all.slice(0, limit);
  for (const e of shown) {
    console.log(`${e.occurredAt}  ${e.type}  ${JSON.stringify(e.payload)}`);
  }

  if (shown.length < all.length) {
    const skipped = all.length - shown.length;
    const from = tail ? "oldest" : "newest";
    console.log(`... ${skipped} more event(s) hidden (use --limit or drop --tail to see ${from})`);
  }
};

export const handlers: Array<[string, CommandHandler]> = [
  ["events", eventsDump],
];
