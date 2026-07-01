import { isOfficialLongCatBaseUrl } from '../../endpoint';
import { CHAT_COMPLETIONS_PATH } from '../../consts';

/**
 * Recognise common network errors that are NOT HTTP error responses.
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message === 'fetch failed') return true;
  if (isAbortError(error)) return true;
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (msg.includes('econnrefused') || msg.includes('enotfound') || msg.includes('etimedout')) return true;
  if (msg.includes('network') && msg.includes('unreachable')) return true;
  return false;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.message.includes('abort'));
}

/**
 * Resolve the best user-facing error message for a failed request.
 */
export function getNetworkErrorMessage(error: unknown, baseUrl: string): string {
  if (isOfficialLongCatBaseUrl(baseUrl)) {
    return 'Network error connecting to LongCat API. Check your connection or visit status.longcat.chat.';
  }
  const host = extractHost(baseUrl);
  return `Network error connecting to ${host}. Verify the base URL in longcat-copilot.baseUrl settings.`;
}

function extractHost(baseUrl: string): string {
  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl;
  }
}
