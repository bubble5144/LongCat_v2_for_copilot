import * as vscode from 'vscode';
import { API_KEY_SECRET } from './consts';
import { t } from './i18n';

/**
 * Manages LongCat API key via VS Code SecretStorage (secure).
 */
export class AuthManager {
  private secretStorage: vscode.SecretStorage;

  constructor(context: vscode.ExtensionContext) {
    this.secretStorage = context.secrets;
  }

  /** Get API key from SecretStorage. */
  async getApiKey(): Promise<string | undefined> {
    const key = await this.secretStorage.get(API_KEY_SECRET);
    if (key) return key;
    return undefined;
  }

  /** Store API key in SecretStorage. */
  async setApiKey(apiKey: string): Promise<void> {
    await this.secretStorage.store(API_KEY_SECRET, apiKey.trim());
  }

  /** Delete stored API key. */
  async deleteApiKey(): Promise<void> {
    await this.secretStorage.delete(API_KEY_SECRET);
  }

  /** Check if an API key is configured. */
  async hasApiKey(): Promise<boolean> {
    const key = await this.getApiKey();
    return key !== undefined && key.length > 0;
  }

  /** Prompt user to enter API key via input box. */
  async promptForApiKey(): Promise<boolean> {
    const apiKey = await vscode.window.showInputBox({
      prompt: t('auth.prompt'),
      placeHolder: t('auth.placeholder'),
      password: true,
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value?.trim()) {
          return t('auth.emptyValidation');
        }
        return undefined;
      },
    });

    if (apiKey) {
      await this.setApiKey(apiKey);
      vscode.window.showInformationMessage(t('auth.saved'));
      return true;
    }
    return false;
  }
}
