import * as vscode from 'vscode';
import { WELCOME_SHOWN_KEY, WALKTHROUGH_ID } from '../consts';
import type { LongCatChatProvider } from '../provider';

export async function showWelcomeIfNeeded(
  context: vscode.ExtensionContext,
  provider: LongCatChatProvider,
): Promise<void> {
  if (context.globalState.get(WELCOME_SHOWN_KEY)) return;

  if (await provider.hasApiKey()) {
    await context.globalState.update(WELCOME_SHOWN_KEY, true);
    return;
  }

  await vscode.commands.executeCommand('workbench.action.openWalkthrough', WALKTHROUGH_ID, false);
  await context.globalState.update(WELCOME_SHOWN_KEY, true);
}
