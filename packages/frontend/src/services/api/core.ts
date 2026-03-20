import axios from 'axios';
import { API_URL } from '@/config/env';
import type { FetchApiOptions, FetchApiResponseType } from './types';

const DEFAULT_REQUEST_TIMEOUT_MS = 8000;
const AUTH_TOKEN_STORAGE_KEY = 'auth_token';

export const api = axios.create({
  baseURL: '/api',
  timeout: DEFAULT_REQUEST_TIMEOUT_MS,
});

// Attach JWT from localStorage to every request unless already set.
api.interceptors.request.use((config) => {
  if (!config.headers.Authorization) {
    const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export function getAuthHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

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
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    responseType = 'json',
    token,
    ...init
  } = options;

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  const requestHeaders = new Headers(headers);
  const storedToken = token || (
    typeof window !== 'undefined'
      ? window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
      : null
  );

  if (storedToken && !requestHeaders.has('Authorization')) {
    requestHeaders.set('Authorization', `Bearer ${storedToken}`);
  }

  const requestBody = body ?? buildFetchBody(data, requestHeaders);

  try {
    const response = await fetch(resolveApiUrl(url), {
      ...init,
      headers: requestHeaders,
      body: requestBody,
      signal: controller.signal,
    });

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
