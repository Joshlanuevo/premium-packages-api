const EXCLUDED_FIELDS = [
  "confirmation_no",
  "status",
  "package",
  "total_amount",
  "down_payment",
  "is_installment",
  "created_date",
  "owner",
  "agent_id",
  "request",
  "pax",
  "transaction_id",
] as const;

export function filterExcludedFields(request: Record<string, unknown>): Record<string, unknown> {
  const filtered = { ...request };
  for (const field of EXCLUDED_FIELDS) {
    delete filtered[field];
  }
  return filtered;
}

export interface GuestForUpdate {
  visa_update?: string;
  [key: string]: unknown;
}

export function computeMergedRequest(
  existingMetaRequest: Record<string, unknown>,
  incomingFields: Record<string, unknown>
): Record<string, unknown> {
  const merged = { ...existingMetaRequest };
  const fields = { ...incomingFields };

  if (Array.isArray(fields.guests)) {
    const guestsWithDefaults = (fields.guests as GuestForUpdate[]).map((guest) => ({
      visa_update: "pending",
      ...guest,
    }));

    merged.room_guests = [{ guests: guestsWithDefaults }];
    delete fields.guests;
  }

  for (const [key, value] of Object.entries(fields)) {
    merged[key] = value;
  }

  return merged;
}