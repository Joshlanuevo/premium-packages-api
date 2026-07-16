export interface UserContext {
  isJuanworld: boolean;
  isGladex: boolean;
  isAdmin: boolean;
}

export interface LeadGuest {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
}

export interface AgencyDetails {
  agencyName?: string;
  contactNumber?: string;
  email?: string;
}

export interface Variation {
  id?: string;
  variation_id?: string;
  start_date?: string;
  end_date?: string;
}

export interface SOADataInput {
  recipientData?: { name?: string; label?: string; email?: string };
  packageData?: {
    title?: string;
    area?: string;
    hotel?: string;
    variations?: Variation[];
  };
  selectedVariationId?: string;
  bookingData?: { leadGuestName?: string; confirmationNumber?: string; createdAt?: string | Date; preparedBy?: string };
  storeData?: { leadGuestName?: string; confirmationNumber?: string };
  leadGuest?: LeadGuest;
  agencyDetails?: AgencyDetails;
}

export interface SOAData {
  recipientName: string;
  referenceNumber: string;
  packageTitle: string;
  selectedVariation: Variation | undefined;
  estimatedArrival: Date | null;
  estimatedDeparture: Date | null;
  bookingDate: string | Date;
  area: string;
  preparedBy: string;
  contactEmail: string;
  hotelInfo: string;
  recipientEmail: string;
  leadGuestEmail: string | null;
  leadGuestPhone: string | null;
  leadGuestFullName: string | null;
}

export function computeSOAData(props: SOADataInput, user: UserContext): SOAData {
  const recipientName = (() => {
    if (user.isJuanworld && props.agencyDetails?.agencyName) {
      return props.agencyDetails.agencyName;
    }

    if ((user.isGladex || user.isAdmin) && props.leadGuest) {
      const leadGuestName = `${props.leadGuest.firstName || ""} ${props.leadGuest.lastName || ""}`.trim();
      if (leadGuestName) return leadGuestName;
    }

    return (
      props.recipientData?.name ??
      props.recipientData?.label ??
      props.bookingData?.leadGuestName ??
      props.storeData?.leadGuestName ??
      "TBD"
    );
  })();

  const referenceNumber = (() => {
    const confirmationNumber = props.bookingData?.confirmationNumber || props.storeData?.confirmationNumber;

    if (user.isJuanworld) {
      return confirmationNumber || `JWP${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`;
    }
    return confirmationNumber || `POTB${new Date().getFullYear()}S-${Math.floor(Math.random() * 10000)}`;
  })();

  const packageTitle = props.packageData?.title || "TBD";

  const selectedVariation = props.packageData?.variations?.find(
    (v) => v.variation_id === props.selectedVariationId || v.id === props.selectedVariationId
  );

  const estimatedArrival = selectedVariation?.start_date ? new Date(selectedVariation.start_date) : null;
  const estimatedDeparture = selectedVariation?.end_date ? new Date(selectedVariation.end_date) : null;

  const bookingDate = props.bookingData?.createdAt || new Date();
  const area = props.packageData?.area || "TBD";
  const preparedBy = props.bookingData?.preparedBy || "TBD";

  const contactEmail = (() => {
    if (user.isJuanworld && props.agencyDetails?.contactNumber) {
      return props.agencyDetails.contactNumber;
    }
    if (user.isGladex && props.leadGuest?.phoneNumber) {
      return props.leadGuest.phoneNumber;
    }
    return "TBD";
  })();

  const hotelInfo = props.packageData?.hotel || "TBD";

  const recipientEmail = (() => {
    if (user.isJuanworld && props.agencyDetails?.email) {
      return props.agencyDetails.email;
    }
    if (user.isGladex && props.leadGuest?.email) {
      return props.leadGuest.email;
    }
    return props.recipientData?.email ?? "reservation@gladextours.com";
  })();

  const leadGuestEmail = props.leadGuest?.email || null;
  const leadGuestPhone = props.leadGuest?.phoneNumber || null;
  const leadGuestFullName =
    props.leadGuest?.firstName || props.leadGuest?.lastName
      ? `${props.leadGuest?.firstName || ""} ${props.leadGuest?.lastName || ""}`.trim()
      : null;

  return {
    recipientName,
    referenceNumber,
    packageTitle,
    selectedVariation,
    estimatedArrival,
    estimatedDeparture,
    bookingDate,
    area,
    preparedBy,
    contactEmail,
    hotelInfo,
    recipientEmail,
    leadGuestEmail,
    leadGuestPhone,
    leadGuestFullName,
  };
}