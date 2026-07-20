import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import { ok } from "../utils/response";
import * as UserService from "../services/user.service";

export async function getMe(req: AuthedRequest, res: Response) {
  const userId = req.user!.userId;
  const profile = await UserService.getUserProfile(userId);
  if (!profile) return res.status(404).json({ error: "User not found." });
  return ok(res, profile);
}