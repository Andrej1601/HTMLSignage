/**
 * Hilfsfunktionen für die Erkennung von 409-Versionskonflikten beim
 * Speichern von versionierten Aggregaten (Settings, Schedule).
 *
 * Backend-Antwortformat im Konfliktfall:
 *   status: 409
 *   body: { error: 'version-conflict', message: string, latestVersion: number }
 *
 * Die Frontend-Mutationen werfen eine `AxiosError`, deshalb ziehen wir
 * die Werte aus `response.status` / `response.data` heraus. Wir prüfen
 * defensiv, weil bei Netzfehlern `response` undefined sein kann.
 */
import type { AxiosError } from 'axios';

interface VersionConflictPayload {
  error: string;
  message?: string;
  latestVersion?: number;
}

export interface VersionConflictInfo {
  /** Aktuellste Version, die der Server kennt. */
  latestVersion: number | null;
  /** Server-Message, falls vorhanden. */
  message: string | null;
}

export function isVersionConflictError(error: unknown): error is AxiosError<VersionConflictPayload> {
  if (!error || typeof error !== 'object') return false;
  const maybeAxios = error as AxiosError<VersionConflictPayload>;
  return (
    maybeAxios.isAxiosError === true &&
    maybeAxios.response?.status === 409 &&
    maybeAxios.response.data?.error === 'version-conflict'
  );
}

export function extractVersionConflict(error: unknown): VersionConflictInfo | null {
  if (!isVersionConflictError(error)) return null;
  const data = error.response?.data;
  return {
    latestVersion: typeof data?.latestVersion === 'number' ? data.latestVersion : null,
    message: typeof data?.message === 'string' ? data.message : null,
  };
}
