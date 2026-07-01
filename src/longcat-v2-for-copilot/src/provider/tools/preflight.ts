import { createHash } from 'crypto';
import * as vscode from 'vscode';
import { ACTIVATE_TOOL_PREFIX, PREFLIGHT_ACTIVATE_CALL_ID_PREFIX } from './consts';

const PREFLIGHT_TOOL_NAME_HASH_LENGTH = 32;

export interface ActivatePreflightResult {
  rounds: number;
  calledActivatorNames: string[];
  remainingActivatorNames: string[];
}

export function inspectActivatePreflight(
  messages: vscode.LanguageModelChatMessage[],
  tools?: vscode.LanguageModelChatTool[],
): ActivatePreflightResult {
  const activatorNames = collectActivateToolNames(tools);
  const calledActivatorNames = new Set<string>();
  let rounds = 0;
  const latestHumanIdx = findLatestHumanUserMessageIndex(messages);

  for (let i = latestHumanIdx + 1; i < messages.length; i++) {
    for (const part of messages[i].content) {
      const parsed = parsePreflightPart(part);
      if (!parsed) continue;
      rounds = Math.max(rounds, parsed.round);
      if (parsed.toolName?.startsWith(ACTIVATE_TOOL_PREFIX)) {
        calledActivatorNames.add(parsed.toolName);
      }
    }
  }

  return {
    rounds,
    calledActivatorNames: [...calledActivatorNames],
    remainingActivatorNames: activatorNames.filter((n) => !calledActivatorNames.has(n)),
  };
}

export function filterPreflightControlFlow(
  messages: vscode.LanguageModelChatMessage[],
): vscode.LanguageModelChatMessage[] {
  let changed = false;
  const filtered: vscode.LanguageModelChatMessage[] = [];
  for (const message of messages) {
    const hasPreflightPart = message.content.some(isPreflightPart);
    const filteredContent = message.content.filter(
      (part) => !isPreflightPart(part) && !(hasPreflightPart && isEmptyTextPart(part)),
    );
    if (filteredContent.length === message.content.length) {
      filtered.push(message);
    } else {
      changed = true;
      if (filteredContent.length > 0) {
        filtered.push({ ...message, content: filteredContent });
      }
    }
  }
  return changed ? filtered : messages;
}

export function createPreflightToolCallId(round: number, toolName: string): string {
  const hash = createHash('sha256').update(toolName).digest('hex').slice(0, PREFLIGHT_TOOL_NAME_HASH_LENGTH);
  return `${PREFLIGHT_ACTIVATE_CALL_ID_PREFIX}${round}_${hash}`;
}

function collectActivateToolNames(tools?: vscode.LanguageModelChatTool[]): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const tool of tools ?? []) {
    if (!tool.name.startsWith(ACTIVATE_TOOL_PREFIX) || seen.has(tool.name)) continue;
    seen.add(tool.name);
    names.push(tool.name);
  }
  return names;
}

function findLatestHumanUserMessageIndex(messages: vscode.LanguageModelChatMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== vscode.LanguageModelChatMessageRole.User) continue;
    if (messages[i].content.some(isHumanUserMessagePart)) return i;
  }
  return -1;
}

function isHumanUserMessagePart(part: unknown): boolean {
  if (part instanceof vscode.LanguageModelToolResultPart) return false;
  if (part instanceof vscode.LanguageModelTextPart) return part.value.length > 0;
  return true;
}

function parsePreflightPart(part: unknown): { round: number; toolName?: string } | undefined {
  if (part instanceof vscode.LanguageModelToolCallPart) {
    const parsed = parsePreflightToolCallId(part.callId);
    if (!parsed) return undefined;
    return { round: parsed.round, toolName: part.name };
  }
  if (part instanceof vscode.LanguageModelToolResultPart) {
    return parsePreflightToolCallId(part.callId) ?? undefined;
  }
  return undefined;
}

function isPreflightPart(part: unknown): boolean {
  return (
    (part instanceof vscode.LanguageModelToolCallPart || part instanceof vscode.LanguageModelToolResultPart) &&
    part.callId.startsWith(PREFLIGHT_ACTIVATE_CALL_ID_PREFIX)
  );
}

function isEmptyTextPart(part: unknown): boolean {
  return part instanceof vscode.LanguageModelTextPart && part.value.length === 0;
}

function parsePreflightToolCallId(callId: string): { round: number } | undefined {
  if (!callId.startsWith(PREFLIGHT_ACTIVATE_CALL_ID_PREFIX)) return undefined;
  const rest = callId.slice(PREFLIGHT_ACTIVATE_CALL_ID_PREFIX.length);
  const sepIdx = rest.indexOf('_');
  if (sepIdx < 0) return undefined;
  const roundStr = rest.slice(0, sepIdx);
  const round = parseInt(roundStr, 10);
  return isNaN(round) ? undefined : { round };
}
