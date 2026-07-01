import { convertTools } from '../convert';
import { t } from '../../i18n';
import { LONGCAT_TOOLS_LIMIT } from './consts';
import type * as vscode from 'vscode';

function getToolCallingLimit(toolCallingCapability: number | boolean): number {
  return typeof toolCallingCapability === 'number' ? toolCallingCapability : LONGCAT_TOOLS_LIMIT;
}

export function prepareRequestTools(
  toolCallingCapability?: number | boolean,
  options?: vscode.LanguageModelChatRequestOptions,
): Record<string, unknown>[] | undefined {
  const tools = toolCallingCapability ? convertTools(options?.tools) : undefined;
  const toolLimit = getToolCallingLimit(toolCallingCapability ?? LONGCAT_TOOLS_LIMIT);
  const toolsCount = tools?.length ?? 0;
  if (toolsCount > toolLimit) {
    throw new Error(t('request.toolsLimitExceeded', String(toolLimit), String(toolsCount)));
  }
  return tools;
}

export function collectTrailingToolResultIds(messages: Array<Record<string, unknown>>): string[] {
  const ids: string[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== 'tool' || !messages[i].tool_call_id) break;
    ids.push(messages[i].tool_call_id as string);
  }
  return ids.reverse();
}
