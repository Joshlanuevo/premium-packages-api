import { getFirestore } from "../config/firebase";
import { Collections } from "../constants/collections";

export interface BankDetailRecord {
  isActive?: boolean;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  [key: string]: unknown;
}

/**
 * Ported from agencyStore.js's fetchBankDetails(). A real surprise worth
 * flagging: bank details are NOT stored in an "agencies" collection at
 * all — they live as a `bank` array field on a USER document, looked up
 * by matching that user's agency_id field. Preserved exactly, not
 * "corrected" into a more expected-looking agencies-collection lookup.
 */
export async function fetchBankDetailsForAgency(agencyId: string | null | undefined): Promise<BankDetailRecord[]> {
  if (!agencyId) return [];

  const db = getFirestore();
  const snap = await db.collection(Collections.users).where("agency_id", "==", agencyId).limit(1).get();

  if (snap.empty) return [];

  const userData = snap.docs[0].data();
  return Array.isArray(userData.bank) ? userData.bank : [];
}

/**
 * Ported from agencyStore.js's getAgencyFromDb() — direct doc-ID lookup in
 * the "agencies" collection (distinct from the users-collection bank
 * lookup above).
 */
export async function fetchAgencyDetails(agencyId: string | null | undefined): Promise<Record<string, any> | null> {
  if (!agencyId) return null;

  const db = getFirestore();
  const snap = await db.collection(Collections.agencies).doc(agencyId).get();

  return snap.exists ? snap.data()! : null;
}