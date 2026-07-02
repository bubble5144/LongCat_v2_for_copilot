import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getBaseUrl } from '../../config';
import { isOfficialLongCatBaseUrl } from '../../endpoint';
import { logger } from '../../logger';

export interface TokenPlanBalance {
  available: boolean;
  totalTokens?: number;
  usedTokens?: number;
  remainingTokens?: number;
  unit?: string;
  source: 'official-api' | 'local-estimation';
}

export interface BalanceCache {
  manualBalance?: number;
  sessionConsumption?: number;
  lastUpdated?: number;
}

/**
 * Fetch token plan balance from LongCat.
 */
export async function fetchOfficialTokenBalance(apiKey: string): Promise<TokenPlanBalance | null> {
  const baseUrl = getBaseUrl();
  if (!isOfficialLongCatBaseUrl(baseUrl)) return null;

  const platformEndpoints = [
    '/api/pay/quota/metering/token-usage/overview',
    '/api/pay/commercial/entitlements/token-packs/list',
  ];

  for (const path of platformEndpoints) {
    try {
      const response = await fetch(`https://longcat.chat${path}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      });
      if (response.ok) {
        const data = (await response.json()) as Record<string, unknown>;
        if (data.data && typeof data.data === 'object') {
          const bd = data.data as Record<string, unknown>;
          return {
            available: true,
            totalTokens: bd.total_tokens as number | undefined,
            usedTokens: bd.used_tokens as number | undefined,
            remainingTokens: bd.remaining_tokens as number | undefined,
            unit: (bd.unit as string) ?? 'tokens',
            source: 'official-api',
          };
        }
      }
    } catch (error) {
      logger.debug(`Balance endpoint ${path} failed: ${error}`);
    }
  }
  return null;
}

/**
 * Format token count for display. Uses 万 (10,000) unit.
 */
export function formatTokenCount(tokens: number): string {
  return `${(tokens / 10000).toFixed(1)}万`;
}

// ── Manual balance (globalState key) ──

const MANUAL_BALANCE_KEY = 'longcat-copilot.manualBalanceTokens';

/** Set manual token plan balance. */
export async function setManualBalance(context: vscode.ExtensionContext, tokens: number): Promise<void> {
  await context.globalState.update(MANUAL_BALANCE_KEY, tokens);
  // Sync to file cache (read-modify-write)
  const cache = readBalanceCache(context);
  cache.manualBalance = tokens;
  cache.sessionConsumption = 0;  // reset consumption when manual balance is set
  cache.lastUpdated = Date.now();
  await writeBalanceCache(context, cache);
}

/** Get manual token plan balance. Falls back to file cache. */
export function getManualBalance(context: vscode.ExtensionContext): number | undefined {
  const fromState = context.globalState.get<number>(MANUAL_BALANCE_KEY);
  if (fromState !== undefined) return fromState;
  // Fallback to file cache
  const cache = readBalanceCache(context);
  if (cache.manualBalance !== undefined && cache.manualBalance > 0) {
    return cache.manualBalance;
  }
  return undefined;
}

/** Clear manual balance. */
export async function clearManualBalance(context: vscode.ExtensionContext): Promise<void> {
  await context.globalState.update(MANUAL_BALANCE_KEY, undefined);
  const cache = readBalanceCache(context);
  cache.manualBalance = undefined;
  cache.lastUpdated = Date.now();
  await writeBalanceCache(context, cache);
}

// ── File-based balance cache (cross-session persistence) ──

const BALANCE_CACHE_FILENAME = 'longcat-balance-cache.json';

function getCacheFilePath(context: vscode.ExtensionContext): string {
  return path.join(context.globalStorageUri.fsPath, BALANCE_CACHE_FILENAME);
}

export function readBalanceCache(context: vscode.ExtensionContext): BalanceCache {
  try {
    const fp = getCacheFilePath(context);
    if (!fs.existsSync(fp)) return {};
    const raw = fs.readFileSync(fp, 'utf8');
    return JSON.parse(raw) as BalanceCache;
  } catch {
    return {};
  }
}

export async function writeBalanceCache(context: vscode.ExtensionContext, cache: BalanceCache): Promise<void> {
  try {
    const fp = getCacheFilePath(context);
    const dir = path.dirname(fp);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(fp, JSON.stringify(cache, null, 2), 'utf8');
  } catch (error) {
    logger.warn('Failed to write balance cache file', error);
  }
}

/**
 * Periodic flush: save current consumption to file cache.
 * Called on every usage update.
 */
export async function syncBalanceCache(
  context: vscode.ExtensionContext,
  sessionConsumption: number,
): Promise<void> {
  const cache = readBalanceCache(context);
  cache.sessionConsumption = sessionConsumption;
  cache.lastUpdated = Date.now();
  // If no manual balance, persist the consumption as "negative balance" hint
  if (cache.manualBalance === undefined) {
    cache.manualBalance = undefined;  // no manual balance
  }
  await writeBalanceCache(context, cache);
}

/**
 * Calculate remaining balance = manual - billable consumption.
 * Cached tokens are NOT deducted (token plan typically doesn't count cache hits).
 */
export function calculateRemainingBalance(
  context: vscode.ExtensionContext,
  localUsage: { totalTokens: number; uncachedPromptTokens?: number; completionTokens?: number },
): { hasManualBalance: boolean; remaining?: number; manualTotal?: number } {
  const manual = getManualBalance(context);
  if (manual === undefined) {
    return { hasManualBalance: false };
  }
  // Billable tokens = uncached prompt + completion (cache hits excluded)
  const billable = (localUsage.uncachedPromptTokens ?? 0) + (localUsage.completionTokens ?? localUsage.totalTokens);
  return {
    hasManualBalance: true,
    remaining: Math.max(manual - billable, 0),
    manualTotal: manual,
  };
}

/**
 * Format balance for status bar display (Chinese).
 */
export function formatBalanceForStatusBar(
  context: vscode.ExtensionContext,
  localUsage: { totalTokens: number; uncachedPromptTokens?: number; completionTokens?: number },
): string {
  const { hasManualBalance, remaining } = calculateRemainingBalance(context, localUsage);

  if (hasManualBalance && remaining !== undefined) {
    const remainingStr = formatTokenCount(remaining);
    return `$(graph) LongCat:${remainingStr}`;
  }

  // No manual balance — show negative session consumption
  const used = formatTokenCount(localUsage.totalTokens);
  return `$(graph) LongCat:-${used}`;
}

/**
 * Format balance tooltip (Chinese).
 */
export function formatBalanceTooltip(
  context: vscode.ExtensionContext,
  localUsage: { totalTokens: number; cachedTokens?: number; uncachedPromptTokens?: number; completionTokens?: number },
): string {
  const parts: string[] = [];

  parts.push(`本会话消耗: ${formatTokenCount(localUsage.totalTokens)}`);

  const cachedTk = localUsage.cachedTokens ?? 0;
  const uncachedTk = localUsage.uncachedPromptTokens ?? 0;
  const completionTk = localUsage.completionTokens ?? 0;
  parts.push(`缓存命中: ${formatTokenCount(cachedTk)}`);
  parts.push(`未缓存输入: ${formatTokenCount(uncachedTk)}`);

  const { hasManualBalance, remaining } = calculateRemainingBalance(context, localUsage);
  if (hasManualBalance && remaining !== undefined) {
    parts.push(`剩余额度: ${formatTokenCount(remaining)}`);
    parts.push(`估算费用: ¥0.00`);
  } else {
    const pricing = getPricingConfig();
    const costUncached = (uncachedTk / 1_000_000) * pricing.inputUncached;
    const costCached = (cachedTk / 1_000_000) * pricing.inputCached;
    const costCompletion = (completionTk / 1_000_000) * pricing.output;
    const totalCost = costUncached + costCached + costCompletion;
    parts.push(`估算费用: ¥${totalCost.toFixed(2)}`);
  }

  parts.push('');
  parts.push('点击查看用量详情：longcat.chat/platform/usage');

  return parts.join('\n');
}

/** Pricing defaults (discounted). */
const DEFAULT_PRICING = { inputUncached: 2, inputCached: 0.04, output: 8 };

function getPricingConfig(): { inputUncached: number; inputCached: number; output: number } {
  const cfg = vscode.workspace.getConfiguration('longcat-copilot.pricing');
  return {
    inputUncached: cfg.get<number>('inputUncached') ?? DEFAULT_PRICING.inputUncached,
    inputCached: cfg.get<number>('inputCached') ?? DEFAULT_PRICING.inputCached,
    output: cfg.get<number>('output') ?? DEFAULT_PRICING.output,
  };
}
