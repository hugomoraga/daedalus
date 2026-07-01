// apps/api/src/cli.ts
//
// Thin entry: `node apps/api/src/cli.ts serve [--port N]`.
//
// Spec 016 §1 calls out the API as a 12-factor / Cloud Run
// process: env-based config (`PORT`), stateless, anonymous
// liveness/readiness probes. We do not parse a complex argument
// tree — the only knob in v0 is the port (which the operator
// usually sets via env). The CLI is the canonical entry for
// local dev (`daedalus-api serve`) and the basis for the Docker
// container that Cloud Run deploys. Production deployments
// usually call `startServer({})` directly from a thin wrapper —
// this file exists so the binary-as-published is self-evident.

import { parseArgs } from "node:util";
import { startServer } from "./server.ts";

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      port: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
  });

  const command = process.argv[2];
  if (command !== "serve") {
    console.error("usage: daedalus-api serve [--port N]");
    console.error("  --port <N>      listen port (default: $PORT or 8080)");
    console.error("  -h, --help      show this help");
    process.exitCode = 1;
    return;
  }

  if (values.help === true) {
    console.log("daedalus-api serve [--port N]");
    console.log("Starts the Platform API on 0.0.0.0:$PORT (default 8080).");
    return;
  }

  if (typeof values.port === "string") {
    process.env.PORT = values.port;
  }

  const server = await startServer();
  console.log(`daedalus-api listening on http://${server.host}:${server.port}`);
}

main().catch((err) => {
  console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
