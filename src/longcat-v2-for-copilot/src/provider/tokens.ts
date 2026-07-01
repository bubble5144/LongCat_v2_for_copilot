import * as vscode from 'vscode';
import { REPLAY_MARKER_MIME } from './replay/consts';

const IMAGE_PART_ESTIMATED_CHARS = 1020;

/**
 * Recursively estimate the character count for a single content part.
 * Returns character count, which the caller divides by charsPerToken to get token estimate.
 */
function estimatePartChars(part: unknown): number {
  // 1. LanguageModelTextPart — the most common case
  if (part instanceof vscode.LanguageModelTextPart) {
    return part.value.length;
  }

  // 2. LanguageModelToolCallPart — count callId + name + JSON-serialized input
  if (part instanceof vscode.LanguageModelToolCallPart) {
    let chars = part.callId.length + part.name.length;
    try {
      chars += JSON.stringify(part.input).length;
    } catch {
      chars += 2;
    }
    return chars;
  }

  // 3. LanguageModelToolResultPart — recursively count nested content parts
  if (part instanceof vscode.LanguageModelToolResultPart) {
    let chars = part.callId.length;
    if (Array.isArray(part.content)) {
      for (const item of part.content) {
        chars += estimatePartChars(item);
      }
    }
    return chars;
  }

  // 4. LanguageModelDataPart
  if (part instanceof vscode.LanguageModelDataPart) {
    const mime = (part as { mimeType?: string }).mimeType;
    if (mime === REPLAY_MARKER_MIME) {
      return 0;
    }
    if (mime?.startsWith('image/')) {
      return IMAGE_PART_ESTIMATED_CHARS;
    }
    return Math.min(part.data?.byteLength ?? 0, 10000);
  }

  // 5. LanguageModelThinkingPart (proposed API) — handle string | string[]
  if (isLanguageModelThinkingPart(part)) {
    if (typeof part.value === 'string') return part.value.length;
    if (Array.isArray(part.value)) {
      let chars = 0;
      for (const s of part.value) chars += s.length;
      return chars;
    }
    return 0;
  }

  // 6. LanguageModelPromptTsxPart
  const partObj = part as Record<string, unknown> | null;
  if (partObj && typeof partObj === 'object' && 'value' in partObj &&
      partObj.constructor?.name === 'LanguageModelPromptTsxPart') {
    try {
      return JSON.stringify(partObj.value).length;
    } catch {
      return 0;
    }
  }

  // Fallback
  if (part && typeof part === 'object') {
    try {
      return JSON.stringify(part).length;
    } catch {
      return 0;
    }
  }

  return 0;
}

function isLanguageModelThinkingPart(part: unknown): part is { value: string | string[] } {
  const ThinkingPart = (vscode as any).LanguageModelThinkingPart;
  return (
    typeof ThinkingPart === 'function' &&
    part instanceof ThinkingPart
  );
}

/**
 * Estimate token count for a message using chars-per-token ratio.
 */
export function estimateTokenCount(
  text: string | vscode.LanguageModelChatMessage,
  charsPerToken: number,
  _token?: vscode.CancellationToken,
): number {
  if (typeof text !== 'string') {
    let totalChars = 0;
    for (const part of text.content) {
      totalChars += estimatePartChars(part);
    }
    return Math.ceil(totalChars / (charsPerToken || 4.0));
  }
  return Math.ceil(text.length / (charsPerToken || 4.0));
}
