import * as vscode from 'vscode';
import { t } from '../i18n';
import { logger } from '../logger';
import { registerActionUrls } from './actions';
import { registerCommands } from './commands';
import { initializeDiagnostics } from './diagnostics';
import { registerProvider } from './provider';
import { showWelcomeIfNeeded } from './welcome';
import { createStatusBar } from '../provider/usage/statusBar';
import { onUsageUpdate } from '../provider/stream';
import type { StatusBarManager } from '../provider/usage/statusBar';

let activeProvider: Awaited<ReturnType<typeof registerProvider>> | undefined;
let statusBar: StatusBarManager | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  await initializeDiagnostics(context);
  registerCommands(context);
  registerActionUrls(context);

  try {
    const provider = await registerProvider(context);
    activeProvider = provider;

    // Initialize status bar for usage tracking
    statusBar = createStatusBar(context);
    context.subscriptions.push({ dispose: () => statusBar?.dispose() });

    // Wire up usage updates to status bar
    onUsageUpdate((acc) => {
      statusBar?.updateUsage(acc);
    });

    // Listen for configuration changes (vision proxy, base URL)
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('longcat-copilot.visionProxy') ||
            e.affectsConfiguration('longcat-copilot.baseUrl')) {
          provider.refreshModelPicker();
        }
      }),
    );

    void showWelcomeIfNeeded(context, provider).catch((error) => {
      logger.warn(t('extension.welcomeFailed'), error);
    });

    logger.info(`LongCat extension activated version=${context.extension.packageJSON.version}`);
  } catch (error) {
    activeProvider = undefined;
    logger.error('Failed to activate LongCat extension', error);
    void vscode.window.showErrorMessage(t('extension.activateFailed'));
    throw error;
  }
}

export async function deactivate(): Promise<void> {
  try {
    await activeProvider?.prepareForDeactivate();
  } catch (error) {
    logger.warn(t('extension.deactivateFailed'), error);
  } finally {
    activeProvider = undefined;
    statusBar?.dispose();
    statusBar = undefined;
    logger.info('LongCat extension deactivated');
    logger.dispose();
  }
}
