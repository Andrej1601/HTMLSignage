import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from './httpError.js';

const isDev = process.env.NODE_ENV === 'development';

function requestIdOf(req: Request): string | null {
  return (req as Request & { requestId?: string }).requestId ?? null;
}

/**
 * Central Express error-handling middleware. Mounted last in the chain, it
 * normalises every error thrown from a route handler into a consistent JSON
 * envelope: `{ error, message, details?, requestId }`.
 *
 * - `ZodError`              -> 400 `validation-failed` (+ issue details)
 * - `AppError`              -> its own status / code / message / details
 * - Prisma `P2025`          -> 404 `not-found` (record to update/delete missing)
 * - anything else           -> 500 `internal-server-error` (logged with stack)
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // If the response already started streaming, defer to Express' default handler.
  if (res.headersSent) {
    next(err);
    return;
  }

  const requestId = requestIdOf(req);

  if (err instanceof z.ZodError) {
    res.status(400).json({
      error: 'validation-failed',
      message: 'Eingabe ungültig',
      details: err.issues,
      requestId,
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json({
      error: err.code,
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
      requestId,
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
    res.status(404).json({
      error: 'not-found',
      message: 'Ressource nicht gefunden',
      requestId,
    });
    return;
  }

  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  console.error(JSON.stringify({
    type: 'http_error',
    requestId,
    method: req.method,
    path: req.path,
    message,
    stack: isDev ? stack : undefined,
  }));

  res.status(500).json({
    error: 'internal-server-error',
    message: isDev ? message : 'An error occurred',
    requestId,
  });
}
