const rawApiUrl = import.meta.env.VITE_API_URL;

const getDefaultApiUrl = (): string => {
  if (typeof window === 'undefined') {
    return 'http://localhost:3000';
  }

  const host = window.location.hostname || 'localhost';
  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
  return `${protocol}//${host}:3000`;
};

const defaultApiUrl = getDefaultApiUrl();

/**
 * Frontend runtime environment values.
 * Centralized to avoid repeating inline fallbacks across the app.
 */
export const API_URL = (rawApiUrl && rawApiUrl.trim() !== '')
  ? rawApiUrl.replace(/\/+$/, '')
  : defaultApiUrl;

export const ENV_IS_DEV = import.meta.env.DEV;
export const ENV_IS_PROD = import.meta.env.PROD;
