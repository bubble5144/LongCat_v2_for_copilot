import { safeStringify } from '../json';
import { logger } from '../logger';
import type { StreamUsage } from '../types';
import { createHttpError, normalizeRequestError, type LongCatRequestError, formatRequestError } from './error';

// ── Callback interfaces ──
export interface StreamCallbacks {
  onContent: (text: string) => void;
  onThinking: (text: string) => void;
  onToolCall: (toolCall: ToolCallDelta) => void;
  onError: (error: LongCatRequestError) => void;
  onDone: () => void;
  onUsage?: (usage: StreamUsage) => void;
}

export interface ToolCallDelta {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

// ── Client ──
/**
 * Lightweight SSE-streaming LongCat API client.
 * No external dependencies — uses Node's built-in fetch.
 */
export class LongCatClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  /**
   * Stream a chat completion from the LongCat API.
   * Parses SSE chunks and dispatches callbacks for content, thinking, and tool calls.
   */
  async streamChatCompletion(
    request: Record<string, unknown>,
    callbacks: StreamCallbacks,
    cancellationToken?: { isCancellationRequested: boolean; onCancellationRequested: (cb: () => void) => { dispose: () => void } },
  ): Promise<void> {
    const controller = new AbortController();
    const cancelListener = cancellationToken?.onCancellationRequested(() => {
      controller.abort();
    });

    if (cancellationToken?.isCancellationRequested) {
      controller.abort();
    }

    try {
      // Request usage stats in streaming responses so we can calibrate token counting.
      const requestBody = {
        ...request,
        stream_options: { include_usage: true },
      };

      const endpoint = `${this.baseUrl}/openai/v1/chat/completions`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: safeStringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw await createHttpError(response, { baseUrl: this.baseUrl });
      }

      if (!response.body) {
        throw new Error('No response body received');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let latestUsage: StreamUsage | undefined;

      // Accumulate tool call deltas by index, then emit on finish_reason
      const pendingToolCalls = new Map<number, ToolCallDelta>();

      while (true) {
        if (cancellationToken?.isCancellationRequested) {
          controller.abort();
          return;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;

          if (trimmed === 'data: [DONE]') {
            // Flush any remaining tool calls
            for (const tc of pendingToolCalls.values()) {
              callbacks.onToolCall(tc);
            }
            pendingToolCalls.clear();
            reportFinalUsage(callbacks, latestUsage);
            callbacks.onDone();
            return;
          }

          if (!trimmed.startsWith('data: ')) continue;

          const jsonStr = trimmed.slice(6);
          try {
            const chunk = JSON.parse(jsonStr);
            const choice = chunk.choices?.[0];

            // Keep only the latest usage value and report it once when the stream completes.
            if (chunk.usage) {
              latestUsage = chunk.usage;
            }

            if (!choice) continue;

            // Thinking content (reasoning_content)
            const reasoning = choice.delta?.reasoning_content;
            if (reasoning) {
              callbacks.onThinking(reasoning);
            }

            // Regular content
            if (choice.delta?.content) {
              callbacks.onContent(choice.delta.content);
            }

            // Tool calls — accumulate deltas by index
            if (choice.delta?.tool_calls) {
              for (const tc of choice.delta.tool_calls) {
                let pending = pendingToolCalls.get(tc.index);
                if (!pending && tc.id) {
                  pending = {
                    id: tc.id,
                    type: 'function',
                    function: { name: '', arguments: '' },
                  };
                  pendingToolCalls.set(tc.index, pending);
                }
                if (pending) {
                  if (tc.function?.name) {
                    pending.function.name += tc.function.name;
                  }
                  if (tc.function?.arguments) {
                    pending.function.arguments += tc.function.arguments;
                  }
                }
              }
            }

            // Flush pending tool calls on finish
            if (choice.finish_reason === 'tool_calls' || choice.finish_reason === 'stop') {
              for (const tc of pendingToolCalls.values()) {
                callbacks.onToolCall(tc);
              }
              pendingToolCalls.clear();
            }
          } catch (e) {
            logger.error('Failed to parse SSE chunk:', jsonStr.slice(0, 200), e);
          }
        }
      }

      reportFinalUsage(callbacks, latestUsage);
      callbacks.onDone();
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError' && cancellationToken?.isCancellationRequested) {
        return;
      }
      const normalizedError = normalizeRequestError(error, { baseUrl: this.baseUrl });
      logger.error('LongCat request failed:', formatRequestError(normalizedError));
      callbacks.onError(normalizedError);
    } finally {
      cancelListener?.dispose();
    }
  }
}

function reportFinalUsage(callbacks: StreamCallbacks, usage?: StreamUsage): void {
  if (!usage || !callbacks.onUsage) return;
  callbacks.onUsage(usage);
}
