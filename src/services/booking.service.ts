import { randomUUID } from "node:crypto";
import { getFirestore } from "../config/firebase";
import { Collections } from "../constants/collections";
import { reserveSlots, releaseSlots, computeAvailabilityAggregate } from "./availability.reserve";
import { buildInstallmentSchedule } from "./installment.schedule";
import type { PackageAvailability } from "../types/availability";
import type { BookingPayload } from "../types/booking";

function generateConfirmationNumber(now: Date = new Date()): string {
  const year = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const random = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `GDX${year}${mm}${dd}${hh}${mi}${ss}${random}`;
}

export interface CreateBookingResult {
  confirmation_number: string;
  submission_id: string;
}

export async function createBooking(payload: BookingPayload, userId: string): Promise<CreateBookingResult> {
  const db = getFirestore();
  const now = new Date();
  const nowIso = now.toISOString();
  const confirmationNumber = generateConfirmationNumber(now);

  let reservedTouchedIds: string[] = [];
  let reservedPax = 0;

  try {
    await db.runTransaction(async (tx) => {
      const availabilityQuery = await tx.get(
        db.collection(Collections.packageAvailability).where("package_id", "==", payload.package_id).limit(1)
      );

      if (availabilityQuery.empty) {
        throw Object.assign(new Error("No availability data for this package."), { status: 404 });
      }

      const availabilityDoc = availabilityQuery.docs[0];
      const availabilityData = availabilityDoc.data() as PackageAvailability;

      const { updatedBlockings, remainingPax, touchedBlockingIds } = reserveSlots(
        availabilityData.blockings ?? [],
        payload.variation_ids,
        payload.pax
      );

      if (remainingPax > 0) {
        throw Object.assign(
          new Error(`Not enough slots available. Required: ${payload.pax}, short by: ${remainingPax}.`),
          { status: 409 }
        );
      }

      const aggregate = computeAvailabilityAggregate(updatedBlockings);

      tx.update(availabilityDoc.ref, {
        blockings: updatedBlockings,
        availability: aggregate.availability,
        booked_count: aggregate.booked_count,
        updated_at: nowIso,
        updated_by: userId,
      });

      reservedTouchedIds = touchedBlockingIds;
      reservedPax = payload.pax;
    });

    const submissionRef = db.collection(Collections.holidayPackageSubmissions).doc(confirmationNumber);

    await submissionRef.set({
      id: confirmationNumber,
      transaction_id: confirmationNumber,
      confirmation_number: confirmationNumber,
      package_id: payload.package_id,
      variation_id: payload.variation_id,
      userId,
      agent_id: userId,
      total_pax: payload.pax,
      status: "reserved",
      payment_status: "not verified",
      meta: { request: payload },
      created_by: userId,
      date_created: nowIso,
      updated_by: userId,
      date_updated: nowIso,
    });

    const { transaction, payments } = buildInstallmentSchedule({
      transactionId: confirmationNumber,
      totalPhp: payload.totalPhp,
      totalUsd: payload.totalUsd,
      isFullpayment: payload.isFullpayment,
      installmentDetails: payload.installment_details,
      reservationTermsDueDate: payload.reservation_terms?.due_date,
      userId,
      idGenerator: () => randomUUID(),
      now: nowIso,
    });

    const batch = db.batch();
    batch.set(db.collection(Collections.installmentTransactions).doc(transaction.id), transaction);
    for (const payment of payments) {
      batch.set(db.collection(Collections.installmentPayments).doc(payment.id), payment);
    }
    await batch.commit();

    return { confirmation_number: confirmationNumber, submission_id: confirmationNumber };
  } catch (err) {
    if (reservedTouchedIds.length > 0) {
      await rollbackReservation(payload.package_id, reservedTouchedIds, reservedPax, userId);
    }
    throw err;
  }
}

async function rollbackReservation(
  packageId: string,
  touchedBlockingIds: string[],
  pax: number,
  userId: string
): Promise<void> {
  const db = getFirestore();
  try {
    await db.runTransaction(async (tx) => {
      const availabilityQuery = await tx.get(
        db.collection(Collections.packageAvailability).where("package_id", "==", packageId).limit(1)
      );
      if (availabilityQuery.empty) return;

      const availabilityDoc = availabilityQuery.docs[0];
      const availabilityData = availabilityDoc.data() as PackageAvailability;
      const restored = releaseSlots(availabilityData.blockings ?? [], touchedBlockingIds, pax);
      const aggregate = computeAvailabilityAggregate(restored);

      tx.update(availabilityDoc.ref, {
        blockings: restored,
        availability: aggregate.availability,
        booked_count: aggregate.booked_count,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      });
    });
  } catch (rollbackErr) {
    console.error("CRITICAL: booking rollback failed, slots may be stuck reserved:", rollbackErr);
  }
}