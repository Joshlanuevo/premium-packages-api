import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import { ok } from "../utils/response";
import * as PackageService from "../services/package.service";

export async function writePackage(req: AuthedRequest, res: Response) {
  const userId = req.user!.userId;
  const result = await PackageService.writePackage(req.body, userId);
  return ok(res, result, "Package saved successfully.");
}

export async function getPackage(req: AuthedRequest, res: Response) {
  const result = await PackageService.getPackage(req.params.id);
  if (!result) return res.status(404).json({ error: "Package not found." });
  return ok(res, result);
}
