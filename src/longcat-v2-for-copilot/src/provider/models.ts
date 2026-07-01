import * as vscode from 'vscode';
import { t } from '../i18n';
import type { LongCatModel } from '../types';
import { toModelCostInfo } from './pricing/costs';

export function toChatInfo(
  model: LongCatModel,
  hasApiKey: boolean,
  pricingCurrency?: string,
  imageInputOverride?: boolean,
): vscode.LanguageModelChatInformation {
  const modelDetail = resolveModelText(model, 'detail') ?? model.detail;
  const modelTooltip = resolveModelText(model, 'tooltip');

  return {
    id: model.id,
    name: model.name,
    family: model.family,
    version: model.version,
    detail: hasApiKey ? modelDetail : t('auth.apiKeyRequiredDetail'),
    tooltip: hasApiKey ? modelTooltip : t('auth.apiKeyRequiredDetail'),
    maxInputTokens: model.maxInputTokens,
    maxOutputTokens: model.maxOutputTokens,
    isBYOK: true,
    isUserSelectable: true,
    capabilities: {
      toolCalling: model.capabilities.toolCalling,
      imageInput: imageInputOverride ?? model.capabilities.imageInput,
    },
    ...toModelCostInfo(model, pricingCurrency),
    ...(model.capabilities.thinking ? { configurationSchema: buildThinkingEffortSchema() } : {}),
  } as vscode.LanguageModelChatInformation;
}

export function getConfiguredThinkingEffort(
  options: any,
): 'none' | 'high' | 'max' {
  const configuredEffort =
    options.modelConfiguration?.reasoningEffort ?? options.configuration?.reasoningEffort;
  if (configuredEffort === 'none') return 'none';
  if (configuredEffort === 'max') return 'max';
  return 'high'; // default
}

function buildThinkingEffortSchema(): any {
  return {
    properties: {
      reasoningEffort: {
        type: 'string',
        title: t('status.thinking'),
        enum: ['none', 'high', 'max'],
        enumItemLabels: [
          t('thinking.none'),
          t('thinking.high'),
          t('thinking.max'),
        ],
        enumDescriptions: [
          t('thinking.none.desc'),
          t('thinking.high.desc'),
          t('thinking.max.desc'),
        ],
        default: 'high',
        group: 'navigation',
      },
    },
  };
}

function resolveModelText(model: LongCatModel, field: string): string | undefined {
  const suffix = model.id.startsWith('longcat-') ? model.id.slice('longcat-'.length) : model.id;
  const key = `model.${suffix}.${field}`;
  const translated = t(key);
  return translated !== key ? translated : undefined;
}
