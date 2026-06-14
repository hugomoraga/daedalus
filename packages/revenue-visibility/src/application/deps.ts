// Revenue Visibility — dependency kernel.
// Extends CoreDeps with the module's port (AlertThresholdsPort).
// Note: v0's ingest use case only needed CoreDeps. v1 needs thresholds for alerts,
// so the deps type now requires the thresholds port. Adapters must wire it.

import type { CoreDeps } from "@daedalus/core";
import type { AlertThresholdsPort } from "./ports/alert-thresholds.ts";

export type RevenueDeps = CoreDeps & {
  thresholds: AlertThresholdsPort;
};