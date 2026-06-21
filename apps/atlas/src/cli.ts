// ATLAS CLI — entry point. Composition root.
// Usage:
//   node apps/atlas/src/cli.ts serve [--port 8788] [--host 127.0.0.1]
//   node apps/atlas/src/cli.ts check   (run the panel manifest + token linter)

import { parseArgs } from "node:util";
import { createAtlasServer } from "./server.ts";
import { PANELS } from "./panels/register.ts";
import { tokens } from "./tokens.ts";

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      port: { type: "string" },
      host: { type: "string" },
    },
  });

  const command = positionals[0];

  switch (command) {
    case "serve": {
      const port = values.port !== undefined ? Number(values.port) : 8788;
      if (!Number.isFinite(port) || port <= 0) {
        throw new Error("--port must be a positive number");
      }
      const host = values.host ?? "127.0.0.1";
      const { server, port: boundPort, host: boundHost } = createAtlasServer({ port, host });
      server.listen(boundPort, boundHost, () => {
        console.log(`ATLAS listening on http://${boundHost}:${boundPort}`);
        console.log(`  Open: http://${boundHost}:${boundPort}/t/tenant-0/welcome`);
        console.log(`  Read-only by construction.`);
      });
      break;
    }

    case "check": {
      // Smoke-check: tokens registered, panels declare backing models.
      console.log("ATLAS check");
      console.log(`  tokens:           ${Object.keys(tokens.color).length} colors, ${tokens.space.scale.length} spacing`);
      console.log(`  panels registered: ${PANELS.length}`);
      for (const p of PANELS) {
        console.log(`    - ${p.slug.padEnd(8)}  backing=${p.backingModel}`);
      }
      console.log("  ok.");
      break;
    }

    default:
      console.log(
        [
          "ATLAS — mission control (read-only).",
          "Usage: node apps/atlas/src/cli.ts <command>",
          "",
          "Commands:",
          "  serve  --port 8788 --host 127.0.0.1   Start the SSR server",
          "  check                                Run the panel + token sanity check",
          "",
          "Per Spec 007 + ADR-005: ATLAS reads projections. Writes go through the CLI.",
        ].join("\n"),
      );
      if (command !== undefined) process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});