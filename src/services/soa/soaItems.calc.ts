export interface BaggageLeg {
  weight?: string | number;
  price?: number;
}

export interface BaggageInput {
  currency?: string;
  type?: string;
  departure?: BaggageLeg[];
  departed?: BaggageLeg[];
}

export interface GroupedBaggageItem {
  type: string;
  weight: string | number;
  currency: string;
  pax: number;
  unit_price: number;
  total_price: number;
}

export function computeBaggageItems(
  baggages: BaggageInput[] | undefined,
  currency: string,
  initial: boolean
): GroupedBaggageItem[] {
  if (initial) return [];

  const grouped: Record<string, GroupedBaggageItem> = {};

  for (const baggage of baggages ?? []) {
    if (baggage.currency !== currency) continue;

    const processLegs = (items: BaggageLeg[] | undefined, legType: "DEPARTURE" | "RETURN") => {
      for (const item of items ?? []) {
        if (!item.weight || (item.price ?? 0) <= 0) continue;

        const key = `${item.weight}-${legType}`;
        if (!grouped[key]) {
          grouped[key] = {
            type: `${baggage.type} - ${legType}`,
            weight: item.weight,
            currency: baggage.currency!,
            pax: 0,
            unit_price: Number(item.price),
            total_price: 0,
          };
        }
        grouped[key].pax++;
        grouped[key].total_price += Number(item.price);
      }
    };

    processLegs(baggage.departure, "DEPARTURE");
    processLegs(baggage.departed, "RETURN");
  }

  return Object.values(grouped);
}

export interface VisaInput {
  currency?: string;
  type?: string;
  price?: number;
  visa_avail?: boolean;
  [key: string]: unknown;
}

export function computeVisaItems(
  visas: VisaInput[] | undefined,
  currency: string,
  initial: boolean
): (VisaInput & { pax: number })[] {
  if (initial) return [];

  const filtered = (visas ?? []).filter(
    (v) => v.currency === currency && v.type && (v.price ?? 0) > 0 && (v.visa_avail === undefined || v.visa_avail)
  );

  const groups: Record<string, VisaInput & { pax: number }> = {};
  for (const visa of filtered) {
    const key = visa.type!;
    if (!groups[key]) {
      groups[key] = { ...visa, pax: 1 };
    } else {
      groups[key].pax += 1;
    }
  }

  return Object.values(groups);
}

export interface TourInput {
  currency?: string;
  type?: string;
  price?: number;
  tour_avail?: boolean;
  traveler_type?: string;
}

export interface GroupedTourItem {
  type: string;
  price: number;
  total_price: number;
  currency: string;
  pax: number;
}

export function computeTourItems(tours: TourInput[] | undefined, currency: string): GroupedTourItem[] {
  const filtered = (tours ?? []).filter(
    (t) => t.currency === currency && t.type && (t.price ?? 0) > 0 && (t.tour_avail === undefined || t.tour_avail)
  );

  const groups: Record<string, GroupedTourItem> = {};
  for (const tour of filtered) {
    const travelerType = tour.traveler_type || "Unknown";
    const key = `${tour.type}-${travelerType}`;
    const displayType = `${tour.type}(${travelerType})`;

    if (!groups[key]) {
      groups[key] = {
        type: displayType,
        price: Number(tour.price),
        total_price: Number(tour.price),
        currency: tour.currency!,
        pax: 1,
      };
    } else {
      groups[key].total_price += Number(tour.price);
      groups[key].pax += 1;
    }
  }

  return Object.values(groups);
}

export interface InsuranceInput {
  currency?: string;
  provider?: string;
  price?: number;
  [key: string]: unknown;
}

export function computeInsuranceItems(
  insurance: InsuranceInput[] | undefined,
  currency: string,
  initial: boolean
): (InsuranceInput & { pax: number; total_price: number })[] {
  if (initial) return [];

  const filtered = (insurance ?? []).filter((i) => i.currency === currency && i.provider && (i.price ?? 0) > 0);

  const groups: Record<string, InsuranceInput & { pax: number; total_price: number }> = {};
  for (const item of filtered) {
    const key = item.provider!;
    if (!groups[key]) {
      groups[key] = { ...item, pax: 1, total_price: Number(item.price) };
    } else {
      groups[key].pax += 1;
      groups[key].total_price += Number(item.price);
    }
  }

  return Object.values(groups);
}

export interface SeatInput {
  currency?: string;
  type?: string;
  price?: number;
  seat_avail?: boolean;
  [key: string]: unknown;
}

export function computeSeatItems(seats: SeatInput[] | undefined, currency: string): (SeatInput & { pax: number })[] {
  const filtered = (seats ?? []).filter(
    (s) => s.currency === currency && s.type && (s.price ?? 0) > 0 && (s.seat_avail === undefined || s.seat_avail)
  );

  const groups: Record<string, SeatInput & { pax: number }> = {};
  for (const seat of filtered) {
    const key = seat.type!;
    if (!groups[key]) {
      groups[key] = { ...seat, pax: 1 };
    } else {
      groups[key].pax += 1;
    }
  }

  return Object.values(groups);
}

export type ChargeItemType = "taxes" | "tips" | "other_fees" | "commisions";

const FILTER_KEY_BY_TYPE: Record<ChargeItemType, string> = {
  taxes: "tax",
  tips: "tip",
  other_fees: "fee",
  commisions: "commision",
};

export function computeChargeItems<T extends { currency?: string; price?: number; [key: string]: unknown }>(
  items: T[] | undefined,
  itemType: ChargeItemType,
  currency: string
): T[] {
  const filterKey = FILTER_KEY_BY_TYPE[itemType];
  return (items ?? []).filter((item) => {
    const itemCurrency = item.currency || "PHP";
    return itemCurrency === currency && item[filterKey] && (item.price ?? 0) > 0;
  });
}

export interface SOAItemsPackageData {
  baggages?: BaggageInput[];
  visa?: VisaInput[];
  tours?: TourInput[];
  insurance?: InsuranceInput[];
  seats?: SeatInput[];
  taxes?: Record<string, unknown>[];
  tips?: Record<string, unknown>[];
  other_fees?: Record<string, unknown>[];
  commisions?: Record<string, unknown>[];
}

export function computeSOAItems(packageData: SOAItemsPackageData | undefined, initial: boolean) {
  const data = packageData ?? {};

  return {
    phpBaggageItems: computeBaggageItems(data.baggages, "PHP", initial),
    usdBaggageItems: computeBaggageItems(data.baggages, "USD", initial),
    groupedPhpVisaItems: computeVisaItems(data.visa, "PHP", initial),
    groupedUsdVisaItems: computeVisaItems(data.visa, "USD", initial),
    groupedPhpToursItems: computeTourItems(data.tours, "PHP"),
    groupedUsdToursItems: computeTourItems(data.tours, "USD"),
    groupedPhpInsuranceItems: computeInsuranceItems(data.insurance, "PHP", initial),
    groupedUsdInsuranceItems: computeInsuranceItems(data.insurance, "USD", initial),
    groupedPhpSeatItems: computeSeatItems(data.seats, "PHP"),
    groupedUsdSeatItems: computeSeatItems(data.seats, "USD"),
    phpTaxItems: computeChargeItems(data.taxes, "taxes", "PHP"),
    usdTaxItems: computeChargeItems(data.taxes, "taxes", "USD"),
    phpTipItems: computeChargeItems(data.tips, "tips", "PHP"),
    usdTipItems: computeChargeItems(data.tips, "tips", "USD"),
    phpOtherFeeItems: computeChargeItems(data.other_fees, "other_fees", "PHP"),
    usdOtherFeeItems: computeChargeItems(data.other_fees, "other_fees", "USD"),
    phpCommissionItems: computeChargeItems(data.commisions, "commisions", "PHP"),
    usdCommissionItems: computeChargeItems(data.commisions, "commisions", "USD"),
  };
}