import * as vscode from 'vscode';
import { getStoredVisionConfig } from '../vision/config';
import type { AccumulatedUsage } from '../pricing/local-estimator';
import { formatBalanceForStatusBar, formatBalanceTooltip, syncBalanceCache } from '../pricing/balance';

export interface StatusBarManager {
  updateUsage(usage: AccumulatedUsage): void;
  refresh(): void;
  dispose(): void;
}

export function createStatusBar(context: vscode.ExtensionContext): StatusBarManager {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  item.command = 'longcat-copilot.openUsage';
  item.show();

  // Keep last usage snapshot for re-rendering on config/balance changes.
  let lastUsage: AccumulatedUsage = { totalTokens: 0, cachedTokens: 0, uncachedPromptTokens: 0, promptTokens: 0, completionTokens: 0, reasoning_tokens: 0 };

  function render(usage: AccumulatedUsage): void {
    const visionConfig = getStoredVisionConfig(context);
    const visionModelLabel = getVisionModelLabel(visionConfig);
    item.text = formatBalanceForStatusBar(context, usage) + visionModelLabel;
    item.tooltip = formatBalanceTooltip(context, usage);
  }

  // Initial render
  render(lastUsage);

  // Refresh on vision proxy config changes (so label updates immediately).
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('longcat-copilot.visionProxy')) {
        render(lastUsage);
      }
    }),
  );

  function updateUsage(usage: AccumulatedUsage): void {
    lastUsage = usage;
    render(usage);
    void syncBalanceCache(context, usage.totalTokens);
  }

  function refresh(): void {
    render(lastUsage);
  }

  context.subscriptions.push(item);

  // Store for external refresh (e.g. after setManualBalance).
  _currentManager = { updateUsage, refresh, dispose: () => item.dispose() };

  return _currentManager;
}

let _currentManager: StatusBarManager | undefined;

/** Refresh the status bar from outside (e.g. after manual balance change). */
export function refreshStatusBar(): void {
  _currentManager?.refresh();
}

/**
 * Format vision model label as [视觉:modelName].
 */
function getVisionModelLabel(visionConfig: { source?: string; vscodeModelId?: string; endpointModelId?: string }): string {
  if (!visionConfig.source) return '';

  const id = visionConfig.source === 'vscode' ? visionConfig.vscodeModelId : visionConfig.endpointModelId;
  if (!id) return '';

  const short = id
    .replace(/^(github-copilot\/|copilot-)/i, '')
    .replace(/-preview$/i, '')
    .replace(/-\d{4}-\d{2}-\d{2}$/, '');

  return short ? ` $(device-camera) ${short}` : '';
}
