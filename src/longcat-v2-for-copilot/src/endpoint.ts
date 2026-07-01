import { OFFICIAL_LONGCAT_API_HOST } from './consts';

export { OFFICIAL_LONGCAT_API_HOST };

export function isOfficialLongCatBaseUrl(baseUrl: string): boolean {
  try {
    return new URL(baseUrl).hostname.toLowerCase() === OFFICIAL_LONGCAT_API_HOST;
  } catch {
    return false;
  }
}

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/u, '');
}
