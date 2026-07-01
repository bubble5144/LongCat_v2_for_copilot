import * as vscode from 'vscode';
import { CONFIG_SECTION } from './consts';

/**
 * Get LongCat API base URL from settings.
 */
export function getBaseUrl(): string {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  return config.get<string>('baseUrl') || 'https://api.longcat.chat';
}

/**
 * Resolve the API model ID to send to the endpoint.
 */
export function getApiModelId(vscodeModelId: string): string {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const overrides = config.get<Record<string, string>>('modelIdOverrides');
  const override = overrides?.[vscodeModelId]?.trim();
  return override || vscodeModelId;
}

/**
 * Get the configured max output tokens limit.
 * Returns `undefined` when set to 0 (API default — no limit).
 */
export function getMaxTokens(): number | undefined {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const value = config.get<number>('maxTokens', 0);
  return value > 0 ? value : undefined;
}

/**
 * Diagnostic mode.
 */
export function getDebugMode(): 'minimal' | 'metadata' | 'verbose' {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const mode = getConfiguredDebugMode(config);
  if (mode) return mode;
  return 'minimal';
}

export function getDebugLoggingEnabled(): boolean {
  return getDebugMode() !== 'minimal';
}

export function getRequestDumpEnabled(): boolean {
  return getDebugMode() === 'verbose';
}

export function getStabilizeToolListEnabled(): boolean {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  return config.get<boolean>('experimental.stabilizeToolList', false);
}

function getConfiguredDebugMode(config: vscode.WorkspaceConfiguration): 'minimal' | 'metadata' | 'verbose' | undefined {
  const mode = config.inspect<string>('debugMode');
  return normalizeDebugMode(mode?.workspaceValue) ?? normalizeDebugMode(mode?.globalValue);
}

function normalizeDebugMode(value: unknown): 'minimal' | 'metadata' | 'verbose' | undefined {
  if (value === 'minimal' || value === 'metadata' || value === 'verbose') {
    return value;
  }
  return undefined;
}
