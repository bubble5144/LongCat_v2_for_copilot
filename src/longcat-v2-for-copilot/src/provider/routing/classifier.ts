import * as vscode from 'vscode';

// ── Copilot Chat system prompt prefixes (same for all LLM providers) ──

const TODO_TRACKER_PREFIX = 'You are a background task tracker';
const PROMPT_CATEGORIZER_PREFIX = 'You are an expert classifier for AI coding assistant prompts';
const SETTINGS_RESOLVER_PREFIX = 'You are a Visual Studio Code assistant. Your job is to assist users in using Visual Studio Code by returning settings';
const CHAT_TITLE_PREFIXES = [
  'You are an expert in crafting ultra-compact titles',
  'You are an expert in crafting pithy titles',
];
const INLINE_PROGRESS_MESSAGE_PREFIX = 'You are an expert in writing short, catchy, and encouraging progress messages';
const GIT_BRANCH_NAME_PREFIX = 'You are an expert in crafting pithy branch names';
const GIT_COMMIT_MESSAGE_PREFIX = 'You are an AI programming assistant, helping a software developer to come with the best git commit message';
const RENAME_SUGGESTIONS_PREFIX = 'You are a distinguished software engineer';
const MAIN_AGENT_PREFIX = 'You are an expert AI programming assistant';
const TERMINAL_NOTIFICATION_PATTERN = /^\[Terminal\s+\S+\s+notification:/;

const REQUEST_KINDS_WITH_FORCED_NONE_THINKING = new Set([
  'todo-tracker',
  'prompt-categorizer',
  'settings-resolver',
  'chat-title',
  'inline-progress-message',
  'git-branch-name',
  'git-commit-message',
  'rename-suggestions',
]);

// ── Classification ──

export interface ClassificationInput {
  firstText: string;
  latestUserText: string;
  toolNames: string[];
}

export function classifyProviderRequest(input: { messages: vscode.LanguageModelChatMessage[]; tools?: vscode.LanguageModelChatTool[] }): string {
  return classifyRequest({
    firstText: getFirstVscodeText(input.messages),
    latestUserText: getLatestVscodeUserText(input.messages),
    toolNames: input.tools?.map((tool) => tool.name) ?? [],
  });
}

export function classifyDeepSeekRequest(input: {
  request: { model: string; messages: Array<Record<string, unknown>>; stream?: boolean; tools?: Array<Record<string, unknown>> };
  inputMessages: vscode.LanguageModelChatMessage[];
}): string {
  return classifyRequest({
    firstText:
      (input.request.messages[0]?.content as string) ?? getFirstVscodeText(input.inputMessages),
    latestUserText:
      getLatestVscodeUserText(input.inputMessages) || getLatestDeepSeekUserText(input.request),
    toolNames: input.request.tools?.map(getDeepSeekToolName) ?? [],
  });
}

function classifyRequest(input: ClassificationInput): string {
  const firstText = input.firstText.trimStart();
  const latestUserText = input.latestUserText.trimStart();

  if (TERMINAL_NOTIFICATION_PATTERN.test(latestUserText)) return 'terminal-steering';

  if (isOnlyTool(input.toolNames, 'manage_todo_list') || firstText.startsWith(TODO_TRACKER_PREFIX))
    return 'todo-tracker';

  if (isOnlyTool(input.toolNames, 'categorize_prompt') || firstText.startsWith(PROMPT_CATEGORIZER_PREFIX))
    return 'prompt-categorizer';

  if (firstText.startsWith(SETTINGS_RESOLVER_PREFIX)) return 'settings-resolver';
  if (startsWithAny(firstText, CHAT_TITLE_PREFIXES)) return 'chat-title';
  if (firstText.startsWith(INLINE_PROGRESS_MESSAGE_PREFIX)) return 'inline-progress-message';
  if (firstText.startsWith(GIT_BRANCH_NAME_PREFIX)) return 'git-branch-name';
  if (firstText.startsWith(GIT_COMMIT_MESSAGE_PREFIX)) return 'git-commit-message';
  if (firstText.startsWith(RENAME_SUGGESTIONS_PREFIX)) return 'rename-suggestions';

  if (firstText.startsWith(MAIN_AGENT_PREFIX) || firstText.includes('<skills>') || firstText.includes('<agents>'))
    return 'main-agent';

  if (input.toolNames.length > 0 || firstText.length > 0) return 'background';
  return 'empty';
}

export function shouldForceThinkingNone(requestKind: string): boolean {
  return REQUEST_KINDS_WITH_FORCED_NONE_THINKING.has(requestKind);
}

// ── Formatting ──

export function formatModelFields(vscodeModelId: string, apiModelId?: string): string {
  const apiField = apiModelId && apiModelId !== vscodeModelId ? ` apiModel=${apiModelId}` : '';
  return `model=${vscodeModelId}${apiField}`;
}

export function formatRequestLogLine(requestKind: string, message: string): string {
  return `[${requestKind}] ${message}`;
}

// ── Helpers ──

function isOnlyTool(toolNames: string[], name: string): boolean {
  return toolNames.length === 1 && toolNames[0] === name;
}

function startsWithAny(text: string, prefixes: string[]): boolean {
  return prefixes.some((p) => text.startsWith(p));
}

function getFirstVscodeText(messages: vscode.LanguageModelChatMessage[]): string {
  for (const msg of messages) {
    for (const part of msg.content) {
      if (part instanceof vscode.LanguageModelTextPart && part.value.trim()) {
        return part.value;
      }
    }
  }
  return '';
}

function getLatestVscodeUserText(messages: vscode.LanguageModelChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== vscode.LanguageModelChatMessageRole.User) continue;
    for (const part of messages[i].content) {
      if (part instanceof vscode.LanguageModelTextPart && part.value.trim()) {
        return part.value;
      }
    }
  }
  return '';
}

function getLatestDeepSeekUserText(request: { messages: Array<Record<string, unknown>> }): string {
  for (let i = request.messages.length - 1; i >= 0; i--) {
    if (request.messages[i].role === 'user') {
      return (request.messages[i].content as string) ?? '';
    }
  }
  return '';
}

function getDeepSeekToolName(tool: Record<string, unknown>): string {
  const func = tool.function as Record<string, unknown> | undefined;
  return (func?.name as string) ?? '';
}
