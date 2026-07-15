import { randomUUID } from "node:crypto";
import { getFirestore } from "../config/firebase";
import { Collections } from "../constants/collections";
import { filterExcludedFields, computeMergedRequest } from "./transaction.calc";
import { syncInstallmentAddons } from "./installment.service";
import { PaymentTermError } from "./paymentTerms.calc";

export interface UpdateTransactionPayload {
  transaction_id: string;
  addOns_payment?: { totalPhp?: number; totalUsd?: number };
  guests?: Record<string, unknown>[];
  [key: string]: unknown;
}

export async function updateTransaction(payload: UpdateTransactionPayload, userId: string) {
  const { transaction_id: transactionId, addOns_payment: addonsPayment, ...rest } = payload;

  if (!transactionId) {
    throw new PaymentTermError(400, "Missing transaction_id in request");
  }

  const db = getFirestore();
  let paidAddons = false;

  const installmentSnap = await db
    .collection(Collections.installmentTransactions)
    .where("transactionId", "==", transactionId)
    .limit(1)
    .get();

  const installmentId = installmentSnap.empty ? null : (installmentSnap.docs[0].data().id as string);

  if (installmentId) {
    const hasNewAddonsAmount =
      addonsPayment && ((addonsPayment.totalPhp ?? 0) > 0 || (addonsPayment.totalUsd ?? 0) > 0);

    if (hasNewAddonsAmount) {
      const existingAddonsSnap = await db
        .collection(Collections.installmentPayments)
        .where("installmentId", "==", installmentId)
        .where("type", "==", "addons")
        .get();

      const existingAddons = existingAddonsSnap.docs.map((d) => ({ ref: d.ref, data: d.data() }));
      const pending = existingAddons.find((p) => (p.data.status ?? "pending") === "pending");

      if (pending) {
        await pending.ref.update({
          amountPaidPhp: addonsPayment!.totalPhp ?? 0,
          amountPaidUsd: addonsPayment!.totalUsd ?? 0,
        });
      } else {
        let lastDueDate = new Date();
        for (const { data } of existingAddons) {
          if (data.due_date) {
            const d = new Date(data.due_date);
            if (!isNaN(d.getTime()) && d > lastDueDate) lastDueDate = d;
          }
        }

        const now = new Date().toISOString();
        const newAddonsId = "payment_" + randomUUID();
        await db
          .collection(Collections.installmentPayments)
          .doc(newAddonsId)
          .set({
            id: newAddonsId,
            installmentId,
            amountPaidPhp: addonsPayment!.totalPhp ?? 0,
            amountPaidUsd: addonsPayment!.totalUsd ?? 0,
            paymentMethod: "bank",
            attachment: [],
            status: "pending",
            type: "addons",
            due_date: lastDueDate.toISOString().slice(0, 10),
            created_at: now,
            created_by: userId,
            updated_at: now,
            updated_by: userId,
          });
      }
    }

    const acceptedAddonsSnap = await db
      .collection(Collections.installmentPayments)
      .where("installmentId", "==", installmentId)
      .where("type", "==", "addons")
      .where("status", "==", "accepted")
      .limit(1)
      .get();

    paidAddons = !acceptedAddonsSnap.empty;

    await syncInstallmentAddons(installmentId, userId);
  }

  const submissionRef = db.collection(Collections.holidayPackageSubmissions).doc(transactionId);
  const submissionSnap = await submissionRef.get();

  if (!submissionSnap.exists) {
    throw new PaymentTermError(404, "Transaction not found");
  }

  const record = submissionSnap.data() as Record<string, any>;
  if (!record.meta) record.meta = {};
  if (!record.meta.request) record.meta.request = {};

  const filteredFields = filterExcludedFields(rest);
  record.meta.request = computeMergedRequest(record.meta.request, filteredFields);
  record.updated_at = new Date().toISOString();

  await submissionRef.set(record);

  const message = paidAddons
    ? "Update successful. However, add-ons cannot be edited as they have already been paid."
    : "Update successful.";

  return { message, data: record };
}