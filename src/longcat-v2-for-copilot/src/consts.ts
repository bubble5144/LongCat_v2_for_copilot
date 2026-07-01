import type { LongCatModel } from './types';

/** VS Code configuration section prefix for all extension settings. */
export const CONFIG_SECTION = 'longcat-copilot';

export const EXTERNAL_URLS = {
  longcat: {
    apiKeys: 'https://longcat.chat/platform/api_keys',
    usage: 'https://longcat.chat/platform/usage',
  },
};

/** URI path handled by this extension to reveal the output log. */
export const SHOW_LOGS_URI_PATH = '/showLogs';

/** URI path handled by this extension to open API key configuration. */
export const CONFIGURE_API_KEY_URI_PATH = '/setApiKey';

/** URI path handled by this extension to open vision model configuration. */
export const SET_VISION_MODEL_URI_PATH = '/setVisionModel';

// VS Code's internal LanguageModelChatMessageRole.System (not exposed in @types/vscode).
export const LANGUAGE_MODEL_CHAT_SYSTEM_ROLE = 3;

// ---- Secret keys ----
/** SecretStorage key for the LongCat API key. */
export const API_KEY_SECRET = 'longcat-copilot.apiKey';

/** SecretStorage key for the vision proxy endpoint API key. */
export const VISION_API_KEY_SECRET = 'longcat-copilot.visionApiKey';

/** memento key tracking whether the welcome walkthrough has been shown. */
export const WELCOME_SHOWN_KEY = 'longcat-copilot.welcomeShown';

/** globalState key for accumulated session token usage. */
export const SESSION_USAGE_KEY = 'longcat-copilot.sessionUsage';

// ---- Walkthrough ----
/** Walkthrough contribution ID (fill publisher before publish). */
export const WALKTHROUGH_ID = 'sumfish.longcat-v2-for-copilot#longcatGettingStarted';

// ---- Client ----
export const CHAT_COMPLETIONS_PATH = '/openai/v1/chat/completions';

export const OFFICIAL_LONGCAT_API_HOST = 'api.longcat.chat';

// ---- Tool calling limit ----
/** LongCat tools limit per request (OpenAI-compatible default). */
export const LONGCAT_TOOLS_LIMIT = 128;

export const ACTIVATE_TOOL_PREFIX = 'activate_';
export const PREFLIGHT_ACTIVATE_CALL_ID_PREFIX = 'longcat_preflight_activate_';
export const MAX_PREFLIGHT_ROUNDS_PER_USER_REQUEST = 3;

export const TOOL_DRIFT_NOTICE_START = '[longcat-copilot-tool-drift-notice-start]: #';
export const TOOL_DRIFT_NOTICE_END = '[longcat-copilot-tool-drift-notice-end]: #';
export const VISION_PROXY_NOTICE_START = '[longcat-copilot-vision-proxy-notice-start]: #';
export const VISION_PROXY_NOTICE_END = '[longcat-copilot-vision-proxy-notice-end]: #';

// ---- Model registry ----
/** Available LongCat models exposed through the language model provider. */
export const MODELS: LongCatModel[] = [
  {
    id: 'longcat-2.0',
    name: 'LongCat 2.0',
    family: 'longcat',
    version: 'v2',
    detail: 'High-performance Agentic model',
    maxInputTokens: 1_048_576,   // 1M context (from model endpoint context_length)
    maxOutputTokens: 131_072,    // 128K generation (from Chat API docs)
    capabilities: {
      toolCalling: LONGCAT_TOOLS_LIMIT,
      imageInput: false,          // "Text input only" per official docs
      thinking: true,             // F4 confirmed: reasoning_content support
    },
    requiresThinkingParam: true,
    pricing: {
      prompt: 2,                  // ¥2 / 1M tokens (model endpoint data)
      completion: 8,              // ¥8 / 1M tokens
      cachedTokens: 0.04,         // ¥0.04 / 1M tokens
    },
    priceCategory: 'medium',
  },
];
