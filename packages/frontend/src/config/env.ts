const rawApiUrl = import.meta.env.VITE_API_URL;

/**
 * Frontend runtime environment values.
 * Centralized to avoid repeating inline fallbacks across the app.
 */
export const API_URL = (rawApiUrl && rawApiUrl.trim() !== '')
  ? rawApiUrl.replace(/\/+$/, '')
  : 'http://localhost:3000';

export const ENV_IS_DEV = import.meta.env.DEV;
export const ENV_IS_PROD = import.meta.env.PROD;
