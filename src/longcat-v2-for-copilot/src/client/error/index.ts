import { isOfficialLongCatBaseUrl } from '../../endpoint';
import { EXTERNAL_URLS } from '../../consts';
import { safeStringify } from '../../json';
import { getNetworkErrorMessage, isNetworkError } from './network';
import { t } from '../../i18n';

// ── Error action URL store (for provider notices & error messages) ──
const errorActionUrlStore = (() => {
  let current: Record<string, string> = {};
  return {
    get: () => current,
    set: (key: string, url: string) => { current = { ...current, [key]: url }; },
  };
})();

export function setErrorActionUrl(key: string, url: string): void {
  errorActionUrlStore.set(key, url);
}

// ── Error class ──
export class LongCatRequestError extends Error {
  kind: 'http' | 'network' | 'unknown';
  userSummary: string;
  diagnosticMessage: string;
  baseUrl: string;
  status?: number;
  code?: string;

  constructor(options: {
    message: string;
    cause?: unknown;
    kind: 'http' | 'network' | 'unknown';
    userSummary?: string;
    diagnosticMessage?: string;
    baseUrl: string;
    status?: number;
    code?: string;
  }) {
    super(options.message, { cause: options.cause });
    this.name = 'LongCatRequestError';
    this.kind = options.kind;
    this.userSummary = options.userSummary ?? options.message;
    this.diagnosticMessage = options.diagnosticMessage ?? options.message;
    this.baseUrl = options.baseUrl;
    this.status = options.status;
    this.code = options.code;
  }
}

// ── Factory: HTTP error from fetch response ──
export async function createHttpError(response: Response, context: { baseUrl: string }): Promise<LongCatRequestError> {
  const { baseUrl } = context;
  const responseText = await response.text();
  const serverMessage = extractServerMessage(responseText);
  const userSummary = getHttpErrorMessage(response.status, baseUrl);

  return new LongCatRequestError({
    message: `HTTP ${response.status}: ${serverMessage || response.statusText}`,
    kind: 'http',
    userSummary,
    diagnosticMessage: `HTTP ${response.status} from ${baseUrl}${CHAT_COMPLETIONS_PATH}: ${responseText.slice(0, 1000)}`,
    baseUrl,
    status: response.status,
    code: extractErrorCode(responseText),
  });
}

// ── Normalize any thrown error into LongCatRequestError ──
export function normalizeRequestError(error: unknown, context: { baseUrl: string }): LongCatRequestError {
  if (error instanceof LongCatRequestError) return error;

  if (isNetworkError(error)) {
    return new LongCatRequestError({
      message: getNetworkErrorMessage(error, context.baseUrl),
      kind: 'network',
      userSummary: getNetworkErrorMessage(error, context.baseUrl),
      baseUrl: context.baseUrl,
    });
  }

  const message = error instanceof Error ? error.message : String(error);
  return new LongCatRequestError({
    message,
    kind: 'unknown',
    userSummary: `LongCat API request failed: ${message}`,
    baseUrl: context.baseUrl,
  });
}

// ── Convert to user-facing vscode.LanguageModelError ──
export function createUserFacingError(error: LongCatRequestError): Error & { code?: string } {
  const err = new Error(error.userSummary, { cause: error }) as Error & { code?: string };
  err.name = 'LongCatRequestError';
  return err;
}

// ── Helpers ──
function extractServerMessage(responseText: string): string | undefined {
  try {
    const parsed = JSON.parse(responseText);
    return parsed?.error?.message || parsed?.message || undefined;
  } catch {
    return responseText.slice(0, 200) || undefined;
  }
}

function extractErrorCode(responseText: string): string | undefined {
  try {
    return JSON.parse(responseText)?.error?.code || undefined;
  } catch {
    return undefined;
  }
}

function getHttpErrorMessage(status: number, baseUrl: string): string {
  const isOfficial = isOfficialLongCatBaseUrl(baseUrl);

  switch (status) {
    case 401:
      return t('auth.notConfigured');
    case 402:
      return 'LongCat account requires payment. Visit longcat.chat/platform to top up.';
    case 403:
      return isOfficial
        ? 'LongCat API key has insufficient quota or lacks permission. Visit longcat.chat/platform/usage.'
        : 'API key lacks permission for this resource.';
    case 429:
      return 'LongCat rate limit exceeded. Wait a moment before retrying.';
    case 500:
    case 502:
    case 503:
      return isOfficial
        ? 'LongCat API server error. Check status at status.longcat.chat.'
        : `Upstream server error (${status}). The configured base URL may be unresponsive.`;
    default:
      return `LongCat API returned HTTP ${status}.`;
  }
}

const CHAT_COMPLETIONS_PATH = '/openai/v1/chat/completions';

export function formatRequestError(error: LongCatRequestError): string {
  return `[${error.kind}] ${error.diagnosticMessage}`;
}
