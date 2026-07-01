import * as vscode from 'vscode';

/**
 * Vision proxy configuration entry point.
 * Simplified: just select which Copilot Chat model to use for image description.
 */
export async function configureVisionProxy(context: vscode.ExtensionContext): Promise<void> {
  const config = getVisionConfig();

  // Get all available Copilot Chat models
  try {
    const models = await vscode.lm.selectChatModels({});

    if (models.length === 0) {
      await vscode.window.showWarningMessage(
        'No Copilot Chat models found. Install a model that supports image input.',
      );
      return;
    }

    const picked = await vscode.window.showQuickPick(
      models.map((m) => ({
        label: m.name,
        description: m.id,
        id: m.id,
      })),
      { placeHolder: 'Select a vision model for image description', title: 'LongCat Vision Proxy' },
    );

    if (!picked) return;

    config.source = 'vscode';
    config.vscodeModelId = picked.id;

    await saveVisionConfig(context, config);
    await vscode.window.showInformationMessage(`视觉代理已配置: ${picked.label}`);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to list VS Code models: ${error}`);
  }
}

// ── Config persistence ──

interface VisionConfig {
  source?: 'vscode' | 'endpoint';
  vscodeModelId?: string;
  endpointUrl?: string;
  endpointModelId?: string;
}

function getVisionConfig(): VisionConfig {
  const config = vscode.workspace.getConfiguration('longcat-copilot');
  return config.get<VisionConfig>('visionProxy') ?? {};
}

async function saveVisionConfig(
  _context: vscode.ExtensionContext,
  config: VisionConfig,
): Promise<void> {
  const workspaceConfig = vscode.workspace.getConfiguration('longcat-copilot');
  await workspaceConfig.update('visionProxy', config, vscode.ConfigurationTarget.Global);
}

export function getStoredVisionConfig(_context?: vscode.ExtensionContext): VisionConfig {
  return getVisionConfig();
}
