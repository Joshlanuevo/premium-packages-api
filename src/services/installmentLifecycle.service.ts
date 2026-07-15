import { getFirestore } from "../config/firebase";
import { Collections } from "../constants/collections";
import { reserveSlots, computeAvailabilityAggregate } from "./availability.reserve";
import { PaymentTermError } from "./paymentTerms.calc";
import type { InstallmentTransactionRecord } from "../types/booking";
import type { PackageAvailability } from "../types/availability";

export async function cancelInstallmentStatus(installmentId: string, userId: string) {
  if (!installmentId) throw new PaymentTermError(400, "Missing 'id' in request.");

  const db = getFirestore();
  const snap = await db
    .collection(Collections.installmentTransactions)
    .where("id", "==", installmentId)
    .limit(1)
    .get();

  if (snap.empty) {
    throw new PaymentTermError(404, "Document not found");
  }

  const docRef = snap.docs[0].ref;
  const now = new Date().toISOString();

  await docRef.update({
    status: "cancelled",
    updated_at: now,
    updated_by: userId,
  });

  const updated = { ...(snap.docs[0].data() as InstallmentTransactionRecord), status: "cancelled" as const, updated_at: now };
  return updated;
}

export interface ExtendInstallationResult {
  message: string;
  rebooked_guests: number;
  installment: InstallmentTransactionRecord;
  package_booking: Record<string, unknown>;
}

export async function extendInstallation(
  installmentId: string,
  confirmationNo: string,
  dueDate: string,
  userId: string
): Promise<ExtendInstallationResult> {
  if (!installmentId || !confirmationNo || !dueDate) {
    throw new PaymentTermError(400, "Missing required fields in request.");
  }

  const db = getFirestore();
  const now = new Date().toISOString();

  const installmentSnap = await db
    .collection(Collections.installmentTransactions)
    .where("id", "==", installmentId)
    .limit(1)
    .get();

  if (installmentSnap.empty) {
    throw new PaymentTermError(404, "Installment document not found");
  }

  const installmentDoc = installmentSnap.docs[0];
  const installmentData = installmentDoc.data() as InstallmentTransactionRecord;
  const installmentWasCancelled = installmentData.status === "cancelled";

  await installmentDoc.ref.update({
    status: "with balance",
    dueDate,
    updated_at: now,
  });

  const submissionRef = db.collection(Collections.holidayPackageSubmissions).doc(confirmationNo);
  const submissionSnap = await submissionRef.get();

  if (!submissionSnap.exists) {
    throw new PaymentTermError(404, "Package booking not found");
  }

  const submissionData = submissionSnap.data() as Record<string, any>;
  const submissionWasCancelled = submissionData.status === "cancelled";
  const shouldRebookSlots = submissionWasCancelled || installmentWasCancelled;

  await submissionRef.update({
    "meta.request.reservation_terms.due_date": dueDate,
    "meta.request.installment_details.due_date": dueDate,
    updated_at: now,
  });

  let guestCount = 0;

  if (shouldRebookSlots) {
    const packageId = submissionData?.meta?.request?.package_id;
    const variationId = submissionData?.meta?.request?.variation_id;

    if (packageId && variationId) {
      const roomGuests = submissionData?.meta?.request?.room_guests ?? [];
      for (const room of roomGuests) {
        for (const guest of room?.guests ?? []) {
          const type = String(guest?.type ?? "").toLowerCase();
          if (type !== "infant") guestCount++;
        }
      }

      await db.runTransaction(async (tx) => {
        const availabilityQuery = await tx.get(
          db.collection(Collections.packageAvailability).where("package_id", "==", packageId).limit(1)
        );

        if (availabilityQuery.empty) {
          throw new PaymentTermError(404, "Package availability not found.");
        }

        const availabilityDoc = availabilityQuery.docs[0];
        const availabilityData = availabilityDoc.data() as PackageAvailability;

        const hasMatchingVariation = (availabilityData.blockings ?? []).some(
          (b) => b.variation_id === variationId
        );
        if (!hasMatchingVariation) {
          throw new PaymentTermError(404, "Matching variation_id not found in availability blockings");
        }

        const { updatedBlockings, remainingPax } = reserveSlots(
          availabilityData.blockings ?? [],
          [variationId],
          guestCount
        );

        if (remainingPax > 0) {
          const targetBlocking = (availabilityData.blockings ?? []).find((b) => b.variation_id === variationId);
          throw new PaymentTermError(
            400,
            `Not enough availability. Required: ${guestCount}, Available: ${targetBlocking?.availability ?? 0}`
          );
        }

        const aggregate = computeAvailabilityAggregate(updatedBlockings);

        tx.update(availabilityDoc.ref, {
          blockings: updatedBlockings,
          availability: aggregate.availability,
          booked_count: aggregate.booked_count,
          updated_at: now,
          updated_by: userId,
        });
      });

      if (guestCount > 0) {
        await submissionRef.update({ status: "reserved", updated_at: now });
      }
    }
  }

  const updatedSubmissionSnap = await submissionRef.get();
  const updatedInstallment = {
    ...installmentData,
    status: "with balance" as const,
    dueDate,
    updated_at: now,
  };

  let message = "Installment and submission successfully updated.";
  if (guestCount > 0) {
    message += ` Reinstated availability for ${guestCount} guest(s).`;
  }

  return {
    message,
    rebooked_guests: guestCount,
    installment: updatedInstallment,
    package_booking: updatedSubmissionSnap.data() as Record<string, unknown>,
  };
}