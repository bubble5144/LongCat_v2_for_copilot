import * as vscode from 'vscode';

export async function initializeDiagnostics(_context: vscode.ExtensionContext): Promise<void> {
  // Output channel is created lazily by logger.ts.
  // Future: initialise request dump directory, etc.
}
