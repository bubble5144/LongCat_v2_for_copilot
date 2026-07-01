import * as vscode from 'vscode';
import type { AuthManager } from '../../auth';
import { isOfficialLongCatBaseUrl } from '../../endpoint';

/**
 * BalanceCurrencyResolver — stub.
 * LongCat currently does not expose a public balance API.
 * Session usage tracking is handled by provider/pricing/local-estimator.ts.
 */
export class BalanceCurrencyResolver {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_context: vscode.ExtensionContext, _authManager: AuthManager, _onDidChangeCurrency: () => void) {}

  getDisplayCurrency(): string | undefined {
    return undefined; // Token-based platform, no currency
  }

  refreshInBackground(): void {}
  async invalidate(): Promise<void> {}
}
