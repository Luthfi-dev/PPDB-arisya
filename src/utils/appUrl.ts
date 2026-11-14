const ENV_PLACEHOLDER_ORIGIN = 'https://ppdb.sekolahanda.sch.id';
const DEFAULT_FALLBACK_ORIGIN = 'https://ppdb.arrisalahaceh.or.id';

let runtimeConfiguredAppUrl = '';

export function normalizeAppOrigin(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    const origin = parsed.origin.replace(/\/+$/, '');
    if (origin.toLowerCase() === ENV_PLACEHOLDER_ORIGIN) {
      return '';
    }
    return origin;
  } catch {
    return '';
  }
}

export function setRuntimePublicAppUrl(raw?: string | null): void {
  const normalized = normalizeAppOrigin(raw);
  if (normalized) {
    runtimeConfiguredAppUrl = normalized;
  }
}

export function getPublicAppUrl(explicitAppUrl?: string | null): string {
  const fromArg = normalizeAppOrigin(explicitAppUrl);
  if (fromArg) return fromArg;

  if (runtimeConfiguredAppUrl) {
    return runtimeConfiguredAppUrl;
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, '');
  }

  return DEFAULT_FALLBACK_ORIGIN;
}
