export interface CommissionItemForDisplay {
  price: number;
  nonInfantPax?: number;
}

export function computeDisplayTotal(
  baseTotal: number,
  commissionItems: CommissionItemForDisplay[] | undefined,
  nonInfantPax: number,
  isClientSOA: boolean
): number {
  if (!commissionItems || commissionItems.length === 0) {
    return baseTotal;
  }

  if (isClientSOA) {
    const totalCommission = commissionItems.reduce((sum, c) => sum + c.price * nonInfantPax, 0);
    return baseTotal + totalCommission;
  }

  return baseTotal;
}

export interface PaymentScheduleForBalance {
  remainingBalance?: number;
  installmentCurrency?: string;
  balanceCurrency?: string;
  guaranteeDepositAmount?: number;
}

export function computeRemainingBalanceForDocument(
  paymentSchedule: PaymentScheduleForBalance | undefined,
  pesoDisplayTotal: number,
  usdDisplayTotal: number
): number {
  if (paymentSchedule?.remainingBalance !== undefined) {
    return paymentSchedule.remainingBalance;
  }

  const installmentCurrency = paymentSchedule?.installmentCurrency;
  const packageCurrency = paymentSchedule?.balanceCurrency || installmentCurrency || "PHP";
  const displayTotal = packageCurrency === "USD" ? usdDisplayTotal : pesoDisplayTotal;
  const depositCurrency = installmentCurrency;
  const deposit = depositCurrency === packageCurrency ? paymentSchedule?.guaranteeDepositAmount ?? 0 : 0;

  return Math.max(displayTotal - deposit, 0);
}

export interface LeadGuestForDisplay {
  email?: string;
  phoneNumber?: string;
  phone_number?: string;
  phone?: string;
}

export interface AgencyDetailsForDisplay {
  agencyName?: string;
  company_name?: string;
  email?: string;
  contactNumber?: string;
  contact_no?: string;
}

export interface TravelInfoForDisplay {
  leadGuest?: LeadGuestForDisplay;
  contactEmail?: string;
  agencyDetails?: AgencyDetailsForDisplay;
}

export interface DisplayUserContext {
  isJuanworld: boolean;
  isGladex: boolean;
  isAdmin: boolean;
}

export function resolveEffectiveAgencyDetails(
  soaAgencyDetails: AgencyDetailsForDisplay | undefined,
  fallbackAgencyDetails: AgencyDetailsForDisplay | undefined
): AgencyDetailsForDisplay | undefined {
  if (soaAgencyDetails?.agencyName || soaAgencyDetails?.company_name) {
    return soaAgencyDetails;
  }
  return fallbackAgencyDetails;
}

export function computeDisplayEmail(
  travelInfo: TravelInfoForDisplay | undefined,
  user: DisplayUserContext,
  effectiveAgencyDetails: AgencyDetailsForDisplay | undefined
): string {
  if ((user.isGladex || user.isAdmin) && travelInfo?.leadGuest?.email) {
    return travelInfo.leadGuest.email;
  }
  if (user.isJuanworld && effectiveAgencyDetails?.email) {
    return effectiveAgencyDetails.email;
  }
  return travelInfo?.contactEmail || effectiveAgencyDetails?.email || "TBD";
}

export function computeDisplayContact(
  travelInfo: TravelInfoForDisplay | undefined,
  user: DisplayUserContext,
  effectiveAgencyDetails: AgencyDetailsForDisplay | undefined
): string {
  if (user.isJuanworld && effectiveAgencyDetails?.contactNumber) {
    return effectiveAgencyDetails.contactNumber;
  }
  if (user.isJuanworld && effectiveAgencyDetails?.contact_no) {
    return effectiveAgencyDetails.contact_no;
  }
  if ((user.isGladex || user.isAdmin) && travelInfo?.leadGuest?.phoneNumber) {
    return travelInfo.leadGuest.phoneNumber;
  }

  const leadGuest = travelInfo?.leadGuest;
  return (
    effectiveAgencyDetails?.contact_no ||
    leadGuest?.phoneNumber ||
    leadGuest?.phone_number ||
    leadGuest?.phone ||
    travelInfo?.contactEmail ||
    "TBD"
  );
}