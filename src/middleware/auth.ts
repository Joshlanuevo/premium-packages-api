import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

// Matches the DEV/PROD split already used in the utilities API's JWT_SECRET_DEV /
// JWT_SECRET_PROD — same suffix convention (not the DEV_/PROD_ prefix pattern used
// for the Firebase vars), since this must be the exact same secret core POTB signs
// with, byte for byte, or verification fails for every token.
function getJwtSecret(): string {
  const key = process.env.NODE_ENV === "production" ? "JWT_SECRET_PROD" : "JWT_SECRET_DEV";
  const secret = process.env[key];
  if (!secret) {
    throw new Error(`${key} is not defined in environment variables.`);
  }
  return secret;
}

export interface AuthedUserData {
  userId: string;
  status?: string;
  role?: string;
  agency_id?: string;
  country_name?: string;
  region_name?: string;
  currency?: string;
  [key: string]: unknown;
}

export interface AuthedRequest extends Request {
  user?: AuthedUserData;
}

export function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing bearer token." });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as { data?: AuthedUserData };

    if (!decoded.data?.userId) {
      return res.status(401).json({ error: "Token payload missing userId." });
    }

    req.user = decoded.data;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}