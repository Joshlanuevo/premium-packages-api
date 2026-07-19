/**
 * Single source of truth for Firestore collection names, mirroring the legacy
 * FirebaseCollections enum. Add new collections here as they're needed —
 * never inline a collection name string directly in a service file.
 */
export const Collections = {
  holidayPackages: "holiday_packages",
  packageAvailability: "package_availability",
  installmentTransactions: "installment_transactions",
  installmentPayments: "installment_payments",
  holidayPackageSubmissions: "holiday_package_submissions",
  users: "users",
  agencies: "agencies",
} as const;

export type CollectionName = (typeof Collections)[keyof typeof Collections];