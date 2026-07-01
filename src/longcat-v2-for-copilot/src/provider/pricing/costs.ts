import type { LongCatModel } from '../../types';

export function toModelCostInfo(
  model: LongCatModel,
  currency?: string,
): Record<string, unknown> {
  if (!currency || !model.pricing) return {};

  const pricing = model.pricing;
  return {
    ...(model.priceCategory ? { priceCategory: model.priceCategory } : {}),
    inputCost: formatPriceValue(pricing.prompt, currency),
    outputCost: formatPriceValue(pricing.completion, currency),
    cacheCost: formatPriceValue(pricing.cachedTokens, currency),
  };
}

function formatPriceValue(value: number, currency: string): string {
  return `${currency === 'CNY' ? '¥' : '$'}${value}`;
}
