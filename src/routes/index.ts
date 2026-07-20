import { Router } from "express";
import healthRoutes from "./health.routes";
import authRoutes from "./auth.routes";
import packageRoutes from "./package.routes";
import installmentRoutes from "./installment.routes";
import bookingRoutes from "./booking.routes";
import paymentTermsRoutes from "./paymentTerms.routes";
import installmentLifecycleRoutes from "./installmentLifecycle.routes";
import transactionRoutes from "./transaction.routes";
import soaRoutes from "./soa.routes";
import submissionsRoutes from "./submissions.routes";
import userRoutes from "./user.routes";

const router = Router();

router.use(healthRoutes);
router.use(authRoutes);
router.use(packageRoutes);
router.use(installmentRoutes);
router.use(bookingRoutes);
router.use(paymentTermsRoutes);
router.use(installmentLifecycleRoutes);
router.use(transactionRoutes);
router.use(soaRoutes);
router.use(submissionsRoutes);
router.use(userRoutes);

export default router;