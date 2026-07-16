export interface PricingTier {
  id?: string;
  min: number;
  price: number;
}

export interface VariationTravellerType {
  id: string;
  title?: string;
  description?: string;
  base_price?: number;
  price?: number;
  currency?: string;
  is_tiered_pricing?: boolean;
  pricing_tiers?: PricingTier[];
}

export function getEffectivePrice(travellerType: VariationTravellerType, quantity: number): number {
  if (!travellerType.is_tiered_pricing || !Array.isArray(travellerType.pricing_tiers)) {
    return travellerType.base_price ?? travellerType.price ?? 0;
  }

  const sortedTiers = [...travellerType.pricing_tiers].sort((a, b) => b.min - a.min);

  for (const tier of sortedTiers) {
    if (quantity >= tier.min) {
      return tier.price;
    }
  }

  return travellerType.pricing_tiers[0]?.price ?? travellerType.base_price ?? 0;
}

export type RoomTravellerTypeValue =
  | number
  | { id?: string; quantity?: number; price?: number; currency?: string; title?: string };

export interface RoomData {
  traveller_types?: Record<string, RoomTravellerTypeValue>;
  traveller_types_original?: Record<string, number | { quantity?: number }>;
}

export interface FlatTravellerType {
  quantity?: number;
  price?: number;
  currency?: string;
}

export interface TravellerTypeMetadataEntry {
  title?: string;
  description?: string;
  effective_price?: number;
  currency?: string;
}

export interface Variation {
  id?: string;
  variation_id?: string;
  traveller_types?: VariationTravellerType[];
}

export interface TravellerTypeWithDetails {
  id: string;
  title?: string;
  description?: string;
  quantity: number;
  currency: string;
  price?: number;
  total?: number;
  usd_price?: number;
  usd_total?: number;
}

interface QuantitySourceResult {
  quantity: number;
  source: "simple" | "object" | "original" | "enhanced" | "flat" | "none";
  roomTypeData: RoomTravellerTypeValue | null;
}

function getQuantityFromAllSources(
  roomData: RoomData[],
  flatTravellerTypes: Record<string, FlatTravellerType>,
  travellerTypeId: string,
  roomIndex: number
): QuantitySourceResult {
  let quantity = 0;
  let source: QuantitySourceResult["source"] = "none";
  let roomTypeData: RoomTravellerTypeValue | null = null;

  const simpleTravellerTypes = roomData[roomIndex]?.traveller_types ?? {};
  if (simpleTravellerTypes[travellerTypeId] !== undefined) {
    const value = simpleTravellerTypes[travellerTypeId];
    if (typeof value === "number") {
      quantity = value;
      source = "simple";
    } else if (typeof value === "object" && value !== null) {
      quantity = value.quantity ?? 0;
      roomTypeData = value;
      source = "object";
    }
  }

  if (quantity === 0) {
    const originalTypes = roomData[roomIndex]?.traveller_types_original ?? {};
    if (originalTypes[travellerTypeId] !== undefined) {
      const value = originalTypes[travellerTypeId];
      quantity = typeof value === "number" ? value : value?.quantity ?? 0;
      source = "original";
    }
  }

  if (quantity === 0 && !roomTypeData) {
    const enhancedTypes = roomData[roomIndex]?.traveller_types ?? {};
    const matchingEntry = Object.entries(enhancedTypes).find(
      ([, value]) => typeof value === "object" && value !== null && (value as { id?: string }).id === travellerTypeId
    );

    if (matchingEntry) {
      roomTypeData = matchingEntry[1] as RoomTravellerTypeValue;
      quantity = (roomTypeData as { quantity?: number }).quantity ?? 0;
      source = "enhanced";
    }
  }

  if (quantity === 0) {
    const flatType = flatTravellerTypes[travellerTypeId] ?? {};
    quantity = flatType.quantity ?? 0;
    source = "flat";
  }

  return { quantity, source, roomTypeData };
}

export interface SOATravellersInput {
  travellerTypesMetadata?: Record<string, TravellerTypeMetadataEntry>[];
  bookingPayload?: {
    rooms?: RoomData[];
    traveller_types?: Record<string, FlatTravellerType>;
  };
  travellerTypes?: VariationTravellerType[];
  packageData?: { variations?: Variation[] };
  selectedVariationId?: string;
  bookingData: { totalPax: number };
  nonInfantPax?: number;
}

export function computeTravellerTypesWithDetails(props: SOATravellersInput): TravellerTypeWithDetails[] {
  const metadataArray = props.travellerTypesMetadata ?? [];
  const roomData = props.bookingPayload?.rooms ?? [];
  const flatTravellerTypes = props.bookingPayload?.traveller_types ?? {};
  const typeDefinitions = props.travellerTypes ?? [];

  const selectedVariation = props.packageData?.variations?.find(
    (v) => v.id === props.selectedVariationId || v.variation_id === props.selectedVariationId
  );
  const variationTravellerTypes = selectedVariation?.traveller_types ?? [];

  const resultMap = new Map<string, TravellerTypeWithDetails>();

  if (metadataArray.length > 0) {
    metadataArray.forEach((room, roomIndex) => {
      if (!room || typeof room !== "object") return;

      for (const [travellerTypeId, metadata] of Object.entries(room)) {
        const { quantity } = getQuantityFromAllSources(roomData, flatTravellerTypes, travellerTypeId, roomIndex);
        if (quantity <= 0) continue;

        const effectivePrice = metadata.effective_price ?? 0;
        const currency = metadata.currency ?? "PHP";
        const total = effectivePrice * quantity;

        const existing: TravellerTypeWithDetails = resultMap.get(travellerTypeId) ?? {
          id: travellerTypeId,
          title: metadata.title,
          description: metadata.description ?? "",
          quantity: 0,
          currency,
        };

        existing.quantity += quantity;

        if (currency === "PHP") {
          existing.price = effectivePrice;
          existing.total = (existing.total ?? 0) + total;
        } else if (currency === "USD") {
          existing.usd_price = effectivePrice;
          existing.usd_total = (existing.usd_total ?? 0) + total;
        }

        resultMap.set(travellerTypeId, existing);
      }
    });
  }

  if (resultMap.size === 0 && roomData.length > 0) {
    roomData.forEach((room, roomIndex) => {
      const allTravellerTypeIds = new Set<string>();

      if (room.traveller_types_original) {
        Object.keys(room.traveller_types_original).forEach((id) => allTravellerTypeIds.add(id));
      }

      if (room.traveller_types) {
        for (const [key, value] of Object.entries(room.traveller_types)) {
          if (typeof value === "number") {
            allTravellerTypeIds.add(key);
          } else if (typeof value === "object" && value !== null && (value as { id?: string }).id) {
            allTravellerTypeIds.add((value as { id: string }).id);
          }
        }
      }

      allTravellerTypeIds.forEach((travellerTypeId) => {
        const { quantity, roomTypeData } = getQuantityFromAllSources(roomData, flatTravellerTypes, travellerTypeId, roomIndex);
        if (quantity <= 0) return;

        const typeInfo =
          variationTravellerTypes.find((t) => t.id === travellerTypeId) ??
          typeDefinitions.find((t) => t.id === travellerTypeId) ??
          ({} as VariationTravellerType);

        let effectivePrice = 0;
        if (roomTypeData && typeof roomTypeData === "object" && roomTypeData.price) {
          effectivePrice = roomTypeData.price;
        } else if (typeInfo.is_tiered_pricing && typeInfo.pricing_tiers) {
          effectivePrice = getEffectivePrice(typeInfo, quantity);
        } else if (typeInfo.base_price || typeInfo.price) {
          effectivePrice = typeInfo.base_price ?? typeInfo.price ?? 0;
        }

        const currency = typeInfo.currency ?? (roomTypeData as { currency?: string } | null)?.currency ?? "PHP";
        const total = effectivePrice * quantity;

        const existing: TravellerTypeWithDetails = resultMap.get(travellerTypeId) ?? {
          id: travellerTypeId,
          title: typeInfo.title ?? (roomTypeData as { title?: string } | null)?.title ?? "",
          description: typeInfo.description ?? "",
          quantity: 0,
          currency,
        };

        existing.quantity += quantity;

        if (currency === "PHP") {
          existing.price = effectivePrice;
          existing.total = (existing.total ?? 0) + total;
        } else if (currency === "USD") {
          existing.usd_price = effectivePrice;
          existing.usd_total = (existing.usd_total ?? 0) + total;
        }

        resultMap.set(travellerTypeId, existing);
      });
    });
  }

  return Array.from(resultMap.values());
}

export function computeSOATravellers(props: SOATravellersInput) {
  const travellerTypesWithDetails = computeTravellerTypesWithDetails(props);
  const nonInfantTravellerTypes = travellerTypesWithDetails.filter((t) => t.title !== "Infant");
  const infantTravellers = travellerTypesWithDetails.filter((t) => t.title === "Infant");
  const totalPax = props.bookingData.totalPax;
  const nonInfantPax = props.nonInfantPax ?? 0;

  return {
    travellerTypesWithDetails,
    nonInfantTravellerTypes,
    infantTravellers,
    totalPax,
    nonInfantPax,
  };
}