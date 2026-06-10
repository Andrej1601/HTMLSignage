/**
 * Application-level HTTP error. Throw one of these from a route handler (or any
 * helper it calls) and the central error middleware (`errorHandler`) turns it
 * into a `{ error, message, details?, requestId }` JSON response with the right
 * status code — no per-handler try/catch required.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message?: string, details?: unknown) {
    super(message ?? code);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** 400 — malformed or semantically invalid request. */
export const badRequest = (code = 'bad-request', message?: string, details?: unknown): AppError =>
  new AppError(400, code, message, details);

/** 401 — authentication required or failed. */
export const unauthorized = (code = 'unauthorized', message?: string): AppError =>
  new AppError(401, code, message);

/** 403 — authenticated but not allowed. */
export const forbidden = (code = 'forbidden', message?: string): AppError =>
  new AppError(403, code, message);

/** 404 — resource does not exist. */
export const notFound = (code = 'not-found', message?: string): AppError =>
  new AppError(404, code, message);

/** 409 — conflict (e.g. version mismatch, duplicate). */
export const conflict = (code = 'conflict', message?: string, details?: unknown): AppError =>
  new AppError(409, code, message, details);
