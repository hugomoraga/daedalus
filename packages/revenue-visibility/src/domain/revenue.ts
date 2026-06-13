// Revenue Visibility — domain types.
// The revenue lifecycle is expected -> confirmed -> received (Spec 001). This v0 slice
// implements only "expected" (derived from proposals). confirmed/received are deferred.

export type RevenueState = "expected";
