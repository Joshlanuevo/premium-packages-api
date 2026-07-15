export type SubmissionPaymentStatus = "cancelled" | "fullypaid" | "verified" | "not verified";

/**
 * Ported from recomputeSubmissionPaymentStatus(). Pure function — derives a
 * booking's payment_status from the current state of its payments +
 * installment, following the exact precedence from the legacy docblock:
 *   1. any payment currently 'rejected'   -> "cancelled"
 *   2. installment.status === 'completed' -> "fullypaid"
 *   3. any payment currently 'accepted'   -> "verified"
 *   4. otherwise                          -> "not verified"
 *
 * Called on every installment payment transition so reverts (e.g.
 * rejected -> pending, or rejected -> pending -> accepted) correctly move
 * the booking back out of "cancelled".
 */
export function computeSubmissionPaymentStatus(
  payments: { status?: string }[],
  installmentStatus: string | null | undefined
): SubmissionPaymentStatus {
  let hasRejected = false;
  let hasAccepted = false;

  for (const payment of payments) {
    const status = (payment.status ?? "").toLowerCase();
    if (status === "rejected") hasRejected = true;
    else if (status === "accepted") hasAccepted = true;
  }

  if (hasRejected) return "cancelled";
  if (installmentStatus === "completed") return "fullypaid";
  return hasAccepted ? "verified" : "not verified";
}