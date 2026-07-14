import { Request, Response } from "express";
import { ok } from "../utils/response";
import * as AuthService from "../services/auth.service";

export async function login(req: Request, res: Response) {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const token = await AuthService.login(email, password);
  return ok(res, { token }, "Login successful.");
}