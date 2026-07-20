import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import { ok } from "../utils/response";
import * as SubmissionsService from "../services/submissions.service";

export async function getSubmissionsByVariation(req: AuthedRequest, res: Response) {
  const packageId = req.query.package_id as string | undefined;
  const variationIdsRaw = req.query.variation_ids as string | undefined;

  if (!packageId || !variationIdsRaw) {
    return res.status(400).json({ error: "package_id and variation_ids are required." });
  }

  const variationIds = variationIdsRaw.split(",").filter(Boolean);
  const result = await SubmissionsService.getSubmissionsByVariations(packageId, variationIds);
  return ok(res, result);
}