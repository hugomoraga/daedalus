// Friction test: try to deep-import paths that should be blocked by the
// `exports` field. If the discipline holds, Node should reject these.

const attempts = [
  ["@daedalus/core/src/domain/value-chain.ts", "deep import into core domain"],
  ["@daedalus/core/src/application/lineage.ts", "deep import into core app layer"],
  ["@daedalus/proposal-generation/src/domain/proposal-draft.ts", "deep into proposal module domain"],
  ["@daedalus/proposal-generation/src/adapters/json-draft-store.ts", "deep into proposal adapter impl"],
  ["@daedalus/proposal-generation/adapters/json-draft-store", "wrong subpath for adapter impl"],
  ["@daedalus/revenue-visibility/src/application/ingest-proposal-revenue.ts", "deep into revenue module"],
  ["@daedalus/revenue-visibility/adapters", "adapters subpath that doesn't exist"],
  ["@daedalus/jsonl-event-store/src/jsonl-event-store.ts", "deep into jsonl-event-store impl"],
];

for (const [spec, desc] of attempts) {
  try {
    await import(spec);
    console.log(`LICKED: ${spec} (${desc}) — discipline FAILED`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const short = msg.split("\n")[0].slice(0, 120);
    console.log(`BLOCKED: ${spec} — ${short}`);
  }
}
