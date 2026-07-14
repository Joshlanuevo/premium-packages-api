export const Roles = {
  ADMIN: "admin",
  SUPERADMIN: "superadmin",
  MASTERAGENT: "masteragent",
  WHITELABEL: "whitelabel",
  AGENT: "agent",
  SUBAGENT: "subagent",
  ACCOUNTING: "accounting",
  MERCHANT: "merchant",
} as const;

export type Role = (typeof Roles)[keyof typeof Roles];

export const ADMIN_ROLES: Role[] = [Roles.ADMIN, Roles.SUPERADMIN];