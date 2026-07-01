// apps/api/src/errors.ts
//
// Canonical error envelope (Spec 016 §7 "Standard error model").
// All errors return JSON { "error": "<code>", "message": "<human readable>",
// "requestId": "<uuid>" } with canonical HTTP status codes:
//   400 Bad Request — malformed input, missing header, malformed body
//   401 Unauthorized — no API key, or invalid key
//   403 Forbidden — policy denied, or tenant mismatch
//   404 Not Found — unknown route, unknown event, unknown projection name
//   409 Conflict — idempotency key reuse with different payload
//   422 Unprocessable — body parses but fails use case validation
//   429 Too Many Requests — rate limited (per-tenant, per-instance, v0)
//   500 Internal Server Error — use case threw unexpectedly
//   503 Service Unavailable — readiness failed
//
// This is the v0 minimum; richer error semantics (e.g. AC-4's
// `policy_denied` with a body that documents *which rule* fired,
// per AC-4 + R5) land in Phase B when writes are wired.

export type ApiErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "unprocessable"
  | "rate_limited"
  | "internal"
  | "service_unavailable";

export type ApiError = {
  status: number;
  code: ApiErrorCode;
  message: string;
};

export const errors = {
  badRequest: (msg: string): ApiError => ({ status: 400, code: "bad_request", message: msg }),
  unauthorized: (msg: string): ApiError => ({ status: 401, code: "unauthorized", message: msg }),
  forbidden: (msg: string): ApiError => ({ status: 403, code: "forbidden", message: msg }),
  notFound: (msg: string): ApiError => ({ status: 404, code: "not_found", message: msg }),
  conflict: (msg: string): ApiError => ({ status: 409, code: "conflict", message: msg }),
  unprocessable: (msg: string): ApiError => ({ status: 422, code: "unprocessable", message: msg }),
  rateLimited: (msg: string): ApiError => ({ status: 429, code: "rate_limited", message: msg }),
  internal: (msg: string): ApiError => ({ status: 500, code: "internal", message: msg }),
  serviceUnavailable: (msg: string): ApiError => ({
    status: 503,
    code: "service_unavailable",
    message: msg,
  }),
};

// JSON envelope per Spec 016 §7. requestId is supplied by the
// caller; it is the same UUID the API attaches to the request
// (used by clients to correlate logs / retries). v0 does not
// surface this in response headers; that lands with Phase B's
// lineage work (Spec 016 §8 AC-10).
export type ErrorBody = {
  error: ApiErrorCode;
  message: string;
  requestId: string;
};

export function renderError(error: ApiError, requestId: string): ErrorBody {
  return { error: error.code, message: error.message, requestId };
}
