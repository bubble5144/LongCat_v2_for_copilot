import * as vscode from 'vscode';
import { REPLAY_MARKER_MIME, REPLAY_MARKER_WRITER_ID, REPLAY_MARKER_PREFIXES } from './consts';
import type { ReplayMarkerMetadata, ParsedReplayMarker } from './types';

// ── Search ──

/** Find the first replay marker data part in a message. */
export function findFirstReplayMarker(
  message: vscode.LanguageModelChatMessage,
): { partIndex: number; marker: ParsedReplayMarker } | undefined {
  for (const [partIndex, part] of message.content.entries()) {
    const marker = parseReplayMarkerPart(part);
    if (marker) return { partIndex, marker };
  }
  return undefined;
}

/** Shortcut: parse the first replay marker (if any). */
export function parseFirstReplayMarker(
  message: vscode.LanguageModelChatMessage,
): ParsedReplayMarker | undefined {
  return findFirstReplayMarker(message)?.marker;
}

// ── Create ──

/** Check if metadata has any replay-worthy data. */
export function hasReplayMarkerMetadata(metadata: ReplayMarkerMetadata): boolean {
  return Boolean(metadata.visionText || metadata.reasoningText);
}

/** Create a LanguageModelDataPart carrying replay metadata. */
export function createReplayMarkerPart(metadata: ReplayMarkerMetadata): vscode.LanguageModelDataPart {
  const payload = encodeReplayMarkerJson({
    ...createVisionMarkerPayload(metadata.visionText),
    ...createReasoningMarkerPayload(metadata.reasoningText),
  });
  return new vscode.LanguageModelDataPart(
    new TextEncoder().encode(`${REPLAY_MARKER_WRITER_ID}\\${payload}`),
    REPLAY_MARKER_MIME,
  );
}

// ── Parse raw data ──

export function parseReplayMarkerData(data: Uint8Array): ParsedReplayMarker {
  const decoded = new TextDecoder().decode(data);
  const separatorIndex = decoded.indexOf('\\');
  if (separatorIndex < 0) {
    return { valid: false, error: 'marker-prefix-missing' };
  }

  const markerPrefix = decoded.slice(0, separatorIndex);
  if (!REPLAY_MARKER_PREFIXES.has(markerPrefix)) {
    return { valid: false, error: 'marker-prefix-mismatch' };
  }

  const markerPayload = decoded.slice(separatorIndex + 1);
  const decodedPayload = decodeReplayMarkerPayload(markerPayload);
  if (!decodedPayload.valid) {
    return { valid: false, error: decodedPayload.error };
  }

  try {
    const value = JSON.parse(decodedPayload.value);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { valid: false, error: 'marker-payload-not-object' };
    }

    const segmentId = parseOptionalSegmentId(value);
    if (segmentId.error) {
      return { valid: false, error: segmentId.error };
    }

    return {
      valid: true,
      segmentId: segmentId.value,
      visionText: value.visionText as string | undefined,
      visionModelId: value.visionModelId as string | undefined,
      reasoningText: value.reasoningText as string | undefined,
      payloadFormat: decodedPayload.format,
    };
  } catch {
    return { valid: false, error: 'marker-payload-json-parse-error' };
  }
}

// ── Internals ──

function parseReplayMarkerPart(part: unknown): ParsedReplayMarker | undefined {
  if (!(part instanceof vscode.LanguageModelDataPart)) return undefined;
  if ((part as { mimeType?: string }).mimeType !== REPLAY_MARKER_MIME) return undefined;
  return parseReplayMarkerData(part.data);
}

function encodeReplayMarkerJson(obj: Record<string, unknown>): string {
  return JSON.stringify(obj);
}

function decodeReplayMarkerPayload(payload: string): { valid: boolean; error?: string; value: string; format?: string } {
  try {
    return { valid: true, value: payload, format: 'json' };
  } catch {
    return { valid: false, error: 'marker-payload-decode-error', value: '' };
  }
}

function parseOptionalSegmentId(value: Record<string, unknown>): { value?: string; error?: string } {
  const segmentId = value.segmentId;
  if (segmentId === undefined) return { value: undefined };
  if (typeof segmentId === 'string' && segmentId.length > 0) return { value: segmentId };
  return { error: 'marker-segment-id-invalid' };
}

function createVisionMarkerPayload(visionText?: string): Record<string, unknown> {
  return visionText ? { visionText } : {};
}

function createReasoningMarkerPayload(reasoningText?: string): Record<string, unknown> {
  return reasoningText ? { reasoningText } : {};
}
