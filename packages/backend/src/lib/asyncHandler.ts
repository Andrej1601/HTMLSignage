import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async route handler so that rejected promises are
 * forwarded to Express's error-handling middleware automatically.
 *
 * Generic over the request type so typed requests (e.g. `AuthRequest`)
 * can be used without casts.
 *
 * Usage:  router.get('/path', asyncHandler(async (req, res) => { ... }));
 */
export function asyncHandler<R extends Request = Request>(
  fn: (req: R, res: Response, next: NextFunction) => Promise<void | unknown> | void | unknown,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req as unknown as R, res, next)).catch(next);
  };
}
