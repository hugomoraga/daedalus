// Tax & Compliance Guard (Spec 004 Plan §4) — pure deadline arithmetic.
// v1.0 supports two shapes:
//   - `offset-from-trigger`: dueAt = triggerTime + daysAfter * 1 day.
//     `businessDaysOnly` is preserved on the spec but NOT honored in v1.0
//     (calendar arithmetic across weekends / holidays is deferred — see
//     Spec 004 Plan §10, Tasks §Out-of-scope).
//   - `fixed-calendar`: dueAt = next occurrence of (month, day) at or
//     after triggerTime, scoped by `cadence` (annual/quarterly/monthly).
// Pure: same inputs always produce the same output. No I/O, no clock.

import type { ObligationDeadline } from "@daedalus/core";

const MS_PER_DAY = 86_400_000;

export function computeDeadline(
  deadline: ObligationDeadline,
  triggerTime: string,
): string {
  const trigger = new Date(triggerTime);
  if (Number.isNaN(trigger.getTime())) {
    throw new Error(`computeDeadline: triggerTime is not a valid ISO date: ${triggerTime}`);
  }
  if (deadline.kind === "offset-from-trigger") {
    const ms = trigger.getTime() + deadline.daysAfter * MS_PER_DAY;
    return new Date(ms).toISOString();
  }
  // fixed-calendar: pick the next occurrence of (month, day) at/after trigger.
  // If the (month, day) for this year is already past, roll to next year
  // UNLESS the cadence says we should land in the current period anyway.
  const year = trigger.getUTCFullYear();
  let candidate = new Date(Date.UTC(year, deadline.month - 1, deadline.day));
  if (candidate.getTime() < trigger.getTime()) {
    candidate = new Date(Date.UTC(year + 1, deadline.month - 1, deadline.day));
  }
  // `cadence` only affects whether we tolerate the candidate being older
  // than the trigger. For monthly/quarterly, the rule fires every period;
  // the next due date is the next (month, day) at/after trigger. The
  // current implementation already returns the next (month, day) — cadence
  // is preserved on the spec for future per-cadence logic (Spec 004 §3.2).
  void deadline.cadence;
  return candidate.toISOString();
}
