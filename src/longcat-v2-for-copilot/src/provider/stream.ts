import * as vscode from 'vscode';
import { createUserFacingError, type LongCatRequestError } from '../client';
import { logger } from '../logger';
import type { StreamUsage } from '../types';
import type { PreparedChatRequest } from './request';
import { createReplayMarkerPart, hasReplayMarkerMetadata } from './replay/markers';
import type { ReplayMarkerMetadata } from './replay/types';
import type { CacheDiagnosticsRun } from './debug/diagnostics';
import { accumulateUsage, createEmptyUsage } from './pricing/local-estimator';
import { formatRequestLogLine } from './routing/classifier';
import type { AccumulatedUsage } from './pricing/local-estimator';

const COPILOT_USAGE_DATA_PART_MIME = 'usage';

interface StreamState {
  accumulatedReasoning: string;
  emittedToolCallIds: string[];
  initialResponseNoticeReported: boolean;
  replayMarkerReported: boolean;
}

export function streamChatCompletion(
  prepared: PreparedChatRequest,
  progress: vscode.Progress<any>,
  token: vscode.CancellationToken,
  onUsageAccumulated?: (acc: AccumulatedUsage) => void,
): Thenable<void> {
  const state: StreamState = {
    accumulatedReasoning: '',
    emittedToolCallIds: [],
    initialResponseNoticeReported: false,
    replayMarkerReported: false,
  };

  const cancelListener = observeCancellationToken(token, prepared.cacheDiagnostics);

  // Snapshot session before this request to avoid double-counting cumulative usage events.
  const sessionBefore = getCurrentSessionUsage();

  return prepared.client
    .streamChatCompletion(
      prepared.request,
      {
        onContent: (content: string) => {
          reportInitialResponseNoticeOnce(progress, state, prepared.initialResponseNotice);
          progress.report(new vscode.LanguageModelTextPart(content));
        },
        onThinking: (text: string) => {
          reportInitialResponseNoticeOnce(progress, state, prepared.initialResponseNotice);
          state.accumulatedReasoning += text;
          const ThinkingPart = (vscode as any).LanguageModelThinkingPart;
          if (typeof ThinkingPart === 'function') {
            progress.report(new ThinkingPart(text));
          }
        },
        onToolCall: (toolCall) => {
          reportInitialResponseNoticeOnce(progress, state, prepared.initialResponseNotice);
          state.emittedToolCallIds.push(toolCall.id);
          try {
            const args = JSON.parse(toolCall.function.arguments);
            progress.report(
              new vscode.LanguageModelToolCallPart(toolCall.id, toolCall.function.name, args),
            );
          } catch {
            progress.report(
              new vscode.LanguageModelToolCallPart(toolCall.id, toolCall.function.name, {}),
            );
          }
        },
        onError: (error: LongCatRequestError) => {
          throw createUserFacingError(error);
        },
        onDone: () => {
          reportReplayMarkerOnce(prepared, progress, state, 'done');
          finalizeReplayDiagnostics(prepared.trailingToolResultIds, state, prepared.cacheDiagnostics);
        },
        onUsage: (usage: StreamUsage) => {
          // Update chars-per-token (delegated to charsPerToken upstream)
          prepared.cacheDiagnostics.onUsage(usage, 4.0);

          // Report usage to Copilot context
          reportCopilotContextUsage(progress, usage, prepared.requestKind);

          // Usage events from streaming API are cumulative — replace (not add)
          // the request portion so repeated reports don't double-count.
          if (onUsageAccumulated) {
            const reqUsage = accumulateUsage(createEmptyUsage(), usage);
            const acc: AccumulatedUsage = {
              promptTokens: sessionBefore.promptTokens + reqUsage.promptTokens,
              completionTokens: sessionBefore.completionTokens + reqUsage.completionTokens,
              reasoning_tokens: sessionBefore.reasoning_tokens + reqUsage.reasoning_tokens,
              cachedTokens: sessionBefore.cachedTokens + reqUsage.cachedTokens,
              uncachedPromptTokens: sessionBefore.uncachedPromptTokens + reqUsage.uncachedPromptTokens,
              totalTokens: sessionBefore.totalTokens + reqUsage.totalTokens,
              estimatedCostCNY: undefined,
            };
            onUsageAccumulated(acc);
          }
        },
      },
      token,
    )
    .then(undefined, (error) => {
      reportSkippedReplayMarkerIfNeeded(
        prepared,
        state,
        token.isCancellationRequested ? 'cancelled' : 'stream-error',
        error,
      );
      throw error;
    })
    .finally(() => {
      cancelListener.dispose();
    });
}

// ── Internal helpers ──

function reportInitialResponseNoticeOnce(
  progress: vscode.Progress<any>,
  state: StreamState,
  notice?: string,
): void {
  if (!notice || state.initialResponseNoticeReported) return;
  state.initialResponseNoticeReported = true;
  progress.report(new vscode.LanguageModelTextPart(notice));
}

function reportReplayMarkerOnce(
  prepared: PreparedChatRequest,
  progress: vscode.Progress<any>,
  state: StreamState,
  trigger: string,
): void {
  if (state.replayMarkerReported) return;
  state.replayMarkerReported = true;

  const metadata: ReplayMarkerMetadata = {
    ...prepared.replayMarkerMetadata,
    reasoningText: state.accumulatedReasoning || undefined,
  };

  if (!hasReplayMarkerMetadata(metadata)) {
    prepared.cacheDiagnostics.onReplayMarkerReport({
      status: 'skipped',
      trigger,
      reason: 'no-replay-data',
      visionTextChars: prepared.visionMarkerTextChars,
      reasoningTextChars: state.accumulatedReasoning.length || undefined,
    });
    return;
  }

  try {
    const markerPart = createReplayMarkerPart(metadata);
    progress.report(markerPart);
    prepared.cacheDiagnostics.onReplayMarkerReport({
      status: 'reported',
      trigger,
      markerBytes: (markerPart as { data?: Uint8Array }).data?.byteLength,
      visionTextChars: prepared.visionMarkerTextChars,
      reasoningTextChars: state.accumulatedReasoning.length || undefined,
    });
  } catch (error) {
    prepared.cacheDiagnostics.onReplayMarkerReport({
      status: 'failed',
      trigger,
      visionTextChars: prepared.visionMarkerTextChars,
      reasoningTextChars: state.accumulatedReasoning.length || undefined,
      error,
    });
    logger.warn(formatRequestLogLine(prepared.requestKind, 'Failed to report replay marker'), error);
  }
}

function reportSkippedReplayMarkerIfNeeded(
  prepared: PreparedChatRequest,
  state: StreamState,
  reason: string,
  error?: unknown,
): void {
  if (state.replayMarkerReported) return;
  state.replayMarkerReported = true;
  prepared.cacheDiagnostics.onReplayMarkerReport({
    status: 'skipped',
    reason,
    visionTextChars: prepared.visionMarkerTextChars,
    reasoningTextChars: state.accumulatedReasoning.length || undefined,
    error,
  });
}

function finalizeReplayDiagnostics(
  trailingToolResultIds: string[],
  state: StreamState,
  cacheDiagnostics: CacheDiagnosticsRun,
): void {
  cacheDiagnostics.onDone({
    reasoningTextChars: state.accumulatedReasoning.length,
    emittedToolCalls: state.emittedToolCallIds.length,
    trailingToolResults: trailingToolResultIds.length,
  });
}

function reportCopilotContextUsage(
  progress: vscode.Progress<any>,
  usage: StreamUsage,
  requestKind: string,
): void {
  const data = {
    prompt_tokens: usage.prompt_tokens,
    completion_tokens: usage.completion_tokens,
    total_tokens: usage.total_tokens,
    prompt_tokens_details: {
      cached_tokens: usage.prompt_tokens_details?.cached_tokens
        ?? usage.prompt_cache_hit_tokens
        ?? 0,
    },
  };
  try {
    progress.report(
      new vscode.LanguageModelDataPart(
        new TextEncoder().encode(JSON.stringify(data)),
        COPILOT_USAGE_DATA_PART_MIME,
      ),
    );
  } catch (error) {
    logger.warn(
      formatRequestLogLine(requestKind, 'Failed to report usage data'),
      error,
    );
  }
}

function observeCancellationToken(
  token: vscode.CancellationToken,
  diagnosticsRun: CacheDiagnosticsRun,
): vscode.Disposable {
  return token.onCancellationRequested(() => {
    diagnosticsRun.onCancellationTokenRequested();
  });
}

// ── Session usage local state ──

let _currentSessionUsage: AccumulatedUsage = {
  promptTokens: 0,
  completionTokens: 0,
  reasoning_tokens: 0,
  cachedTokens: 0,
  uncachedPromptTokens: 0,
  totalTokens: 0,
};

let _onUsageCallbacks: Array<(acc: AccumulatedUsage) => void> = [];

export function getCurrentSessionUsage(): AccumulatedUsage {
  return _currentSessionUsage;
}

export function setCurrentSessionUsage(acc: AccumulatedUsage): void {
  _currentSessionUsage = acc;
  // Store globally for status bar access
  (global as any).__longcatSessionUsage = acc;
  for (const cb of _onUsageCallbacks) {
    cb(acc);
  }
}

export function onUsageUpdate(cb: (acc: AccumulatedUsage) => void): void {
  _onUsageCallbacks.push(cb);
}

export function resetSessionUsage(): void {
  _currentSessionUsage = {
    promptTokens: 0,
    completionTokens: 0,
    reasoning_tokens: 0,
    cachedTokens: 0,
    uncachedPromptTokens: 0,
    totalTokens: 0,
  };
}
