export interface AddonsSyncResult {
  amountPhp: number;
  amountUsd: number;
  remainingBalancePhp: number;
  remainingBalanceUsd: number;
  status: "with balance" | "completed" | "cancelled";
}

/**
 * Ported from syncInstallmentTransactionAddons(). Pure function — recomputes
 * an installment's totals from ALL its payments (not just addons, despite
 * the name — legacy sums every payment on the installment), and derives a
 * new status: "cancelled" is sticky (never auto-cleared here), otherwise
 * "completed" once nothing pending remains, else "with balance".
 */
export function computeAddonsSync(
  payments: { status?: string; amountPaidPhp?: number; amountPaidUsd?: number }[],
  currentInstallmentStatus: string | null | undefined
): AddonsSyncResult {
  let amountPhp = 0;
  let amountUsd = 0;
  let remainingPhp = 0;
  let remainingUsd = 0;

  for (const payment of payments) {
    const status = (payment.status ?? "pending").toLowerCase();
    const php = payment.amountPaidPhp ?? 0;
    const usd = payment.amountPaidUsd ?? 0;

    amountPhp += php;
    amountUsd += usd;

    if (status === "pending") {
      remainingPhp += php;
      remainingUsd += usd;
    }
  }

  let status: AddonsSyncResult["status"] = (currentInstallmentStatus as AddonsSyncResult["status"]) ?? "with balance";
  if (status !== "cancelled") {
    status = remainingPhp <= 0 && remainingUsd <= 0 ? "completed" : "with balance";
  }

  return { amountPhp, amountUsd, remainingBalancePhp: remainingPhp, remainingBalanceUsd: remainingUsd, status };
}

export interface GuestAddonBaggageLeg {
  price?: number | string;
  status?: string;
  [key: string]: unknown;
}

export interface GuestAddonBaggage {
  departed?: GuestAddonBaggageLeg[] | GuestAddonBaggageLeg;
  departure?: GuestAddonBaggageLeg[] | GuestAddonBaggageLeg;
  status?: string;
  [key: string]: unknown;
}

export interface GuestWithAddons {
  visa_avail?: boolean | string;
  insurance_avail?: boolean | string;
  tour_avail?: boolean | string;
  baggages?: GuestAddonBaggage[];
  [key: string]: unknown;
}

function isLegArray(value: unknown): value is GuestAddonBaggageLeg[] {
  return Array.isArray(value);
}

function markLeg(leg: GuestAddonBaggageLeg): { leg: GuestAddonBaggageLeg; hasNonZeroPrice: boolean } {
  const price = Number(leg.price ?? 0);
  if (price !== 0) {
    return { leg: { ...leg, status: "paid" }, hasNonZeroPrice: true };
  }
  return { leg, hasNonZeroPrice: false };
}

/**
 * Ported from markGuestAddonsPaid(). Pure function — marks a guest's
 * visa/insurance/tour availment flags and any priced baggage legs as "paid",
 * called after an addons payment is accepted. Handles both array-of-legs and
 * single-leg-object shapes for baggage departure/departed, same as legacy.
 */
export function markGuestAddonsPaid(guests: GuestWithAddons[]): GuestWithAddons[] {
  return guests.map((guest) => {
    if (!guest || typeof guest !== "object") return guest;

    const updated: GuestWithAddons = { ...guest };

    for (const flag of ["visa_avail", "insurance_avail", "tour_avail"] as const) {
      if (flag in updated && updated[flag] === true) {
        updated[flag] = "paid";
      }
    }

    if (Array.isArray(updated.baggages)) {
      updated.baggages = updated.baggages.map((baggage) => {
        if (!baggage || typeof baggage !== "object") return baggage;

        let hasNonZeroPrice = false;
        const updatedBaggage: GuestAddonBaggage = { ...baggage };

        for (const legKey of ["departed", "departure"] as const) {
          const legsValue = baggage[legKey];
          if (!legsValue) continue;

          if (isLegArray(legsValue)) {
            const markedLegs = legsValue.map((leg) => {
              const { leg: markedLeg, hasNonZeroPrice: legHadPrice } = markLeg(leg);
              if (legHadPrice) hasNonZeroPrice = true;
              return markedLeg;
            });
            updatedBaggage[legKey] = markedLegs;
          } else if (typeof legsValue === "object") {
            const { leg: markedLeg, hasNonZeroPrice: legHadPrice } = markLeg(legsValue as GuestAddonBaggageLeg);
            if (legHadPrice) hasNonZeroPrice = true;
            updatedBaggage[legKey] = markedLeg;
          }
        }

        if (hasNonZeroPrice) {
          updatedBaggage.status = "paid";
        }

        return updatedBaggage;
      });
    }

    return updated;
  });
}