// PolicyDecision — the engine's 3-outcome verdict (Spec 009 §3.4).
// No other variants. "Soft allow" / "warn but proceed" is NOT an engine
// outcome; a policy that wants to surface a non-blocking warning emits a
// side event while still returning one of these three.

export type PolicyDecision =
  | { kind: "allow"; reason?: string }
  | { kind: "deny"; reason: string }
  | { kind: "escalate"; gateRef: string; reason: string };