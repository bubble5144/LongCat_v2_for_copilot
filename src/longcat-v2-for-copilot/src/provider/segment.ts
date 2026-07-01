import { randomUUID } from 'crypto';
import * as vscode from 'vscode';
import { findFirstReplayMarker } from './replay/markers';

export interface ConversationSegment {
  segmentId: string;
  reason: 'markerFound' | 'markerInvalid' | 'markerMissing';
  markerMessageIndex?: number;
  markerPartIndex?: number;
  markerError?: string;
}

export function resolveConversationSegment(messages: vscode.LanguageModelChatMessage[]): ConversationSegment {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex--) {
    const message = messages[messageIndex];
    if (message.role !== vscode.LanguageModelChatMessageRole.Assistant) continue;

    const foundMarker = findFirstReplayMarker(message);
    if (!foundMarker) continue;

    const { marker, partIndex } = foundMarker;
    if (marker.valid && marker.segmentId) {
      return {
        segmentId: marker.segmentId,
        reason: 'markerFound',
        markerMessageIndex: messageIndex,
        markerPartIndex: partIndex,
      };
    }
    if (!marker.valid) {
      return {
        segmentId: randomUUID(),
        reason: 'markerInvalid',
        markerMessageIndex: messageIndex,
        markerPartIndex: partIndex,
        markerError: marker.error ?? 'unknown-marker-error',
      };
    }
  }

  return {
    segmentId: randomUUID(),
    reason: 'markerMissing',
  };
}
