import type { Blocking } from "../types/availability";

function compositeKey(b: Pick<Blocking, "id" | "variation_id">): string {
  return `${b.id ?? ""}|${b.variation_id ?? ""}`;
}

export function reconcileBlockings(
  existingBlockings: Blocking[] | undefined,
  incomingBlockings: Blocking[],
  actor: string,
  now: string = new Date().toISOString()
): Blocking[] {
  const existingByKey = new Map<string, Blocking>();
  for (const existing of existingBlockings ?? []) {
    existingByKey.set(compositeKey(existing), existing);
  }

  return incomingBlockings.map((incoming) => {
    const existing = existingByKey.get(compositeKey(incoming));
    const blocking: Blocking = { ...incoming };

    if (existing) {
      const existingAvail = Number(existing.availability ?? 0);
      const existingBooked = Number(existing.booked_count ?? 0);
      const existingOriginal = Number(
        existing.original_availability ?? existingAvail + existingBooked
      );
      const newAvail = Number(incoming.availability ?? 0);

      if (newAvail !== existingAvail) {
        const delta = newAvail - existingAvail;
        blocking.availability = Math.max(0, existingAvail + delta);
        blocking.booked_count = existingBooked;
        blocking.original_availability = Math.max(0, existingOriginal + delta);
      } else {
        blocking.availability = existingAvail;
        blocking.booked_count = existingBooked;
        blocking.original_availability = existingOriginal;
      }

      blocking.availability_logs = existing.availability_logs ?? [];

      const isFirstLog = blocking.availability_logs.length === 0;
      const hasChanged = existingAvail !== blocking.availability;

      if (isFirstLog || hasChanged) {
        blocking.availability_logs = [
          ...blocking.availability_logs,
          {
            changed_at: now,
            changed_by: actor,
            old_value: isFirstLog ? 0 : existingAvail,
            new_value: blocking.availability,
          },
        ];
      }
    } else {
      if (blocking.original_availability === undefined) {
        const current = Number(blocking.availability ?? 0);
        const booked = Number(blocking.booked_count ?? 0);
        blocking.original_availability = current + booked;
      }
      blocking.availability_logs = [
        {
          changed_at: now,
          changed_by: actor,
          old_value: 0,
          new_value: Number(blocking.availability ?? 0),
        },
      ];
    }

    return blocking;
  });
}