import { NextFunction, Request, Response } from "express";

type AsyncRouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

/**
 * Wraps an async controller so a rejected promise is passed to next() (and thus
 * errorHandler) instead of becoming an unhandled rejection that crashes the process.
 * Express 4 does not do this automatically — every async controller must be wrapped.
 */
export function asyncHandler(fn: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
