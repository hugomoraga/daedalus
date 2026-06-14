// Revenue Visibility — domain types.
// The revenue lifecycle is expected -> confirmed -> received (Spec 001).
// v1 implements all three states (v0 only had "expected").

export type RevenueState = "expected" | "confirmed" | "received";
