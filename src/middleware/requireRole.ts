import { NextFunction, Response } from "express";
import { AuthedRequest } from "./auth";
import { ADMIN_ROLES, Role } from "../constants/roles";

export function requireRole(...allowedRoles: Role[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const role = req.user?.role as Role | undefined;

    if (!role) {
      return res.status(403).json({ error: "Token is missing a role claim." });
    }

    if (ADMIN_ROLES.includes(role)) {
      return next();
    }

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ error: "You are not allowed to perform this action." });
    }

    next();
  };
}