import { getFirestore } from "../config/firebase";
import { Collections } from "../constants/collections";

export interface SubmissionSummary {
  transactionId: string;
  totalPax: number;
  status: string;
}

export interface PackageAvailabilityEntry {
  id: string;
  variationId: string;
  groupName: string;
  startDate: string;
  endDate: string;
  bookedCount: number;
  availability: number;
  originalAvailability: number;
  availabilityLogs: unknown[];
}

export interface SubmissionsByVariationResult {
  totalBooked: number;
  submissions: SubmissionSummary[];
  packageAvailability: PackageAvailabilityEntry[];
}

const INACTIVE_STATUSES = ["cancelled", "disapproved", "rejected"];

/**
 * Ported from the utilities API's getSubmissionsByVariation, with one fix:
 * legacy only ever checked the first variation_id in a group
 * (item.variation_ids[0]), silently dropping submissions booked against any
 * other variation_id in a multi-variation group. This queries all of them.
 */
export async function getSubmissionsByVariations(
  packageId: string,
  variationIds: string[]
): Promise<SubmissionsByVariationResult> {
  const db = getFirestore();
  const ids = variationIds.slice(0, 30); // Firestore 'in' operator cap

  const [submissionsSnap, availabilitySnap] = await Promise.all([
    ids.length > 0
      ? db.collection(Collections.holidayPackageSubmissions).where("meta.request.variation_id", "in", ids).get()
      : Promise.resolve({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] }),
    db.collection(Collections.packageAvailability).where("package_id", "==", packageId).limit(1).get(),
  ]);

  let totalBooked = 0;
  const submissions: SubmissionSummary[] = [];

  for (const doc of submissionsSnap.docs) {
    const data = doc.data() as Record<string, any>;
    const status = String(data.status ?? "").toLowerCase();
    if (INACTIVE_STATUSES.includes(status)) continue;

    const pax = data?.meta?.request?.pax ?? 0;
    totalBooked += pax;
    submissions.push({
      transactionId: data.transaction_id,
      totalPax: pax,
      status: data.status,
    });
  }

  const availabilityDoc = availabilitySnap.docs[0]?.data();
  const blockings: any[] = Array.isArray(availabilityDoc?.blockings) ? availabilityDoc!.blockings : [];

  const packageAvailability: PackageAvailabilityEntry[] = blockings
    .filter((b) => ids.includes(b.variation_id))
    .map((b) => {
      const current = Number(b.availability ?? 0);
      const booked = Number(b.booked_count ?? 0);
      return {
        id: b.id,
        variationId: b.variation_id,
        groupName: b.group_name,
        startDate: b.start_date,
        endDate: b.end_date,
        bookedCount: b.booked_count ?? 0,
        availability: b.availability ?? 0,
        originalAvailability: b.original_availability ?? current + booked,
        availabilityLogs: b.availability_logs ?? [],
      };
    });

  return { totalBooked, submissions, packageAvailability };
}