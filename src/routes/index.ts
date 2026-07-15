import { Router } from "express";
import healthRoutes from "./health.routes";
import authRoutes from "./auth.routes";
import packageRoutes from "./package.routes";
import installmentRoutes from "./installment.routes";
import bookingRoutes from "./booking.routes";
import paymentTermsRoutes from "./paymentTerms.routes";
import installmentLifecycleRoutes from "./installmentLifecycle.routes";

const router = Router();

router.use(healthRoutes);
router.use(authRoutes);
router.use(packageRoutes);
router.use(installmentRoutes);
router.use(bookingRoutes);
router.use(paymentTermsRoutes);
router.use(installmentLifecycleRoutes);

export default router;