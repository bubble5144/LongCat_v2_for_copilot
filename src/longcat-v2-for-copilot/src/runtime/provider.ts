import * as vscode from 'vscode';
import { logger } from '../logger';
import { LongCatChatProvider } from '../provider';

export async function registerProvider(context: vscode.ExtensionContext): Promise<LongCatChatProvider> {
  const provider = new LongCatChatProvider(context);

  context.subscriptions.push(
    vscode.commands.registerCommand('longcat-copilot.setApiKey', () => provider.configureApiKey()),
    vscode.commands.registerCommand('longcat-copilot.clearApiKey', () => provider.clearApiKey()),
    vscode.lm.registerLanguageModelChatProvider('longcat', provider),
  );

  // Activate Copilot Chat so model picker refresh reaches a live listener
  await activateCopilotChat();
  provider.refreshModelPicker();

  return provider;
}

async function activateCopilotChat(): Promise<void> {
  try {
    await vscode.extensions.getExtension('github.copilot-chat')?.activate();
  } catch (error) {
    logger.warn('Copilot Chat activation unavailable; model picker refresh may be delayed', error);
  }
}
