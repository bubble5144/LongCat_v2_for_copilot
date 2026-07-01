import * as vscode from 'vscode';

function isZh(): boolean {
  const lang = vscode.env.language.toLowerCase();
  return lang === 'zh-cn';
}

// ── English ──
const en: Record<string, string> = {
  // Model descriptions
  'model.longcat-2.0.detail': 'High-performance Agentic model',
  'model.longcat-2.0.tooltip': 'Meituan LongCat 2.0 — high-performance Agentic model with 1M context, thinking mode, and tool calling.',

  // API Key
  'auth.apiKeyRequiredDetail': 'Please configure your LongCat API Key first',
  'auth.prompt': 'Enter your LongCat API Key. Create one at longcat.chat/platform/api_keys',
  'auth.placeholder': 'ak-...',
  'auth.emptyValidation': 'API Key cannot be empty',
  'auth.saved': 'LongCat API Key saved to OS keychain.',
  'auth.removed': 'LongCat API Key removed.',
  'auth.notConfigured': 'LongCat API Key not configured. Run "LongCat: Set API Key" from the Command Palette.',

  // Thinking Effort
  'status.thinking': 'Thinking',
  'thinking.none': 'Off',
  'thinking.none.desc': 'Disable thinking for faster responses',
  'thinking.high': 'On',
  'thinking.high.desc': 'Recommended for daily use',
  'thinking.max': 'On (Max)',
  'thinking.max.desc': 'Max thinking for complex agent tasks',

  // Vision
  'vision.proxyUsing': 'Vision proxy: {0}',
  'vision.notFound': 'Vision model "{0}" not found',
  'vision.unavailable': 'No vision model available; images will be ignored.',
  'vision.proxyError': 'Vision proxy error: ',
  'vision.action.configureProxy': 'Configure Vision Proxy',

  // Extension lifecycle
  'extension.welcomeFailed': 'Failed to show LongCat walkthrough',
  'extension.activateFailed': 'Failed to activate LongCat extension',
  'extension.deactivateFailed': 'Failed to deactivate LongCat extension',
  'extension.openRequestDumpsFolderFailed': 'Failed to open request dumps folder',

  // Request errors
  'request.toolsLimitExceeded': 'Too many tools ({1}) for LongCat. Maximum is {0}. Disable unused tools via "Chat: Configure Tools".',
  'request.preflightRoundLimitExceeded': 'Tool activation preflight exceeded maximum rounds ({0}).',

  // Notices
  'notice.toolDrift': '**Tools list may be unstable.** The next round may receive a different tool set, affecting context cache hit rate. [Learn more](command:longcat-copilot.showLogs)',
  'notice.visionProxyMissing': '**No vision model configured.** Image attachments cannot be described. [Configure vision proxy]({0})',
  'notice.visionProxyFailure': '**Vision proxy failed.** {0}. [Configure]({1}) · [Show logs]({2})',

  // Usage
  'usage.panelTitle': 'LongCat Usage Details',
  'usage.refreshBtn': '↻ Refresh',
  'usage.loading': 'Loading...',
  'usage.errorNoKey': 'No API Key set. Please set your LongCat API Key first.',
  'usage.fetchError': 'Failed to fetch data',
  'usage.balTopUpLabel': 'Session tokens',
  'usage.balGrantLabel': 'Reference cost',
  'usage.balStatusLabel': 'Model',
  'usage.usageTitle': 'Usage Data',
  'usage.usageDesc1': 'LongCat does not provide a usage query API. Detailed usage is not available here.',
  'usage.usageDesc2': 'Please visit the LongCat console to view detailed usage.',
  'usage.usageLink': '→ Open longcat.chat/platform/usage',
  'usage.pricingTitle': '💰 Pricing',
  'usage.pricingUnit': 'Unit: ¥ / 1M tokens · Data as of ',
  'usage.pricingHModel': 'Model',
  'usage.pricingHInputCache': 'Input (cached)',
  'usage.pricingHInput': 'Input',
  'usage.pricingHOutput': 'Output',
  'usage.pricingFootnote': '💡 LongCat 2.0 — Token-based balance. Prices above are for reference only.',
  'usage.modelsTitle': '🧠 Available Models',
  'usage.modelsLoading': 'Loading models...',
  'usage.statusNotLoggedIn': 'LongCat: not logged in',
  'usage.statusClickToLogin': 'Click to set LongCat API Key',
  'usage.qpRefresh': '$(sync) Refresh',
  'usage.qpDetails': '$(file-text) View Details',
  'usage.qpDetailsDesc': 'Open usage details panel',
  'usage.qpOpenUsage': '$(globe) Open Usage Page',
  'usage.qpResetKey': '$(key) Set API Key',
  'usage.qpClearKey': '$(sign-out) Clear API Key',
  'usage.qpPlaceholder': 'LongCat Usage — select action',
  'usage.msgRefreshed': 'LongCat usage refreshed',
  'usage.msgKeySaved': 'LongCat API Key saved',
  'usage.msgKeyCleared': 'LongCat API Key cleared',
  'usage.balanceNotAvailable': 'LongCat: Usage tracking not available',
};

// ── 简体中文 ──
const zh: Record<string, string> = {
  'model.longcat-2.0.detail': '高性能 Agentic 模型',
  'model.longcat-2.0.tooltip': '美团 LongCat 2.0——高性能 Agentic 模型，1M 上下文、思考模式、工具调用。',

  'auth.apiKeyRequiredDetail': '请先配置 LongCat API Key',
  'auth.prompt': '请输入 LongCat API Key。在 longcat.chat/platform/api_keys 创建',
  'auth.placeholder': 'ak-...',
  'auth.emptyValidation': 'API Key 不能为空',
  'auth.saved': 'LongCat API Key 已安全保存。',
  'auth.removed': 'LongCat API Key 已移除。',
  'auth.notConfigured': 'LongCat API Key 未配置，请在命令面板运行 "LongCat: 设置 API Key"。',

  'status.thinking': '思考模式',
  'thinking.none': '停用',
  'thinking.none.desc': '停用思考，响应更快',
  'thinking.high': '开启',
  'thinking.high.desc': '推荐日常使用',
  'thinking.max': '深度',
  'thinking.max.desc': '深度推理，适合复杂任务',

  'vision.proxyUsing': '视觉代理：{0}',
  'vision.notFound': '未找到视觉模型 "{0}"',
  'vision.unavailable': '无可用视觉模型，图片已忽略。',
  'vision.proxyError': '视觉代理异常：',
  'vision.action.configureProxy': '配置视觉代理',

  'extension.welcomeFailed': 'LongCat 引导页面显示失败',
  'extension.activateFailed': 'LongCat 扩展激活失败',
  'extension.deactivateFailed': 'LongCat 扩展停用失败',
  'extension.openRequestDumpsFolderFailed': '无法打开请求转储目录',

  'request.toolsLimitExceeded': '工具数量 ({1}) 超过 LongCat 上限 ({0})。请通过 "Chat: Configure Tools" 禁用不常用的工具。',
  'request.preflightRoundLimitExceeded': '工具预激活轮次超出上限 ({0})。',

  'notice.toolDrift': '**工具列表可能不稳定。** 下一轮的工具集合可能与当前不同，影响上下文缓存命中率。[了解更多](command:longcat-copilot.showLogs)',
  'notice.visionProxyMissing': '**未配置视觉模型。** 图片附件无法被描述。[配置视觉代理]({0})',
  'notice.visionProxyFailure': '**视觉代理失败。** {0}。[配置]({1}) · [查看日志]({2})',

  'usage.panelTitle': 'LongCat 用量详情',
  'usage.refreshBtn': '↻ 刷新',
  'usage.loading': '正在获取数据…',
  'usage.errorNoKey': '未设置 API Key，请先设置 LongCat API Key。',
  'usage.fetchError': '获取数据失败',
  'usage.balTopUpLabel': '本会话 Token',
  'usage.balGrantLabel': '参考费用',
  'usage.balStatusLabel': '模型',
  'usage.usageTitle': '用量数据',
  'usage.usageDesc1': 'LongCat 不提供用量查询 API，无法在此显示详细用量。',
  'usage.usageDesc2': '请前往 LongCat 控制台查看。',
  'usage.usageLink': '→ 打开 longcat.chat/platform/usage',
  'usage.pricingTitle': '💰 模型定价',
  'usage.pricingUnit': '单位：¥ / 1M tokens · 数据更新于 ',
  'usage.pricingHModel': '模型',
  'usage.pricingHInputCache': '输入（缓存命中）',
  'usage.pricingHInput': '输入',
  'usage.pricingHOutput': '输出',
  'usage.pricingFootnote': '💡 LongCat 2.0 以 Token 为计价单位。以上价格为参考。',
  'usage.modelsTitle': '🧠 可用模型',
  'usage.modelsLoading': '加载模型中…',
  'usage.statusNotLoggedIn': 'LongCat: 未登录',
  'usage.statusClickToLogin': '点击设置 LongCat API Key',
  'usage.qpRefresh': '$(sync) 刷新',
  'usage.qpDetails': '$(file-text) 查看详情',
  'usage.qpDetailsDesc': '打开用量详情面板',
  'usage.qpOpenUsage': '$(globe) 打开用量页面',
  'usage.qpResetKey': '$(key) 设置 API Key',
  'usage.qpClearKey': '$(sign-out) 清除 API Key',
  'usage.qpPlaceholder': 'LongCat 用量追踪 — 选择操作',
  'usage.msgRefreshed': 'LongCat 用量已刷新',
  'usage.msgKeySaved': 'LongCat API Key 已保存',
  'usage.msgKeyCleared': 'LongCat API Key 已清除',
  'usage.balanceNotAvailable': 'LongCat: 用量追踪暂不可用',
};

export function t(key: string, ...args: string[]): string {
  const strings = isZh() ? zh : en;
  let value = strings[key];
  if (value === undefined) {
    return key;
  }
  for (let i = 0; i < args.length; i++) {
    value = value.replace(`{${i}}`, args[i]);
  }
  return value;
}
