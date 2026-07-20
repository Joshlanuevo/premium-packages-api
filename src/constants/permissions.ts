import { Roles, Role } from "./roles";

/**
 * Mirrors the route restriction in LakbayHub's Auth.php getUserRoutes():
 * premium-packages-create / -availability-report / -master-file / -settings /
 * -vouchers* are hidden specifically for AGENT, MASTERAGENT, SUBAGENT, and
 * ACCOUNTING. Everyone else (ADMIN, SUPERADMIN, WHITELABEL, MERCHANT) can
 * manage packages. This is the source of truth here — not the
 * isStaff/isCompany/isPartner split in userStore.js, which predates the
 * premium-packages split and doesn't map cleanly onto it.
 */
const MANAGEMENT_RESTRICTED_ROLES: Role[] = [
  Roles.AGENT,
  Roles.MASTERAGENT,
  Roles.SUBAGENT,
  Roles.ACCOUNTING,
];

export function canManagePackages(role: Role | undefined): boolean {
  if (!role) return false;
  return !MANAGEMENT_RESTRICTED_ROLES.includes(role);
}

/**
 * Legacy card collapses to just "Reserve Slot" for type === 'staff' || 'subagent'.
 * TODO(verify): there's no STAFF value in this app's Role enum — confirm
 * whether LakbayHub 'staff' accounts are expected to use Premium Packages at
 * all. SUBAGENT is the only confirmed analog right now.
 */
export function isFrontlineStaff(role: Role | undefined): boolean {
  return role === Roles.SUBAGENT;
}

export interface AllowedActions {
  edit: boolean;
  generateReport: boolean;
  viewFlyers: boolean;
  delete: boolean;
  reserveSlot: boolean;
}

export function computeAllowedActions(role: Role | undefined): AllowedActions {
  return {
    edit: canManagePackages(role),
    generateReport: canManagePackages(role),
    viewFlyers: !isFrontlineStaff(role),
    delete: !isFrontlineStaff(role),
    reserveSlot: true,
  };
}