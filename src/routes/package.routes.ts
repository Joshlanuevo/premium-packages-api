import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../middleware/asyncHandler";
import * as PackageController from "../controllers/package.controller";

const router = Router();

// Static paths must come before "/packages/:id", or "/packages/categories"
// would be matched as :id = "categories".
router.get("/packages/categories", requireAuth, asyncHandler(PackageController.listCategories));
router.get("/packages/destinations", requireAuth, asyncHandler(PackageController.listDestinations));
router.get("/packages", requireAuth, asyncHandler(PackageController.listPackages));

router.get("/packages/:id", asyncHandler(PackageController.getPackage));

router.post(
  "/packages",
  requireAuth,
  requireRole(),
  asyncHandler(PackageController.writePackage)
);

export default router;