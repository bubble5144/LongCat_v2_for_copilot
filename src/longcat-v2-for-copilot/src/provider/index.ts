import * as vscode from 'vscode';
import { AuthManager } from '../auth';
import { getStabilizeToolListEnabled } from '../config';
import { MODELS } from '../consts';
import { t } from '../i18n';
import { logger } from '../logger';
import { createCacheDiagnosticsRecorder, dumpProviderInput } from './debug';
import { toChatInfo } from './models';
import { BalanceCurrencyResolver } from './pricing/currency';
import { accumulateUsage, type AccumulatedUsage } from './pricing/local-estimator';
import { prepareChatRequest } from './request';
import { classifyProviderRequest } from './routing';
import { resolveConversationSegment } from './segment';
import { streamChatCompletion, getCurrentSessionUsage, setCurrentSessionUsage } from './stream';
import { estimateTokenCount } from './tokens';
import { processToolFlow } from './tools/flow';
import { createVisionService, getStoredVisionConfig, type VisionService } from './vision';

/**
 * LongCat Chat Provider — implements vscode.LanguageModelChatProvider so
 * LongCat 2.0 appears directly in the Copilot Chat model picker.
 */
export class LongCatChatProvider implements vscode.LanguageModelChatProvider {
  private authManager: AuthManager;
  private globalStorageUri: vscode.Uri;
  private onDidChangeEmitter = new vscode.EventEmitter<void>();
  private isActive = true;
  private cacheDiagnostics = createCacheDiagnosticsRecorder();
  private vision: VisionService;
  private balanceCurrencyResolver: BalanceCurrencyResolver;
  private charsPerToken = 4.0;

  onDidChangeLanguageModelChatInformation = this.onDidChangeEmitter.event;

  constructor(context: vscode.ExtensionContext) {
    this.authManager = new AuthManager(context);
    this.globalStorageUri = context.globalStorageUri;
    this.vision = createVisionService(context);
    this.balanceCurrencyResolver = new BalanceCurrencyResolver(context, this.authManager, () => this.onDidChangeEmitter.fire());

    context.subscriptions.push(
      this.onDidChangeEmitter,
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('longcat-copilot.visionProxy') ||
            e.affectsConfiguration('longcat-copilot.baseUrl')) {
          this.refreshModelPicker();
        }
      }),
      context.secrets.onDidChange((e) => {
        if (e.key === 'longcat-copilot.apiKey') {
          this.refreshModelPicker();
        }
      }),
    );
  }

  // ── Public commands ──

  async configureApiKey(): Promise<void> {
    const saved = await this.authManager.promptForApiKey();
    if (saved) this.refreshModelPicker();
  }

  async clearApiKey(): Promise<void> {
    await this.authManager.deleteApiKey();
    this.refreshModelPicker();
    vscode.window.showInformationMessage(t('auth.removed'));
  }

  async hasApiKey(): Promise<boolean> {
    return this.authManager.hasApiKey();
  }

  refreshModelPicker(): void {
    this.onDidChangeEmitter.fire();
  }

  async prepareForDeactivate(): Promise<void> {
    this.isActive = false;
    this.onDidChangeEmitter.fire();
    try {
      await vscode.lm.selectChatModels({ vendor: 'longcat' });
    } catch (error) {
      logger.warn('Failed to refresh LongCat models during deactivate', error);
    }
  }

  async setVisionModel(): Promise<void> {
    await this.vision.openConfiguration();
  }

  // ── LanguageModelChatProvider ──

  async provideLanguageModelChatInformation(
    _options: any,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelChatInformation[]> {
    if (!this.isActive) return [];

    const hasKey = await this.authManager.hasApiKey();
    const pricingCurrency = this.balanceCurrencyResolver.getDisplayCurrency();
    const visionConfig = getStoredVisionConfig();
    const hasVisionProxy = !!visionConfig.source;

    if (hasKey) {
      this.balanceCurrencyResolver.refreshInBackground();
    }

    return MODELS.map((model) => toChatInfo(model, hasKey, pricingCurrency, hasVisionProxy));
  }

  async provideLanguageModelChatResponse(
    modelInfo: vscode.LanguageModelChatInformation,
    messages: vscode.LanguageModelChatMessage[],
    options: any,
    progress: vscode.Progress<any>,
    token: vscode.CancellationToken,
  ): Promise<void> {
    const segment = resolveConversationSegment(messages);
    const requestKind = classifyProviderRequest({ messages, tools: options.tools });

    dumpProviderInput({
      globalStorageUri: this.globalStorageUri,
      segment,
      modelInfo,
      messages,
      requestOptions: options,
      requestKind,
    });

    const toolFlow = processToolFlow({
      stabilizeToolList: getStabilizeToolListEnabled(),
      messages,
      tools: options.tools,
      progress,
      requestKind,
    });

    if (toolFlow.preflightHandled) return;

    const prepared = await prepareChatRequest({
      authManager: this.authManager,
      globalStorageUri: this.globalStorageUri,
      modelInfo,
      segment,
      messages: toolFlow.messages,
      options,
      token,
      cacheDiagnostics: this.cacheDiagnostics,
      getVisionDescriber: () => this.vision.get(),
    });

    const initialResponseNotice = joinNotices(toolFlow.initialResponseNotice, prepared.initialResponseNotice);

    return streamChatCompletion(prepared, progress, token, (acc) => {
      setCurrentSessionUsage(acc);
    });
  }

  async provideTokenCount(
    _modelInfo: vscode.LanguageModelChatInformation,
    text: string | vscode.LanguageModelChatMessage,
    token: vscode.CancellationToken,
  ): Promise<number> {
    return estimateTokenCount(text, this.charsPerToken, token);
  }
}

function joinNotices(...notices: (string | undefined)[]): string | undefined {
  const joined = notices.filter((n) => n && n.trim().length > 0).join('\n');
  return joined || undefined;
}
