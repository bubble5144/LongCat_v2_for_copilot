import * as vscode from 'vscode';
import { t } from '../../i18n';
import { getStoredVisionConfig } from '../vision/config';
import type { AccumulatedUsage } from '../pricing/local-estimator';

export class UsagePanel {
  public static current: UsagePanel | undefined;
  private static readonly viewType = 'longcatUsage';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _context: vscode.ExtensionContext;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(context: vscode.ExtensionContext, usage: AccumulatedUsage): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (UsagePanel.current) {
      UsagePanel.current._panel.reveal(column);
      UsagePanel.current._update(usage);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      UsagePanel.viewType,
      t('usage.panelTitle'),
      column || vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true },
    );

    UsagePanel.current = new UsagePanel(panel, context, usage);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
    usage: AccumulatedUsage,
  ) {
    this._panel = panel;
    this._context = context;

    this._update(usage);

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.type) {
          case 'refresh':
            return;
          case 'openUrl':
            vscode.env.openExternal(vscode.Uri.parse(message.url));
            return;
          case 'configureVision':
            vscode.commands.executeCommand('longcat-copilot.setVisionModel');
            return;
        }
      },
      null,
      this._disposables,
    );
  }

  public dispose(): void {
    UsagePanel.current = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) x.dispose();
    }
  }

  private _update(usage: AccumulatedUsage): void {
    const visionConfig = getStoredVisionConfig(this._context);
    this._panel.webview.html = this._getHtml(usage, visionConfig);
  }

  private _getHtml(usage: AccumulatedUsage, visionConfig: { source?: string; vscodeModelId?: string; endpointModelId?: string }): string {
    const visionStatus = visionConfig.source
      ? `✅ ${visionConfig.source === 'vscode' ? visionConfig.vscodeModelId : visionConfig.endpointModelId}`
      : '⚠️ 未配置';

    const totalTokens = formatTokens(usage.totalTokens);
    const promptTokens = formatTokens(usage.promptTokens);
    const completionTokens = formatTokens(usage.completionTokens);
    const reasoningTokens = usage.reasoning_tokens > 0 ? formatTokens(usage.reasoning_tokens) : null;

    return /* html */ `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
body { font-family: var(--vscode-font-family); color: var(--vscode-editor-foreground); padding: 20px; }
.container { max-width: 680px; margin: 0 auto; }
.card { background: var(--vscode-textBlockQuote-background, rgba(127,127,127,.1)); border-radius: 8px; padding: 16px 20px; margin-bottom: 16px; }
.bal-num { font-size: 32px; font-weight: 700; }
.bal-sub { margin-top: 8px; display: flex; gap: 20px; flex-wrap: wrap; font-size: 13px; color: var(--vscode-descriptionForeground); }
.btn { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 13px; }
.btn:hover { background: var(--vscode-button-hoverBackground); }
.link { color: var(--vscode-textLink-foreground); cursor: pointer; text-decoration: underline; }
</style>
</head>
<body>
<div class="container">
  <div class="card">
    <div class="bal-num">${totalTokens} tokens</div>
    <div class="bal-sub">
      <span>Prompt: ${promptTokens}</span>
      <span>Completion: ${completionTokens}</span>
      ${reasoningTokens ? `<span>推理: ${reasoningTokens}</span>` : ''}
    </div>
  </div>

  <div class="card">
    <h3>视觉代理</h3>
    <p style="font-size: 13px; color: var(--vscode-descriptionForeground);">
      状态: ${visionStatus}
    </p>
    <button class="btn" onclick="configureVision()">配置视觉代理</button>
    <p style="font-size: 12px; color: var(--vscode-descriptionForeground); margin-top: 10px;">
      LongCat 不支持原生图片输入。图片将由配置的视觉模型转换为文字描述。
    </p>
  </div>

  <div class="card">
    <h3>定价 (每 1M tokens)</h3>
    <table style="width: 100%; font-size: 12px;">
      <tr><td>输入 (缓存)</td><td style="text-align: right;">¥0.04</td></tr>
      <tr><td>输入</td><td style="text-align: right;">¥2.00</td></tr>
      <tr><td>输出</td><td style="text-align: right;">¥8.00</td></tr>
    </table>
    <p style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-top: 10px;">
      💡 LongCat 以 Token 为计价单位。以上价格为参考。
    </p>
  </div>
</div>
<script>
function configureVision() { vscode.postMessage({ type: 'configureVision' }); }
const vscode = acquireVsCodeApi();
</script>
</body>
</html>`;
  }
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n.toLocaleString()}`;
}
