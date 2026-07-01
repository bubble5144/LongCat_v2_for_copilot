/**
 * Shared types for the LongCat Copilot extension.
 */

import type * as vscode from 'vscode';

/** A registered LongCat model definition. */
export interface LongCatModel {
  id: string;
  name: string;
  family: string;
  version: string;
  detail: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  capabilities: {
    toolCalling: number;
    imageInput: boolean;
    thinking: boolean;
  };
  /** Whether `thinking` requires an explicit param (DeepSeek-style). */
  requiresThinkingParam: boolean;
  pricing?: {
    /** Per-1M-tokens prices in CNY (LongCat platform uses Token-based balance). */
    prompt: number;
    completion: number;
    cachedTokens: number;
  };
  priceCategory?: 'low' | 'medium' | 'high';
}

/** The onUsage callback payload from the streaming client. */
export interface StreamUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  completion_tokens_details?: {
    reasoning_tokens?: number;
  };
  prompt_tokens_details?: {
    cached_tokens?: number;
  };
  prompt_cache_hit_tokens?: number;
}
