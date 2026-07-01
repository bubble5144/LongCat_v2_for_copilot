import type { StreamUsage } from '../../types';
import { MODELS } from '../../consts';

/** Accumulated session usage (Token-based, per LongCat platform conventions). */
export interface AccumulatedUsage {
  promptTokens: number;
  completionTokens: number;
  reasoning_tokens: number;
  cachedTokens: number;
  uncachedPromptTokens: number;
  totalTokens: number;
  estimatedCostCNY?: number;
}

/** Create a zeroed accumulator. */
export function createEmptyUsage(): AccumulatedUsage {
  return {
    promptTokens: 0,
    completionTokens: 0,
    reasoning_tokens: 0,
    cachedTokens: 0,
    uncachedPromptTokens: 0,
    totalTokens: 0,
    estimatedCostCNY: undefined,
  };
}

/**
 * Accumulate token usage from a stream chunk.
 * Primary metric: totalTokens (LongCat is token-based).
 * Secondary: estimatedCostCNY (reference, with cache hit discount).
 */
export function accumulateUsage(
  prev: AccumulatedUsage,
  usage: StreamUsage,
): AccumulatedUsage {
  const reasoning_tokens = usage.completion_tokens_details?.reasoning_tokens ?? 0;
  const cached = usage.prompt_tokens_details?.cached_tokens
    ?? usage.prompt_cache_hit_tokens
    ?? 0;
  const uncached = Math.max(usage.prompt_tokens - cached, 0);
  const totalTokens = prev.totalTokens + usage.prompt_tokens + usage.completion_tokens;

  const model = MODELS[0];
  let estimatedCostCNY = prev.estimatedCostCNY;
  if (model?.pricing) {
    const uncachedPromptCost = (uncached / 1_000_000) * model.pricing.prompt;
    const cachedPromptCost = (cached / 1_000_000) * model.pricing.cachedTokens;
    const completionCost = (usage.completion_tokens / 1_000_000) * model.pricing.completion;
    estimatedCostCNY = (prev.estimatedCostCNY ?? 0) + uncachedPromptCost + cachedPromptCost + completionCost;
  }

  return {
    promptTokens: prev.promptTokens + usage.prompt_tokens,
    completionTokens: prev.completionTokens + usage.completion_tokens,
    reasoning_tokens: prev.reasoning_tokens + reasoning_tokens,
    cachedTokens: prev.cachedTokens + cached,
    uncachedPromptTokens: prev.uncachedPromptTokens + uncached,
    totalTokens,
    estimatedCostCNY,
  };
}

/** Format the accumulated usage as a human-readable status bar text. */
export function formatUsageForStatusBar(acc: AccumulatedUsage): string {
  if (acc.totalTokens === 0) return '$(graph) LongCat';
  return `$(graph) LongCat: ${formatTokens(acc.totalTokens)}`;
}

/** Format the accumulated usage as a tooltip (Chinese). */
export function formatUsageTooltip(acc: AccumulatedUsage): string {
  if (acc.totalTokens === 0) return '本会话暂无 Token 消耗';
  const parts = [
    `本会话: ${formatTokens(acc.totalTokens)} tokens`,
    `  输入: ${formatTokens(acc.promptTokens)}`,
    `  输出: ${formatTokens(acc.completionTokens)}`,
  ];
  if (acc.cachedTokens > 0) {
    const hitRate = ((acc.cachedTokens / acc.promptTokens) * 100).toFixed(1);
    parts.push(`  缓存命中: ${formatTokens(acc.cachedTokens)} (${hitRate}%)`);
  }
  if (acc.reasoning_tokens > 0) {
    parts.push(`  推理: ${formatTokens(acc.reasoning_tokens)}`);
  }
  if (acc.estimatedCostCNY !== undefined && acc.estimatedCostCNY > 0) {
    parts.push(`  参考费用: ¥${acc.estimatedCostCNY.toFixed(4)}`);
  }
  return parts.join('\n');
}

function formatTokens(n: number): string {
  return `${(n / 10000).toFixed(1)}万`;
}
