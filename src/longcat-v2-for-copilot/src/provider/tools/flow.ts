import * as vscode from 'vscode';
import { t } from '../../i18n';
import { MAX_PREFLIGHT_ROUNDS_PER_USER_REQUEST, ACTIVATE_TOOL_PREFIX } from './consts';
import { inspectActivatePreflight, filterPreflightControlFlow, createPreflightToolCallId } from './preflight';
import { filterProviderNotices, createToolDriftNotice } from './notices';

export interface ToolFlowInput {
  stabilizeToolList: boolean;
  messages: vscode.LanguageModelChatMessage[];
  tools?: vscode.LanguageModelChatTool[];
  progress: vscode.Progress<any>;
  requestKind: string;
}

export interface ToolFlowOutput {
  preflightHandled: boolean;
  messages: vscode.LanguageModelChatMessage[];
  initialResponseNotice?: string;
}

export function processToolFlow(input: ToolFlowInput): ToolFlowOutput {
  const { stabilizeToolList, messages, tools, progress, requestKind } = input;

  const filteredMessages = filterProviderNotices(filterPreflightControlFlow(messages));
  const messagesFiltered = filteredMessages !== messages;

  if (!stabilizeToolList) {
    return { preflightHandled: false, messages: filteredMessages };
  }

  const activatePreflight = inspectActivatePreflight(messages, tools);

  if (activatePreflight.remainingActivatorNames.length > 0) {
    if (activatePreflight.rounds >= MAX_PREFLIGHT_ROUNDS_PER_USER_REQUEST) {
      throw new Error(t('request.preflightRoundLimitExceeded', String(MAX_PREFLIGHT_ROUNDS_PER_USER_REQUEST)));
    }
    const nextRound = activatePreflight.rounds + 1;
    for (const toolName of activatePreflight.remainingActivatorNames) {
      progress.report(
        new vscode.LanguageModelToolCallPart(
          createPreflightToolCallId(nextRound, toolName),
          toolName,
          {},
        ),
      );
    }
    return { preflightHandled: true, messages };
  }

  const hasUnexpandedActivateTools =
    activatePreflight.rounds > 0 &&
    tools?.some((tool) => tool.name.startsWith(ACTIVATE_TOOL_PREFIX));

  return {
    preflightHandled: false,
    messages: filteredMessages,
    initialResponseNotice: hasUnexpandedActivateTools ? createToolDriftNotice() : undefined,
  };
}
