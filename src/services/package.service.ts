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

export interface CategoryWithGroupings {
  category_id: string;
  name: string;
  groupings: Array<{
    grouping_id: string;
    name: string;
    image?: string | null;
    logo?: string | null;
    image_style?: string | null;
  }>;
}

export interface PackageListFilters {
  category?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  duration?: number;
  destinations?: string[];
  sortKey?: "date_created" | "title" | "cost";
  sortDir?: "asc" | "desc";
  cursor?: string;
  limit?: number;
}

export interface PackageListResult {
  items: Record<string, unknown>[];
  nextCursor: string | null;
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
    ...(packageFields.title ? { title_lower: String(packageFields.title).toLowerCase() } : {}),
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

/**
 * See note above: search (title range) and price range (cost range) can't
 * both be server-side range filters in the same Firestore query. When a
 * search term is present, price filtering happens in-memory on the fetched
 * page instead — same limitation Meilisearch just hid from us with facets.
 */
export async function listPackages(filters: PackageListFilters): Promise<PackageListResult> {
  const db = getFirestore();
  const limit = Math.min(filters.limit ?? 12, 50);

  let query = db
    .collection(Collections.holidayPackages)
    .where("isGladex", "==", true)
    .where("status", "==", 1);

  if (filters.category) {
    query = query.where("category", "==", filters.category);
  }
  if (filters.duration) {
    query = query.where("duration", "==", filters.duration);
  }
  if (filters.destinations?.length) {
    // 'in' is equality-based (up to 30 values), not a range filter — safe
    // to combine with the others.
    query = query.where("location", "in", filters.destinations.slice(0, 30));
  }

  const hasSearch = !!filters.search;
  const usePriceRangeServerSide = !hasSearch && (filters.minPrice != null || filters.maxPrice != null);

  if (hasSearch) {
    const term = filters.search!.toLowerCase();
    query = query
      .where("title_lower", ">=", term)
      .where("title_lower", "<=", term + "\uf8ff")
      .orderBy("title_lower", "asc");
  } else if (usePriceRangeServerSide) {
    if (filters.minPrice != null) query = query.where("cost", ">=", filters.minPrice);
    if (filters.maxPrice != null) query = query.where("cost", "<=", filters.maxPrice);
    query = query.orderBy("cost", filters.sortDir === "desc" ? "desc" : "asc");
  } else {
    query = query.orderBy(filters.sortKey ?? "date_created", filters.sortDir ?? "desc");
  }

  if (filters.cursor) {
    query = query.startAfter(filters.cursor);
  }

  const snap = await query.limit(limit).get();
  let items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  if (hasSearch && (filters.minPrice != null || filters.maxPrice != null)) {
    items = items.filter((item) => {
      const cost = Number((item as { cost?: number }).cost ?? 0);
      if (filters.minPrice != null && cost < filters.minPrice) return false;
      if (filters.maxPrice != null && cost > filters.maxPrice) return false;
      return true;
    });
  }

  const last = snap.docs[snap.docs.length - 1];
  const sortField = hasSearch ? "title_lower" : usePriceRangeServerSide ? "cost" : filters.sortKey ?? "date_created";
  const nextCursor = snap.docs.length === limit && last ? String(last.get(sortField)) : null;

  return { items, nextCursor };
}

export async function listCategories(): Promise<CategoryWithGroupings[]> {
  const db = getFirestore();
  const snap = await db
    .collection(Collections.categories)
    .where("type", "==", "premium_packages")
    .get();

  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      category_id: doc.id,
      name: data.name,
      groupings: (data.groupings ?? []).map((g: Record<string, unknown>) => ({
        grouping_id: g.grouping_id,
        name: g.name,
        image: g.image ?? null,
        logo: g.logo ?? null,
        image_style: g.image_style ?? null,
      })),
    };
  });
}

export async function listDestinations(): Promise<string[]> {
  const db = getFirestore();
  const snap = await db
    .collection(Collections.holidayPackages)
    .where("isGladex", "==", true)
    .where("status", "==", 1)
    .select("location")
    .limit(2000)
    .get();

  const unique = new Set<string>();
  snap.docs.forEach((doc) => {
    const location = doc.get("location");
    if (location) unique.add(location);
  });

  return Array.from(unique).sort((a, b) => a.localeCompare(b));
}