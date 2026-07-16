import type { BookingPayload } from "../types/booking";

export function hasTravellerTypeBreakdown(payload: BookingPayload): boolean {
  const hasMetadata =
    Array.isArray(payload.traveller_types_metadata) &&
    payload.traveller_types_metadata.some((room) => room && Object.keys(room).length > 0);

  const hasRoomBreakdown =
    Array.isArray(payload.rooms) &&
    payload.rooms.some(
      (room) =>
        (room.traveller_types && Object.keys(room.traveller_types).length > 0) ||
        (room.traveller_types_original && Object.keys(room.traveller_types_original).length > 0)
    );

  return hasMetadata || hasRoomBreakdown;
}