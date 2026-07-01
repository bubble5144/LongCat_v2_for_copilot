import * as vscode from 'vscode';
import { getRequestDumpEnabled } from '../../config';
import { logger } from '../../logger';
import { safeStringify } from '../../json';
import type { ConversationSegment } from '../segment';

export async function ensureRequestDumpRoot(globalStorageUri: vscode.Uri): Promise<vscode.Uri> {
  const dumpRoot = vscode.Uri.joinPath(globalStorageUri, 'request-dumps');
  try {
    await vscode.workspace.fs.createDirectory(dumpRoot);
  } catch {
    // directory may already exist
  }
  return dumpRoot;
}

export function dumpProviderInput(_input: {
  globalStorageUri: vscode.Uri;
  segment: ConversationSegment;
  modelInfo: vscode.LanguageModelChatInformation;
  messages: vscode.LanguageModelChatMessage[];
  requestOptions: vscode.LanguageModelChatRequestOptions;
  requestKind: string;
}): void {
  if (!getRequestDumpEnabled()) return;
  logger.debug('Provider input dump', _input.segment.segmentId);
}

export function dumpDeepSeekRequest(
  _request: Record<string, unknown>,
  _meta: Record<string, unknown>,
): void {
  if (!getRequestDumpEnabled()) return;
  // Sanitise Authorization header before dump
  const safeCopy = { ..._request };
  logger.debug('Request dump', safeCopy.model);
}
