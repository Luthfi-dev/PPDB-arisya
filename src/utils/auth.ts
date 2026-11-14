/**
 * Unified Cookie-Session & CSRF Security Helper
 * Session credentials live strictly in an HttpOnly cookie (`ppdb_session`).
 * This helper manages only the anti-CSRF token in memory + double-submit cookie read,
 * and cleans up any legacy Web Storage tokens.
 */
export const LEGACY_AUTH_TOKEN_KEY = 'ppdb_session_token';
export const LEGACY_AUTH_TOKEN_KEY_2 = 'ppdb_auth_token';
export const CSRF_COOKIE_NAME = 'ppdb_csrf';

let inMemoryCsrfToken = '';

export function purgeLegacyStorageTokens(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
    localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY_2);
    sessionStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
    sessionStorage.removeItem(LEGACY_AUTH_TOKEN_KEY_2);
  } catch {
    // ignore storage errors
  }
}

function readCsrfFromCookie(): string {
  if (typeof document === 'undefined' || !document.cookie) return '';
  for (const part of document.cookie.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = part.slice(0, eqIdx).trim();
    if (key === CSRF_COOKIE_NAME) {
      try {
        return decodeURIComponent(part.slice(eqIdx + 1).trim());
      } catch {
        return part.slice(eqIdx + 1).trim();
      }
    }
  }
  return '';
}

export function getCsrfToken(): string {
  if (inMemoryCsrfToken) return inMemoryCsrfToken;
  const fromCookie = readCsrfFromCookie();
  if (fromCookie) {
    inMemoryCsrfToken = fromCookie;
  }
  return inMemoryCsrfToken;
}

export function setCsrfToken(token: string): void {
  if (typeof token === 'string' && token.trim()) {
    inMemoryCsrfToken = token.trim();
  }
}

export function clearCsrfToken(): void {
  inMemoryCsrfToken = '';
  purgeLegacyStorageTokens();
}

export function getAuthHeaders(includeJsonContentType = true): Record<string, string> {
  const headers: Record<string, string> = {};
  if (includeJsonContentType) {
    headers['Content-Type'] = 'application/json';
  }
  const csrf = getCsrfToken();
  if (csrf) {
    headers['X-CSRF-Token'] = csrf;
  }
  return headers;
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const method = (init.method || 'GET').toUpperCase();
  const mergedHeaders = new Headers(init.headers || {});
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && !mergedHeaders.has('X-CSRF-Token')) {
    const csrf = getCsrfToken();
    if (csrf) {
      mergedHeaders.set('X-CSRF-Token', csrf);
    }
  }
  return fetch(input, {
    ...init,
    credentials: 'include',
    headers: mergedHeaders,
  });
}
