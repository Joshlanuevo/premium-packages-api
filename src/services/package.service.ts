import { getFirestore } from "../config/firebase";
import { randomUUID } from "node:crypto";
import { reconcileBlockings } from "./availability.reconciler";
import { computeAvailabilityAggregate } from "./availability.reserve";
import type { Blocking, PackageAvailability } from "../types/availability";
import { Collections } from "../constants/collections";

export interface PackagePayload {
  id?: string;
  title: string;
  currency?: string;
  variations?: unknown[];
  installment_terms?: Record<string, unknown>;
  reservation_terms?: Record<string, unknown>;
  availability?: { blockings?: Blocking[] };
  type?: string;
  [key: string]: unknown;
}

export async function writePackage(payload: PackagePayload, userId: string) {
  const db = getFirestore();
  const id = payload.id ?? randomUUID();
  const now = new Date().toISOString();

  const ref = db.collection(Collections.holidayPackages).doc(id);
  const existing = await ref.get();

  const { availability, ...packageFields } = payload;

  const data = {
    ...packageFields,
    id,
    currency: payload.currency ?? "PHP",
    ...(existing.exists
      ? { date_updated: now, updated_by: userId }
      : { date_created: now, user_id: userId }),
  };

  await ref.set(data, { merge: true });

  let availabilityResult: PackageAvailability | null = null;
  if (availability?.blockings) {
    availabilityResult = await writePackageAvailability(id, availability.blockings, userId, now);
  }

  return { ...data, availability: availabilityResult };
}

export async function getPackage(id: string) {
  const db = getFirestore();
  const snap = await db.collection(Collections.holidayPackages).doc(id).get();
  if (!snap.exists) return null;
  return snap.data();
}

export async function getAvailability(packageId: string): Promise<PackageAvailability | null> {
  const db = getFirestore();
  const snap = await db
    .collection(Collections.packageAvailability)
    .where("package_id", "==", packageId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...(snap.docs[0].data() as Omit<PackageAvailability, "id">) };
}

export async function writePackageAvailability(
  packageId: string,
  incomingBlockings: Blocking[],
  userId: string,
  now: string = new Date().toISOString()
): Promise<PackageAvailability> {
  const db = getFirestore();
  const existing = await getAvailability(packageId);

  const reconciled = reconcileBlockings(existing?.blockings, incomingBlockings, userId, now);
  const aggregate = computeAvailabilityAggregate(reconciled);

  const id = existing?.id ?? randomUUID();
  const data: PackageAvailability = {
    id,
    package_id: packageId,
    blockings: reconciled,
    availability: aggregate.availability,
    booked_count: aggregate.booked_count,
    ...(existing
      ? { updated_by: userId, updated_at: now }
      : { created_by: userId, created_at: now }),
  };

  await db.collection(Collections.packageAvailability).doc(id).set(data, { merge: true });
  return data;
}