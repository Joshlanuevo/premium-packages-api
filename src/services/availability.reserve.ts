import type { Blocking } from "../types/availability";

export interface AvailabilityAggregate {
  availability: number;
  booked_count: number;
}

export interface ReservationResult {
  updatedBlockings: Blocking[];
  remainingPax: number;
  touchedBlockingIds: string[];
}

export function computeAvailabilityAggregate(blockings: Blocking[]): AvailabilityAggregate {
  let availability = 0;
  let booked_count = 0;

  for (const b of blockings) {
    availability += b.availability ?? 0;
    booked_count += b.booked_count ?? 0;
  }

  return { availability, booked_count };
}

export function reserveSlots(
  blockings: Blocking[],
  variationIds: string[],
  paxToReserve: number
): ReservationResult {
  let remainingPax = paxToReserve;
  const touchedBlockingIds: string[] = [];

  const updatedBlockings = blockings.map((blocking) => {
    if (remainingPax <= 0) return blocking;
    if (!variationIds.includes(blocking.variation_id)) return blocking;

    const available = blocking.availability ?? 0;
    if (available <= 0) return blocking;

    const toDeduct = Math.min(remainingPax, available);
    remainingPax -= toDeduct;
    touchedBlockingIds.push(blocking.id);

    const newAvailability = available - toDeduct;
    return {
      ...blocking,
      availability: newAvailability,
      booked_count: (blocking.booked_count ?? 0) + toDeduct,
      status: newAvailability <= 0 ? 0 : blocking.status,
    };
  });

  return { updatedBlockings, remainingPax, touchedBlockingIds };
}

export function releaseSlots(
  blockings: Blocking[],
  touchedBlockingIds: string[],
  paxToRelease: number
): Blocking[] {
  let remainingPax = paxToRelease;

  return blockings.map((blocking) => {
    if (remainingPax <= 0) return blocking;
    if (!touchedBlockingIds.includes(blocking.id)) return blocking;

    const bookedCount = blocking.booked_count ?? 0;
    const toRestore = Math.min(remainingPax, bookedCount);
    remainingPax -= toRestore;

    return {
      ...blocking,
      availability: (blocking.availability ?? 0) + toRestore,
      booked_count: bookedCount - toRestore,
      status: 1,
    };
  });
}