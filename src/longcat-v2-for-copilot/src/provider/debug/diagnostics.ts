import * as vscode from 'vscode';
import { getDebugLoggingEnabled, getRequestDumpEnabled } from '../../config';
import { getBaseUrl } from '../../config';
import { logger } from '../../logger';
import { isOfficialLongCatBaseUrl } from '../../endpoint';
import type { ConversationSegment } from '../segment';
import type { StreamUsage } from '../../types';

// ── Cache diagnostics recorder ──

export interface CacheDiagnosticsRecorder {
  beginRequest: (input: Record<string, unknown>) => CacheDiagnosticsRun;
}

export interface CacheDiagnosticsRun {
  onUsage: (usage: StreamUsage, charsPerToken: number) => void;
  onCancellationTokenRequested: () => void;
  onReplayMarkerReport: (data: Record<string, unknown>) => void;
  onDone: (data: Record<string, unknown>) => void;
}

export function createCacheDiagnosticsRecorder(): CacheDiagnosticsRecorder {
  return {
    beginRequest: (_input) => ({
      onUsage: () => {},
      onCancellationTokenRequested: () => {},
      onReplayMarkerReport: () => {},
      onDone: () => {},
    }),
  };
}

export function logToolFlowDiagnostics(_data: Record<string, unknown>): void {
  if (getDebugLoggingEnabled()) {
    logger.debug('Tool flow diagnostics', _data);
  }
}

export function observeCancellationToken(
  token: vscode.CancellationToken,
  _diagnosticsRun: CacheDiagnosticsRun,
  onCancellationRequested?: () => void,
): vscode.Disposable {
  return token.onCancellationRequested(() => {
    _diagnosticsRun.onCancellationTokenRequested();
    onCancellationRequested?.();
  });
}

// Minimal snapshot helpers (not used in MVP but needed for interface compatibility)
export function createCacheTraceSnapshot(_messages: vscode.LanguageModelChatMessage[]): unknown {
  return { ts: Date.now() };
}

export function compareCacheTraceSnapshots(_prev: unknown, _next: unknown): unknown {
  return {};
}

export function formatCacheTraceSnapshot(_s: unknown): string { return ''; }
export function formatCacheTraceDetailLines(_s: unknown): string[] { return []; }
export function formatCacheTraceComparison(_c: unknown): string { return ''; }
export function formatCacheTraceKeyChangeComparison(_c: unknown): string { return ''; }
export function formatCacheTraceComparisonDetailLines(_c: unknown): string[] { return []; }
export function getCacheTraceWarnings(_s: unknown): string[] { return []; }
export function getCacheTraceInfoLines(_s: unknown): string[] { return []; }
export function getCacheTraceComparisonWarnings(_c: unknown): string[] { return []; }
