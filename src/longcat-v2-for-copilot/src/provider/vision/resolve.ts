import * as vscode from 'vscode';

export interface VisionResolutionResult {
  messages: vscode.LanguageModelChatMessage[];
  stats: VisionResolutionStats;
  replayMarkerMetadata: Record<string, unknown>;
  visionModelId?: string;
  visionProxySource?: string;
  initialResponseNotice?: string;
}

export interface VisionResolutionStats {
  inputImageParts: number;
  replayedImageMessages: number;
  droppedImageParts: number;
  currentImageMessages: number;
  omittedImageMessages: number;
  markerVisionTextChars: number;
}

export interface VisionDescriber {
  describeImages(
    imageParts: vscode.LanguageModelDataPart[],
    nonImageParts: any[],
    token: vscode.CancellationToken,
  ): Promise<{ text: string; visionModelId?: string }>;
}

/**
 * Resolve image messages: convert images to text descriptions via the configured vision proxy.
 * If no vision proxy is configured, images are dropped with a notice.
 */
export async function resolveImageMessages(
  messages: vscode.LanguageModelChatMessage[],
  token: vscode.CancellationToken,
  getDescriber: () => Promise<VisionDescriber>,
): Promise<VisionResolutionResult> {
  const stats: VisionResolutionStats = {
    inputImageParts: 0,
    replayedImageMessages: 0,
    droppedImageParts: 0,
    currentImageMessages: 0,
    omittedImageMessages: 0,
    markerVisionTextChars: 0,
  };

  // Count input images
  for (const msg of messages) {
    for (const part of msg.content) {
      if (part instanceof vscode.LanguageModelDataPart && part.mimeType?.startsWith('image/')) {
        stats.inputImageParts++;
      }
    }
  }

  if (stats.inputImageParts === 0) {
    return { messages, stats, replayMarkerMetadata: {} };
  }

  // Check if vision proxy is configured
  const workspaceConfig = vscode.workspace.getConfiguration('longcat-copilot');
  const config = workspaceConfig.get<{ source?: string; vscodeModelId?: string; endpointUrl?: string; endpointModelId?: string }>('visionProxy') ?? {};
  if (!config.source) {
    // No vision proxy configured — drop images and add notice
    const result: vscode.LanguageModelChatMessage[] = [];
    for (const msg of messages) {
      const nonImageParts = msg.content.filter(
        (part) => !(part instanceof vscode.LanguageModelDataPart && part.mimeType?.startsWith('image/')),
      );
      if (nonImageParts.length > 0) {
        result.push({ ...msg, content: nonImageParts });
      }
    }
    return {
      messages: result,
      stats,
      replayMarkerMetadata: {},
      initialResponseNotice: '[vision-proxy-notice] No vision proxy configured. Images were dropped.',
    };
  }

  // Vision proxy configured — describe images
  const describer = await getDescriber();
  const result: vscode.LanguageModelChatMessage[] = [];

  for (const msg of messages) {
    const imageParts: vscode.LanguageModelDataPart[] = [];
    const nonImageParts: any[] = [];

    for (const part of msg.content) {
      if (part instanceof vscode.LanguageModelDataPart && part.mimeType?.startsWith('image/')) {
        imageParts.push(part);
      } else {
        nonImageParts.push(part);
      }
    }

    if (imageParts.length === 0) {
      result.push(msg);
      continue;
    }

    stats.currentImageMessages++;
    const description = await describer.describeImages(imageParts, nonImageParts, token);

    stats.droppedImageParts += imageParts.length;
    stats.markerVisionTextChars = description.text.length;

    result.push({
      ...msg,
      content: [...nonImageParts, new vscode.LanguageModelTextPart(description.text)],
    });

    if (description.visionModelId) {
      stats.markerVisionTextChars = description.text.length;
    }
  }

  return {
    messages: result,
    stats,
    replayMarkerMetadata: { visionText: '' },
    visionModelId: config.vscodeModelId ?? config.endpointModelId,
    visionProxySource: config.source,
  };
}
