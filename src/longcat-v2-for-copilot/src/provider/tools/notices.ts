import * as vscode from 'vscode';
import { t } from '../../i18n';
import {
  TOOL_DRIFT_NOTICE_START, TOOL_DRIFT_NOTICE_END,
  VISION_PROXY_NOTICE_START, VISION_PROXY_NOTICE_END,
} from './consts';

let visionProxyConfigurationUrl = 'command:longcat-copilot.setVisionModel';
let showLogsUrl = 'command:longcat-copilot.showLogs';

export function setVisionProxyConfigurationUrl(url: string): void { visionProxyConfigurationUrl = url; }
export function setProviderNoticeShowLogsUrl(url: string): void { showLogsUrl = url; }

export function createToolDriftNotice(): string {
  return ['', TOOL_DRIFT_NOTICE_START, '', createBlockquote(t('notice.toolDrift')), '', TOOL_DRIFT_NOTICE_END, ''].join('\n');
}

export function createVisionProxyMissingNotice(): string {
  return ['', VISION_PROXY_NOTICE_START, '', createBlockquote(t('notice.visionProxyMissing', visionProxyConfigurationUrl)), '', VISION_PROXY_NOTICE_END, ''].join('\n');
}

export function createVisionProxyFailureNotice(errorCode: string, errorMessage: string): string {
  return ['', VISION_PROXY_NOTICE_START, '', createBlockquote(t('notice.visionProxyFailure', `${errorCode}: ${errorMessage}`, visionProxyConfigurationUrl, showLogsUrl)), '', VISION_PROXY_NOTICE_END, ''].join('\n');
}

export function filterProviderNotices(messages: vscode.LanguageModelChatMessage[]): vscode.LanguageModelChatMessage[] {
  let changed = false;
  const filtered: vscode.LanguageModelChatMessage[] = [];
  for (const message of messages) {
    if (message.role !== vscode.LanguageModelChatMessageRole.Assistant) {
      filtered.push(message);
      continue;
    }
    let messageChanged = false;
    const filteredContent: any[] = [];
    for (const part of message.content) {
      if (!(part instanceof vscode.LanguageModelTextPart)) {
        filteredContent.push(part);
        continue;
      }
      const stripped = stripProviderNotices(part.value);
      if (stripped === part.value) {
        filteredContent.push(part);
      } else {
        changed = true;
        messageChanged = true;
        if (stripped.length > 0) {
          filteredContent.push(new vscode.LanguageModelTextPart(stripped));
        }
      }
    }
    if (!messageChanged) {
      filtered.push(message);
    } else if (filteredContent.length > 0) {
      filtered.push({ ...message, content: filteredContent });
    }
  }
  return changed ? filtered : messages;
}

function stripProviderNotices(value: string): string {
  let result = value;
  for (const marker of [
    { start: TOOL_DRIFT_NOTICE_START, end: TOOL_DRIFT_NOTICE_END },
    { start: VISION_PROXY_NOTICE_START, end: VISION_PROXY_NOTICE_END },
  ]) {
    const startIdx = result.indexOf(marker.start);
    if (startIdx < 0) continue;
    const endIdx = result.indexOf(marker.end, startIdx + marker.start.length);
    if (endIdx < 0) continue;
    result = (result.slice(0, startIdx) + result.slice(endIdx + marker.end.length)).trim();
  }
  return result;
}

function createBlockquote(text: string): string {
  return text
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
}
