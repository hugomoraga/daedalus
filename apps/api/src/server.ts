// apps/api/src/server.ts
//
// Node 22 native HTTP server. No Express, no Fastify, no ORM —
// per Spec 016 §2 ("zero external runtime dependencies", AC-8).
// Composition root: builds the readiness probe + router from the
// supplied deps, wires SIGTERM graceful-shutdown (T-01 only
// implements the minimum; the full AC-11 graceful shutdown with
// configurable timeout lands in Phase C).
//
// Bind defaults to 0.0.0.0:8080 (Cloud Run convention). Override
// via the `PORT` env var. The default 0.0.0.0 is intentional: in
// Cloud Run the runtime injects the port via env on every
// container boot; binding 0.0.0.0 lets the runtime choose.
//
// The ServerDeps shape is duck-typed against the canonical
// EventStorePort in @daedalus/core. This package deliberately
// keeps `dependencies: {}` per AC-8; if a future server change
// needs more types from Core, those should be added as
// structural types here rather than via an import.

import { createServer } from "node:http";
import { createRouter, API_VERSION } from "./router.ts";
import { eventStoreReachable, noEventStoreAvailable } from "./readiness.ts";
import type { ReadinessProbe, ReadableEventStore } from "./readiness.ts";

export type ServerDeps = {
  // Optional — when missing the server still boots (a future
  // operator may run a Phase-C workload that hasn't wired the
  // Core event store yet, but production / Cloud Run always
  // supplies one).
  eventStore?: ReadableEventStore;
  // Override the readiness probe. Production wires it from the
  // event-store-reachable probe; tests pin a deterministic
  // `() => Promise<{ ready: true, reason: "..." }>` so /readyz
  // test paths are stable.
  readinessProbe?: ReadinessProbe;
};

export type StartedServer = {
  port: number;
  host: string;
  close: (timeoutMs?: number) => Promise<void>;
};

export async function startServer(
  deps: ServerDeps = {},
  env: NodeJS.ProcessEnv = process.env,
): Promise<StartedServer> {
  const host = "0.0.0.0";
  const port = Number.parseInt(env.PORT ?? "8080", 10);
  // Port 0 is reserved for tests and ephemeral binding (Node picks a free
  // port from the OS). Production always supplies an explicit port via env.
  if (!Number.isFinite(port) || port < 0 || port > 65535) {
    throw new Error(`invalid PORT: ${env.PORT ?? "<unset>"}`);
  }

  const probe: ReadinessProbe =
    deps.readinessProbe ??
    (deps.eventStore ? eventStoreReachable(deps.eventStore) : noEventStoreAvailable);

  const router = createRouter({ readinessProbe: probe });

  const server = createServer((req, res) => {
    void router(req, res);
  });

  let shuttingDown = false;
  const shutdown = async (timeoutMs = 1000): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    await new Promise<void>((resolve) => {
      // AC-11 (graceful shutdown) lands in Phase C with a
      // configurable timeout; for T-01 we just close the
      // listening socket and disconnect idle clients quickly.
      const handle = setTimeout(() => {
        server.closeAllConnections?.();
        resolve();
      }, timeoutMs);
      server.close(() => {
        clearTimeout(handle);
        resolve();
      });
    });
  };

  process.once("SIGTERM", () => {
    void shutdown();
  });

  await new Promise<void>((resolve) => {
    server.listen(port, host, () => resolve());
  });

  // server.address().port returns the *actual* bound port. When
  // `port === 0` (ephemeral binding, used by tests) Node's API
  // honors that contract — surface the resolved value to callers
  // so test code can connect without having to call .address().
  const addr = server.address();
  const boundPort =
    addr !== null && typeof addr === "object" && "port" in addr
      ? (addr as { port: number }).port
      : port;

  return {
    host,
    port: boundPort,
    close: (timeoutMs?: number) => shutdown(timeoutMs),
  };
}

export { API_VERSION };
