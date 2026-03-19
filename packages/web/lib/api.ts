import type { ApiResponse } from '@donuttrade/shared';

declare global {
  interface Window {
    __maintenanceMessage?: string;
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://moldo.go.ro:9443';

// Module-level singleton — shared across all callers within the same page lifecycle
let _accessToken: string | null = null;

export function setAccessToken(token: string) {
  _accessToken = token;
  try {
    localStorage.setItem('dt_access_token', token);
  } catch {
    // localStorage may be unavailable
  }
}

export function clearAccessToken() {
  _accessToken = null;
  try {
    localStorage.removeItem('dt_access_token');
  } catch {
    // localStorage may be unavailable
  }
}

export function getAccessToken(): string | null {
  if (_accessToken) return _accessToken;
  try {
    _accessToken = localStorage.getItem('dt_access_token');
  } catch {
    // localStorage may be unavailable
  }
  return _accessToken;
}

// ── Impersonation helpers ──────────────────────────────────────────────

export function startImpersonation(token: string, targetUsername: string) {
  try {
    // Save the admin's current token so we can restore it later
    const adminToken = getAccessToken();
    if (adminToken) {
      localStorage.setItem('dt_admin_token', adminToken);
    }
    localStorage.setItem('dt_impersonating', targetUsername);
  } catch {
    // localStorage may be unavailable
  }
  setAccessToken(token);
}

export function stopImpersonation() {
  try {
    const adminToken = localStorage.getItem('dt_admin_token');
    if (adminToken) {
      setAccessToken(adminToken);
    }
    localStorage.removeItem('dt_admin_token');
    localStorage.removeItem('dt_impersonating');
  } catch {
    // localStorage may be unavailable
  }
}

export function getImpersonating(): string | null {
  try {
    return localStorage.getItem('dt_impersonating');
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  code: string;
  statusCode: number;
  details?: Record<string, unknown>;

  constructor(message: string, code: string, statusCode: number, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

// Deduplication: concurrent 401s share a single in-flight refresh
let _refreshPromise: Promise<string> | null = null;

function refreshAccessToken(): Promise<string> {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = doRefresh().finally(() => { _refreshPromise = null; });
  return _refreshPromise;
}

async function doRefresh(): Promise<string> {
  // POST with credentials: 'include' sends the httpOnly dt_refresh_token cookie
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    clearAccessToken();
    throw new ApiError('Session expired', 'REFRESH_FAILED', res.status);
  }

  const json: ApiResponse<{ accessToken: string }> = await res.json();
  const newToken = json.data?.accessToken;

  if (!newToken) {
    clearAccessToken();
    throw new ApiError('No token in refresh response', 'REFRESH_FAILED', 500);
  }

  setAccessToken(newToken);
  return newToken;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token = getAccessToken();

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (res.ok) {
    const json: ApiResponse<T> = await res.json();
    return json.data as T;
  }

  // Check for maintenance mode
  if (res.status === 503) {
    const data = await res.json().catch(() => null);
    if (data?.maintenance) {
      const msg = data.error?.message || 'Platform is under maintenance';
      window.__maintenanceMessage = msg;
      window.dispatchEvent(new CustomEvent('maintenance', { detail: msg }));
      throw new ApiError(msg, 'MAINTENANCE', 503);
    }
  }

  // Try to parse error body
  let errorBody: ApiResponse | null = null;
  try {
    errorBody = await res.json();
  } catch {
    // non-JSON error
  }

  const errorCode = errorBody?.error?.code ?? 'UNKNOWN';

  // Auto-refresh on auth failure (expired or invalid token — only once)
  if (res.status === 401 && (errorCode === 'TOKEN_EXPIRED' || errorCode === 'INVALID_TOKEN')) {
    const newToken = await refreshAccessToken(); // throws ApiError on failure

    const retryRes = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newToken}`,
        ...init?.headers,
      },
    });

    if (retryRes.ok) {
      const json: ApiResponse<T> = await retryRes.json();
      return json.data as T;
    }

    const retryError: ApiResponse = await retryRes.json().catch(() => ({
      success: false,
      error: { code: 'UNKNOWN', message: retryRes.statusText },
    }));
    throw new ApiError(
      retryError.error?.message ?? retryRes.statusText,
      retryError.error?.code ?? 'UNKNOWN',
      retryRes.status,
      retryError.error?.details,
    );
  }

  throw new ApiError(
    errorBody?.error?.message ?? res.statusText,
    errorCode,
    res.status,
    errorBody?.error?.details,
  );
}
