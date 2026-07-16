import type { Blocking } from "./availability";

export interface BookingPayload {
  package_id: string;
  variation_id: string;
  variation_ids: string[];
  pax: number;
  travel_date?: string;
  currency?: string;
  totalPhp: number;
  totalUsd: number;
  isFullpayment: boolean;
  installment_details?: {
    down_payment_amount?: number;
    cycle_count?: number;
    due_date: string;
    currency?: string;
  };
  reservation_terms?: {
    due_date?: string;
  };
  lead_guest?: Record<string, unknown>;
  rooms?: { traveller_types?: Record<string, unknown>; traveller_types_original?: Record<string, unknown> }[];
  traveller_types_metadata?: Record<string, unknown>[];
  [key: string]: unknown;
}

export interface InstallmentPaymentRecord {
  id: string;
  installmentId: string;
  amountPaidPhp: number;
  amountPaidUsd: number;
  paymentMethod: string;
  attachment: unknown[] | null;
  status: "pending" | "processing" | "accepted" | "rejected";
  type: "downpayment" | "normal" | "addons" | "fullpayment" | "full";
  due_date: string;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
}

export interface InstallmentTransactionRecord {
  id: string;
  transactionId: string;
  amountPhp: number;
  amountUsd: number;
  dueDate: string;
  status: "with balance" | "paid" | "cancelled";
  remainingBalancePhp: number;
  remainingBalanceUsd: number;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
}