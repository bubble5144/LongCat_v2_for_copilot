import * as vscode from 'vscode';
import { getStoredVisionConfig } from './config';

export interface VisionService {
  get(): Promise<VisionDescriber>;
  openConfiguration(): Promise<void>;
}

export interface VisionDescriber {
  describeImages(
    imageParts: vscode.LanguageModelDataPart[],
    nonImageParts: any[],
    token: vscode.CancellationToken,
  ): Promise<{ text: string; visionModelId?: string }>;
}

export function createVisionService(context: vscode.ExtensionContext): VisionService {
  return {
    get: async () => createDescriber(context),
    openConfiguration: async () => {
      const { configureVisionProxy } = await import('./config');
      await configureVisionProxy(context);
    },
  };
}

async function createDescriber(context: vscode.ExtensionContext): Promise<VisionDescriber> {
  const config = getStoredVisionConfig(context);

  if (!config.source) {
    return { describeImages: async () => ({ text: '' }) };
  }

  if (config.source === 'vscode' && config.vscodeModelId) {
    return createVsCodeDescriber(config.vscodeModelId);
  }

  if (config.source === 'endpoint' && config.endpointUrl && config.endpointModelId) {
    return createEndpointDescriber(context, config.endpointUrl, config.endpointModelId);
  }

  return { describeImages: async () => ({ text: '' }) };
}

function createVsCodeDescriber(modelId: string): VisionDescriber {
  return {
    describeImages: async (_imageParts, _nonImageParts, token) => {
      try {
        const models = await vscode.lm.selectChatModels({ id: modelId });
        const model = models[0];
        if (!model) return { text: '' };

        const messages = [
          vscode.LanguageModelChatMessage.User(
            'Describe all image attachments in this message in detail.\n\n' +
            'If there is one image, describe it directly.\n' +
            'If there are multiple images:\n' +
            '1. Describe each image separately, preserving their order.\n' +
            '2. Then provide a combined description explaining the overall context and relationships across the images.\n\n' +
            'Return one concise factual description suitable for inserting into a text-only chat prompt. ' +
            'Include visible text, objects, UI elements, people, and relevant context. Do not invent details.',
            'user',
          ),
        ];

        const result = await model.sendRequest(messages, {}, token);
        let text = '';
        for await (const chunk of result.stream) {
          if (chunk instanceof vscode.LanguageModelTextPart) {
            text += chunk.value;
          }
        }
        return { text, visionModelId: modelId };
      } catch {
        return { text: '' };
      }
    },
  };
}

function createEndpointDescriber(
  context: vscode.ExtensionContext,
  url: string,
  modelId: string,
): VisionDescriber {
  return {
    describeImages: async (imageParts, _nonImageParts, token) => {
      try {
        const apiKey = await context.secrets.get('longcat-copilot.visionApiKey');
        if (!apiKey) return { text: '' };

        const images = imageParts.map((p) => ({
          type: 'image_url',
          image_url: { url: `data:${(p as any).mimeType};base64,${Buffer.from(p.data).toString('base64')}` },
        }));

        const body = {
          model: modelId,
          messages: [{ role: 'user', content: [{ type: 'text', text: 'Describe these images in detail.' }, ...images] }],
          max_tokens: 1024,
        };

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
          signal: token.isCancellationRequested ? AbortSignal.timeout(0) : undefined,
        });

        if (!response.ok) return { text: '' };
        const data = (await response.json()) as Record<string, unknown>;
        const choices = data.choices as Array<Record<string, unknown>> | undefined;
        const message = choices?.[0]?.message as Record<string, unknown> | undefined;
        return { text: (message?.content as string) ?? '', visionModelId: modelId };
      } catch {
        return { text: '' };
      }
    },
  };
}
