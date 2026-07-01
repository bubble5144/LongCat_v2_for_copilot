import * as vscode from 'vscode';
import { safeStringify } from '../json';
import { parseFirstReplayMarker } from './replay/markers';

// ── Message conversion ──

/**
 * Convert VS Code chat messages to LongCat (OpenAI-compatible) format.
 * Injects marker-replayed reasoning_content for assistant messages.
 */
export function convertMessages(
  messages: vscode.LanguageModelChatMessage[],
  isThinkingModel: boolean,
): Array<Record<string, unknown>> {
  const result: Array<Record<string, unknown>> = [];

  for (const message of messages) {
    const role = mapRole(message.role);
    let content = '';
    let thinkingContent = '';
    const toolCalls: Array<Record<string, unknown>> = [];
    const toolResults: Array<{ callId: string; content: string }> = [];

    for (const part of message.content) {
      if (part instanceof vscode.LanguageModelTextPart) {
        content += part.value;
      } else if (isLanguageModelThinkingPart(part)) {
        thinkingContent += normalizeThinkingPartText(part.value);
      } else if (part instanceof vscode.LanguageModelToolCallPart) {
        toolCalls.push({
          id: part.callId,
          type: 'function',
          function: {
            name: part.name,
            arguments: safeStringify(part.input),
          },
        });
      } else if (part instanceof vscode.LanguageModelToolResultPart) {
        let toolContent = '';
        for (const item of part.content) {
          if (item instanceof vscode.LanguageModelTextPart) {
            toolContent += item.value;
          }
        }
        toolResults.push({
          callId: part.callId,
          content: toolContent || safeStringify(part.content),
        });
      }
    }

    if (role === 'assistant') {
      if (content || toolCalls.length > 0) {
        const replayMarker = isThinkingModel ? parseFirstReplayMarker(message) : undefined;
        const msg: Record<string, unknown> = {
          role: 'assistant',
          content: content || '',
        };
        if (toolCalls.length > 0) {
          msg.tool_calls = toolCalls;
        }
        if (isThinkingModel) {
          msg.reasoning_content = getReasoningContent(replayMarker, thinkingContent);
        }
        result.push(msg);
      }
    } else {
      if (content) {
        result.push({ role, content });
      }
    }

    // Tool result messages follow their associated assistant message
    for (const tr of toolResults) {
      result.push({
        role: 'tool',
        content: tr.content,
        tool_call_id: tr.callId,
      });
    }
  }

  return result;
}

function getReasoningContent(
  replayMarker: ReturnType<typeof parseFirstReplayMarker>,
  thinkingContent: string,
): string {
  if (replayMarker?.valid && replayMarker.reasoningText) {
    return replayMarker.reasoningText;
  }
  return thinkingContent;
}

// ── Tool conversion ──

/** Convert VS Code tool definitions to LongCat (OpenAI-compatible) format. */
export function convertTools(tools?: vscode.LanguageModelChatTool[]): Record<string, unknown>[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }));
}

// ── Character counting ──

/** Count total characters across all converted messages. */
export function countMessageChars(messages: Array<Record<string, unknown>>): number {
  let total = 0;
  for (const msg of messages) {
    total += (msg.content as string)?.length ?? 0;
    total += (msg.reasoning_content as string)?.length ?? 0;
    const toolCalls = msg.tool_calls as Array<Record<string, unknown>> | undefined;
    if (toolCalls) {
      for (const tc of toolCalls) {
        const func = tc.function as Record<string, unknown> | undefined;
        total += (func?.name as string)?.length ?? 0;
        total += (func?.arguments as string)?.length ?? 0;
      }
    }
  }
  return total;
}

// ── Helpers ──

function mapRole(role: vscode.LanguageModelChatMessageRole): string {
  switch (role) {
    case vscode.LanguageModelChatMessageRole.User:
      return 'user';
    case vscode.LanguageModelChatMessageRole.Assistant:
      return 'assistant';
    default:
      return 'user';
  }
}

function isLanguageModelThinkingPart(part: unknown): part is { value: string | string[] } {
  const ThinkingPart = (vscode as any).LanguageModelThinkingPart;
  return (
    typeof ThinkingPart === 'function' &&
    part instanceof ThinkingPart
  );
}

function normalizeThinkingPartText(value: string | string[]): string {
  return Array.isArray(value) ? value.join('') : value;
}
