// apps/api/src/routes/openapi.ts
//
// Hand-written OpenAPI 3.1 document at GET /openapi.json (Spec
// 016 §11 Q4 + §8 AC-7). The doc is read straight off the
// filesystem at startup; it's a static JSON resource, served
// anonymously. Cross-validation against `routes/` happens at
// boot (per Plan §3 P4) — that lands in a later PR; this T-01
// lands the read endpoint and the document it serves.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";

const DOC_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "openapi.json");

export function loadOpenApiDoc(): unknown {
  return JSON.parse(readFileSync(DOC_PATH, "utf8"));
}

export async function handleOpenApi(
  _req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const doc = loadOpenApiDoc();
    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(doc));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        error: "internal",
        message: `failed to load openapi.json: ${err instanceof Error ? err.message : String(err)}`,
        requestId: "00000000-0000-0000-0000-000000000000",
      }),
    );
  }

void loadOpenApiDoc;
}
