import { getFirestore } from "../config/firebase";

export interface UserProfile {
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  type: string;
  agencyName: string;
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const db = getFirestore();
  const snap = await db.collection("users").doc(userId).get();
  if (!snap.exists) return null;

  const data = snap.data()!;
  const firstName = data.first_name ?? "";
  const lastName = data.last_name ?? "";

  return {
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    email: data.email ?? "",
    type: data.type ?? "",
    agencyName: data.agency_name ?? "",
  };
}