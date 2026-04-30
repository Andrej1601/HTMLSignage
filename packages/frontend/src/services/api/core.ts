import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { API_URL } from '@/config/env';
import { API_REQUEST_TIMEOUT_MS } from '@/utils/constants';
import type { FetchApiOptions, FetchApiResponseType } from './types';

// CSRF token store. The backend sets `csrf_token` as a non-httpOnly cookie
// AND mirrors it via `X-CSRF-Token` response header. The header is the
// reliable read-path for cross-origin SPA setups (where document.cookie
// cannot see cookies set by a different origin); the cookie remains for
// same-origin and backend-side validation.
let csrfTokenInMemory = '';

function readCsrfTokenFromCookie(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function getCsrfToken(): string {
  if (csrfTokenInMemory) return csrfTokenInMemory;
  return readCsrfTokenFromCookie();
}

function captureCsrfTokenFromHeaders(headers: unknown): void {
  if (!headers) return;
  // Axios 1.x AxiosHeaders supports `.get()`. Plain Headers (fetch) too.
  // Plain object headers work via bracket access.
  let value: unknown;
  const h = headers as { get?: (key: string) => string | null } & Record<string, unknown>;
  if (typeof h.get === 'function') {
    value = h.get('x-csrf-token') ?? h.get('X-CSRF-Token');
  }
  if (!value) value = h['x-csrf-token'] ?? h['X-CSRF-Token'];
  if (typeof value === 'string' && value.length > 0) {
    csrfTokenInMemory = value;
  }
}

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: API_REQUEST_TIMEOUT_MS,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const method = (config.method || 'get').toLowerCase();
  if (method !== 'get' && method !== 'head' && method !== 'options') {
    const token = getCsrfToken();
    if (token) {
      config.headers.set('X-CSRF-Token', token);
    }
  }
  return config;
});

interface RetryableConfig extends InternalAxiosRequestConfig {
  _csrfRetry?: boolean;
}

api.interceptors.response.use(
  (response) => {
    captureCsrfTokenFromHeaders(response.headers);
    return response;
  },
  async (error: AxiosError<{ error?: string }>) => {
    // On CSRF failure, refresh the token via /auth/me once and retry.
    // Handles the race where a tab loaded before the CSRF feature shipped
    // does not yet have a token in memory when the user clicks Save.
    const status = error.response?.status;
    const errorCode = error.response?.data?.error;
    const isCsrfFailure = status === 403
      && (errorCode === 'csrf-token-invalid' || errorCode === 'csrf-token-missing');
    const config = error.config as RetryableConfig | undefined;
    if (isCsrfFailure && config && !config._csrfRetry) {
      config._csrfRetry = true;
      try {
        const meResp = await axios.get(`${API_URL}/api/auth/me`, { withCredentials: true });
        captureCsrfTokenFromHeaders(meResp.headers);
        const fresh = getCsrfToken();
        if (fresh) {
          config.headers.set('X-CSRF-Token', fresh);
          return api.request(config);
        }
      } catch {
        // fall through and rethrow original error
      }
    }
    return Promise.reject(error);
  },
);

export function getDeviceHeaders(deviceToken?: string) {
  if (!deviceToken) return undefined;
  return {
    'X-Device-Token': deviceToken,
  };
}

function resolveApiUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/api') || url.startsWith('/health')) return `${API_URL}${url}`;
  return `${API_URL}/api${url.startsWith('/') ? url : `/${url}`}`;
}

function buildFetchBody(data: unknown, headers: Headers): BodyInit | null | undefined {
  if (data === undefined) return undefined;
  if (
    data instanceof FormData
    || data instanceof URLSearchParams
    || data instanceof Blob
    || data instanceof ArrayBuffer
    || typeof data === 'string'
  ) {
    return data as BodyInit;
  }

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return JSON.stringify(data);
}

async function parseResponseBody<T>(response: Response, responseType: FetchApiResponseType): Promise<T> {
  if (responseType === 'void') return undefined as T;
  if (responseType === 'blob') return await response.blob() as T;
  if (responseType === 'text') return await response.text() as T;

  const raw = await response.text();
  return (raw ? JSON.parse(raw) : null) as T;
}

async function parseErrorMessage(response: Response): Promise<string> {
  const raw = await response.text().catch(() => '');
  if (!raw) return `HTTP ${response.status}`;

  try {
    const parsed = JSON.parse(raw) as { message?: string; error?: string };
    return parsed.message || parsed.error || `HTTP ${response.status}`;
  } catch {
    return raw;
  }
}

export async function fetchApi<T = unknown>(url: string, options: FetchApiOptions = {}): Promise<T> {
  const {
    data,
    body,
    headers,
    timeoutMs = API_REQUEST_TIMEOUT_MS,
    responseType = 'json',
    deviceToken,
    ...init
  } = options;

  const useCookies = !deviceToken;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  const requestHeaders = new Headers(headers);

  if (deviceToken && !requestHeaders.has('X-Device-Token')) {
    requestHeaders.set('X-Device-Token', deviceToken);
  }

  if (useCookies && !requestHeaders.has('X-CSRF-Token')) {
    const method = (init.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        requestHeaders.set('X-CSRF-Token', csrfToken);
      }
    }
  }

  const requestBody = body ?? buildFetchBody(data, requestHeaders);

  try {
    const response = await fetch(resolveApiUrl(url), {
      ...init,
      headers: requestHeaders,
      body: requestBody,
      signal: controller.signal,
      credentials: useCookies ? 'include' : 'same-origin',
    });

    // Capture CSRF token from response headers so subsequent mutations
    // can include it (works cross-origin where cookies aren't readable).
    const headerToken = response.headers.get('x-csrf-token');
    if (headerToken) {
      csrfTokenInMemory = headerToken;
    }

    if (!response.ok) {
      throw new Error(await parseErrorMessage(response));
    }

    return await parseResponseBody<T>(response, responseType);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export default api;
