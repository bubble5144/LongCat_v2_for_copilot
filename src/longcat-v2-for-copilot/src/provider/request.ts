import * as vscode from 'vscode';
import { LongCatClient } from '../client';
import { getBaseUrl, getApiModelId, getMaxTokens } from '../config';
import { MODELS } from '../consts';
import { t } from '../i18n';
import type { AuthManager } from '../auth';
import { convertMessages, convertTools, countMessageChars } from './convert';
import { getConfiguredThinkingEffort } from './models';
import { resolveImageMessages } from './vision/resolve';
import type { ConversationSegment } from './segment';
import { resolveConversationSegment } from './segment';
import { classifyProviderRequest, classifyDeepSeekRequest, shouldForceThinkingNone } from './routing/classifier';
import type { CacheDiagnosticsRecorder } from './debug/diagnostics';
import { dumpProviderInput, dumpDeepSeekRequest } from './debug/dump';
import { prepareRequestTools, collectTrailingToolResultIds } from './tools/request';
import { isOfficialLongCatBaseUrl } from '../endpoint';

export interface PrepareChatRequestInput {
  authManager: AuthManager;
  globalStorageUri: vscode.Uri;
  modelInfo: vscode.LanguageModelChatInformation;
  segment: ConversationSegment;
  messages: vscode.LanguageModelChatMessage[];
  options: vscode.LanguageModelChatRequestOptions;
  token: vscode.CancellationToken;
  cacheDiagnostics: CacheDiagnosticsRecorder;
  getVisionDescriber: () => Promise<any>;
}

export interface PreparedChatRequest {
  client: LongCatClient;
  request: Record<string, unknown>;
  isThinkingModel: boolean;
  totalRequestChars: number;
  trailingToolResultIds: string[];
  cacheDiagnostics: ReturnType<CacheDiagnosticsRecorder['beginRequest']>;
  requestKind: string;
  segment: ConversationSegment;
  replayMarkerMetadata: Record<string, unknown>;
  visionMarkerTextChars?: number;
  initialResponseNotice?: string;
}

export async function prepareChatRequest(input: PrepareChatRequestInput): Promise<PreparedChatRequest> {
  const { authManager, globalStorageUri, modelInfo, messages, options, token, cacheDiagnostics, getVisionDescriber } = input;
  let segment = input.segment || resolveConversationSegment(messages);

  const apiKey = await authManager.getApiKey();
  if (!apiKey) {
    throw new Error(t('auth.notConfigured'));
  }

  const baseUrl = getBaseUrl();
  const client = new LongCatClient(baseUrl, apiKey);

  const modelDef = MODELS.find((m) => m.id === modelInfo.id);
  const isThinkingModel = modelDef?.capabilities.thinking ?? false;
  const maxTokens = getMaxTokens();

  // Vision resolution
  const visionResult = await resolveImageMessages(messages, token, getVisionDescriber);
  const resolvedMessages = visionResult.messages;

  // Convert to LongCat format
  const longcatMessages = convertMessages(resolvedMessages, isThinkingModel);
  const tools = prepareRequestTools(modelDef?.capabilities.toolCalling, options);
  const totalRequestChars = countMessageChars(longcatMessages);

  const requestKind = classifyDeepSeekRequest({
    request: { model: getApiModelId(modelInfo.id), messages: longcatMessages, stream: true, tools },
    inputMessages: messages,
  });

  const configuredThinkingEffort = getConfiguredThinkingEffort(options);
  const forceNoneThinking =
    shouldForceThinkingNone(requestKind) && isOfficialLongCatBaseUrl(baseUrl);
  const thinkingEffort = forceNoneThinking ? 'none' : configuredThinkingEffort;

  const baseRequest: Record<string, unknown> = {
    model: getApiModelId(modelInfo.id),
    messages: longcatMessages,
    stream: true,
    tools,
    tool_choice: tools && tools.length > 0 ? 'auto' : undefined,
    max_tokens: maxTokens,
  };

  // Build thinking param (LongCat uses DeepSeek-style: {type: 'enabled'|'disabled'})
  const request: Record<string, unknown> = {
    ...baseRequest,
    ...(isThinkingModel
      ? {
          thinking: {
            type: thinkingEffort === 'none' ? 'disabled' : 'enabled',
          },
        }
      : {}),
  };

  // Diagnostics
  dumpProviderInput({
    globalStorageUri,
    segment,
    modelInfo,
    messages,
    requestOptions: options,
    requestKind,
  });

  dumpDeepSeekRequest(request, {
    globalStorageUri,
    segment,
    requestKind,
    vscodeModelId: modelInfo.id,
    isThinkingModel,
    thinkingEffort,
    maxTokens: maxTokens ?? 0,
    inputMessages: messages,
    resolvedMessages,
    requestOptions: options,
    visionModelId: visionResult.visionModelId,
    visionProxySource: visionResult.visionProxySource,
    visionStats: visionResult.stats,
  });

  const diagnosticsRun = cacheDiagnostics.beginRequest({
    request,
    segment,
    requestKind,
    vscodeModelId: modelInfo.id,
    isThinkingModel,
    thinkingEffort,
    maxTokens: maxTokens ?? 0,
    inputMessages: messages,
    resolvedMessages,
    visionModelId: visionResult.visionModelId,
    visionProxySource: visionResult.visionProxySource,
    visionStats: visionResult.stats,
  });

  return {
    client,
    request,
    isThinkingModel,
    totalRequestChars,
    trailingToolResultIds: collectTrailingToolResultIds(longcatMessages),
    cacheDiagnostics: diagnosticsRun,
    requestKind,
    segment,
    replayMarkerMetadata: visionResult.replayMarkerMetadata,
    visionMarkerTextChars: visionResult.stats.markerVisionTextChars || undefined,
    initialResponseNotice: visionResult.initialResponseNotice,
  };
}
