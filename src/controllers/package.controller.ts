import { Request, Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import { ok } from "../utils/response";
import * as PackageService from "../services/package.service";
import { computeAllowedActions } from "../constants/permissions";
import { Role } from "../constants/roles";

export async function writePackage(req: AuthedRequest, res: Response) {
  const userId = req.user!.userId;
  const result = await PackageService.writePackage(req.body, userId);
  return ok(res, result, "Package saved successfully.");
}

export async function getPackage(req: AuthedRequest, res: Response) {
  const result = await PackageService.getPackage(req.params.id);
  if (!result) return res.status(404).json({ error: "Package not found." });

  const allowedActions = computeAllowedActions(req.user?.role as Role | undefined);
  return ok(res, { ...result, allowedActions });
}

export async function listPackages(req: AuthedRequest, res: Response) {
  const q = req.query;
  const filters: PackageService.PackageListFilters = {
    category: typeof q.category === "string" ? q.category : undefined,
    search: typeof q.search === "string" ? q.search : undefined,
    minPrice: q.minPrice ? Number(q.minPrice) : undefined,
    maxPrice: q.maxPrice ? Number(q.maxPrice) : undefined,
    duration: q.duration ? Number(q.duration) : undefined,
    destinations: typeof q.destinations === "string" ? q.destinations.split(",") : undefined,
    sortKey: q.sortKey as PackageService.PackageListFilters["sortKey"],
    sortDir: q.sortDir === "asc" ? "asc" : "desc",
    cursor: typeof q.cursor === "string" ? q.cursor : undefined,
    limit: q.limit ? Number(q.limit) : undefined,
  };

  const result = await PackageService.listPackages(filters);
  const allowedActions = computeAllowedActions(req.user?.role as Role | undefined);
  const items = result.items.map((item) => ({ ...item, allowedActions }));

  return ok(res, { items, nextCursor: result.nextCursor });
}

export async function listCategories(_req: Request, res: Response) {
  const result = await PackageService.listCategories();
  return ok(res, result);
}

export async function listDestinations(_req: Request, res: Response) {
  const result = await PackageService.listDestinations();
  return ok(res, result);
}