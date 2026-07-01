import * as vscode from 'vscode';
import { EXTERNAL_URLS } from '../consts';
import { t } from '../i18n';
import { logger } from '../logger';
import { configureVisionProxy } from '../provider/vision/config';
import { setManualBalance, clearManualBalance, getManualBalance } from '../provider/pricing/balance';
import { refreshStatusBar } from '../provider/usage/statusBar';

export function registerCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    // ---- Authentication ----
    vscode.commands.registerCommand('longcat-copilot.showLogs', () => logger.show()),
    vscode.commands.registerCommand('longcat-copilot.getApiKey', () =>
      vscode.env.openExternal(vscode.Uri.parse(EXTERNAL_URLS.longcat.apiKeys)),
    ),
    vscode.commands.registerCommand('longcat-copilot.openSettings', () =>
      vscode.commands.executeCommand('workbench.action.openSettings', 'longcat-copilot'),
    ),
    // ---- Usage ----
    vscode.commands.registerCommand('longcat-copilot.openUsage', () =>
      vscode.env.openExternal(vscode.Uri.parse(EXTERNAL_URLS.longcat.usage)),
    ),
    // ---- Vision Proxy ----
    vscode.commands.registerCommand('longcat-copilot.setVisionModel', () => configureVisionProxy(context)),
    // ---- Token Plan Balance ----
    vscode.commands.registerCommand('longcat-copilot.setManualBalance', async () => {
      const current = getManualBalance(context);
      const currentWan = current ? (current / 10000).toFixed(1) : undefined;
      const input = await vscode.window.showInputBox({
        title: '设置 Token Plan 余额',
        prompt: '请输入当前 Token Plan 剩余额度（单位：万 tokens，自动四舍五入保留 1 位小数）\n可在 longcat.chat/platform/usage 查看',
        placeHolder: currentWan ? `${currentWan}` : '例如: 500.0',
        ignoreFocusOut: true,
        validateInput: (val) => {
          if (!val?.trim()) return '请输入数值';
          const cleaned = val.replace(/[,\s]/g, '');
          const n = Number(cleaned);
          if (isNaN(n) || n <= 0) return '请输入有效的正数';
          return undefined;
        },
      });
      if (input) {
        const wan = Number(input.replace(/[,\s]/g, ''));
        const roundedWan = Math.round(wan * 10) / 10;
        const tokens = Math.round(roundedWan * 10000);
        await setManualBalance(context, tokens);
        refreshStatusBar();
        vscode.window.showInformationMessage(`Token Plan 余额已设为 ${roundedWan.toFixed(1)} 万（${tokens.toLocaleString()} tokens）`);
      }
    }),
    vscode.commands.registerCommand('longcat-copilot.clearManualBalance', async () => {
      await clearManualBalance(context);
      refreshStatusBar();
      vscode.window.showInformationMessage('Token Plan 余额已清除，恢复为本地估算模式');
    }),
  );
}
