import * as vscode from 'vscode';

export interface UsagePanel {
  dispose(): void;
}

const VIEW_TYPE = 'longcatUsage';
const USAGE_URL = 'https://longcat.chat/platform/usage';

export class UsageWebview implements UsagePanel {
  public static current: UsagePanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _disposables: vscode.Disposable[] = [];
  private _lastBalance: number | null = null;
  private _lastUsed: number | null = null;
  private _lastTotal: number | null = null;

  public static createOrShow(context: vscode.ExtensionContext): UsagePanel {
    if (UsageWebview.current) {
      (UsageWebview.current as any)._panel.reveal();
      return UsageWebview.current;
    }

    const panel = vscode.window.createWebviewPanel(
      VIEW_TYPE,
      'LongCat Usage',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    UsageWebview.current = new UsageWebview(panel);
    return UsageWebview.current;
  }

  private constructor(panel: vscode.WebviewPanel) {
    this._panel = panel;

    this._update();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      (message) => this._onMessage(message),
      null,
      this._disposables,
    );
  }

  public dispose(): void {
    UsageWebview.current = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) x.dispose();
    }
  }

  private _onMessage(message: { type: string; data?: unknown }): void {
    switch (message.type) {
      case 'balanceUpdate':
        this._handleBalanceUpdate(message.data as { remaining?: number; used?: number; total?: number });
        return;
      case 'loginRequired':
        vscode.window.showInformationMessage('请在 webview 中登录 LongCat 账号');
        return;
    }
  }

  private _handleBalanceUpdate(data: { remaining?: number; used?: number; total?: number }): void {
    this._lastRemaining = data.remaining ?? null;
    this._lastUsed = data.used ?? null;
    this._lastTotal = data.total ?? null;

    if (this._lastRemaining !== null) {
      vscode.window.showInformationMessage(
        `Token Plan 余额已更新: ${(this._lastRemaining / 1_000_000).toFixed(2)}M tokens`,
      );
    }
  }

  private _lastRemaining: number | null = null;

  private _update(): void {
    this._panel.webview.html = this._getHtml();
  }

  private _getHtml(): string {
    const lastUpdate = new Date().toLocaleTimeString('zh-CN');

    return /* html */ `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
body { font-family: var(--vscode-font-family); padding: 0; margin: 0; height: 100vh; display: flex; flex-direction: column; }
.toolbar { background: var(--vscode-toolbar-background); padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--vscode-border); }
.toolbar h3 { margin: 0; font-size: 13px; }
.toolbar .status { font-size: 11px; color: var(--vscode-descriptionForeground); }
.container { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
iframe { flex: 1; border: none; width: 100%; }
.info-bar { background: var(--vscode-editor-background); padding: 8px 12px; border-top: 1px solid var(--vscode-border); font-size: 12px; }
.info-bar code { background: var(--vscode-textCodeBlock-background); padding: 2px 6px; border-radius: 3px; }
</style>
</head>
<body>
<div class="toolbar">
  <h3>LongCat Token Plan</h3>
  <span class="status">最后抓取: ${lastUpdate}</span>
</div>
<div class="container">
  <iframe src="${USAGE_URL}" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
</div>
<div class="info-bar">
  💡 <strong>已登录？</strong>余额会通过 JavaScript 抓取并显示在状态栏。
  &nbsp;·&nbsp;
  <code>longcat-copilot.openUsageExternal</code> 打开外部浏览器（已登录更稳定）
</div>
<script>
const vscode = acquireVsCodeApi();
const iframe = document.querySelector('iframe');

function tryExtractBalance() {
  try {
    if (!iframe || !iframe.contentDocument) return;
    const doc = iframe.contentDocument;
    const body = doc.body;
    if (!body) return;

    // 检测是否已登录
    const isLoginPage = body.innerText.includes('登录') || body.innerText.includes('login');
    if (isLoginPage && !body.innerText.match(/\\d/)) {
      vscode.postMessage({ type: 'loginRequired' });
      return;
    }

    // 尝试从页面抓取数字 — 多种选择器适配
    const extractors = [
      // Token 数字通常带千分位或 M/K
      () => {
        const re = /(\\d+(?:[.,]\\d+)?)\\s*([KkMm])\\b/g;
        const text = body.innerText;
        const matches = [...text.matchAll(re)];
        return matches.map(m => {
          const num = parseFloat(m[1].replace(',', '.'));
          const unit = m[2].toLowerCase();
          return num * (unit === 'm' ? 1_000_000 : 1_000);
        });
      },
    ];

    let tokens = [];
    for (const fn of extractors) {
      try { tokens = fn(); if (tokens.length > 0) break; } catch (e) {}
    }

    if (tokens.length >= 1) {
      // 假设第一个或两个最大的数字是余额
      tokens.sort((a, b) => b - a);
      vscode.postMessage({
        type: 'balanceUpdate',
        data: {
          remaining: tokens[0],
          used: tokens[1] ?? undefined,
          total: tokens[1] !== undefined ? tokens[0] + tokens[1] : undefined,
        },
      });
    }
  } catch (e) {
    // 跨域限制 — 忽略
  }
}

// 等待 iframe 加载后尝试抓取
if (iframe) {
  iframe.addEventListener('load', () => {
    setTimeout(tryExtractBalance, 2000);
    setTimeout(tryExtractBalance, 5000);
  });
}

// 定期重试（页面可能 SPA 渲染）
setInterval(tryExtractBalance, 10000);
</script>
</body>
</html>`;
  }
}
