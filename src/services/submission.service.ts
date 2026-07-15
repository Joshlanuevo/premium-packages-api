import { getFirestore } from "../config/firebase";
import { Collections } from "../constants/collections";
import { markGuestAddonsPaid } from "./addons.calc";

export async function getSubmission(submissionId: string): Promise<Record<string, any> | null> {
  const db = getFirestore();
  const snap = await db.collection(Collections.holidayPackageSubmissions).doc(submissionId).get();
  if (!snap.exists) return null;
  return snap.data() as Record<string, any>;
}

/**
 * NOTE: setSubmissionPaymentStatus()'s exact legacy source was not available
 * — every call site in update_payment() only ever passes a submissionId and
 * a status string, so this assumes the minimal plausible implementation
 * (update just payment_status + updated_at). Flagged as INFERRED rather than
 * directly ported; revisit if real behavior diverges from legacy.
 */
export async function setSubmissionPaymentStatus(submissionId: string, status: string): Promise<void> {
  const db = getFirestore();
  await db.collection(Collections.holidayPackageSubmissions).doc(submissionId).update({
    payment_status: status,
    updated_at: new Date().toISOString(),
  });
}

export async function setSubmissionVerifiedAfterAccept(submissionId: string, status: string): Promise<void> {
  const db = getFirestore();
  await db.collection(Collections.holidayPackageSubmissions).doc(submissionId).update({
    "meta.request.hasDownPayment": true,
    payment_status: status,
    updated_at: new Date().toISOString(),
  });
}

/**
 * Ported from the markGuestAddonsPaid() call site in update_payment() —
 * reads meta.request.room_guests[0].guests, marks addon flags as "paid",
 * writes back. No-ops safely if the shape isn't present, matching legacy's
 * defensive `if (isset(...))` checks.
 */
export async function markGuestAddonsPaidInSubmission(submissionId: string): Promise<void> {
  const db = getFirestore();
  const ref = db.collection(Collections.holidayPackageSubmissions).doc(submissionId);
  const snap = await ref.get();
  if (!snap.exists) return;

  const data = snap.data() as Record<string, any>;
  const roomGuests = data?.meta?.request?.room_guests;
  if (!Array.isArray(roomGuests) || !roomGuests[0] || !Array.isArray(roomGuests[0].guests)) {
    return;
  }

  const updatedGuests = markGuestAddonsPaid(roomGuests[0].guests);
  const updatedRoomGuests = [{ ...roomGuests[0], guests: updatedGuests }, ...roomGuests.slice(1)];

  await ref.update({
    "meta.request.room_guests": updatedRoomGuests,
    updated_at: new Date().toISOString(),
  });
}