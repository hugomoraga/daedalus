import type { CommandHandler } from "./types.ts";

const eventsDump: CommandHandler = async ({ tenantId, deps }) => {
  const events = await deps.eventStore.readStream(tenantId);
  if (events.length === 0) {
    console.log(`(no events for tenant ${tenantId})`);
    return;
  }
  for (const e of events) {
    console.log(`${e.occurredAt}  ${e.type}  ${JSON.stringify(e.payload)}`);
  }
};

export const handlers: Array<[string, CommandHandler]> = [
  ["events", eventsDump],
];
