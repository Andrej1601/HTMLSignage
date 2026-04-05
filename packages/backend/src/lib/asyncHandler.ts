import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async route handler so that rejected promises are
 * forwarded to Express's error-handling middleware automatically.
 *
 * Usage:  router.get('/path', asyncHandler(async (req, res) => { ... }));
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void> | void,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
