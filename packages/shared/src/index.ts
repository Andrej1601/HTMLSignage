/**
 * @htmlsignage/shared — Single source of truth for runtime schemas.
 *
 * Frontend and backend both consume Zod schemas from this package.
 * Inferred types (`z.infer<typeof X>`) replace handwritten interfaces
 * to eliminate the FE↔BE type drift class of bugs.
 */

export * from './schedule.js';
export * from './settings.js';
export * from './slideshow.js';
export * from './websocket.js';
