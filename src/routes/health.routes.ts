import { Router } from "express";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: true, message: "premium-packages-api is up" });
});

export default router;
