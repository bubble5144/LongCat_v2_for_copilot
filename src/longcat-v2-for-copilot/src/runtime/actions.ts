import * as vscode from 'vscode';
import { setErrorActionUrl } from '../client';
import { CONFIGURE_API_KEY_URI_PATH, SHOW_LOGS_URI_PATH, SET_VISION_MODEL_URI_PATH } from '../consts';
import { logger } from '../logger';
import { setProviderNoticeShowLogsUrl, setVisionProxyConfigurationUrl } from '../provider/tools/notices';

interface Action {
  key?: string;
  path: string;
  handle: () => any;
  resolveFailureMessage: string;
  setUrl?: (url: string) => void;
}

const ACTION_URLS: Action[] = [
  {
    key: 'configureApiKey',
    path: CONFIGURE_API_KEY_URI_PATH,
    handle: () => vscode.commands.executeCommand('longcat-copilot.setApiKey'),
    resolveFailureMessage: 'Failed to resolve LongCat set API key URI',
  },
  {
    key: 'showLogs',
    path: SHOW_LOGS_URI_PATH,
    handle: () => logger.show(),
    resolveFailureMessage: 'Failed to resolve LongCat show logs URI',
    setUrl: setProviderNoticeShowLogsUrl,
  },
  {
    path: SET_VISION_MODEL_URI_PATH,
    handle: () => vscode.commands.executeCommand('longcat-copilot.setVisionModel'),
    resolveFailureMessage: 'Failed to resolve LongCat set vision model URI',
    setUrl: setVisionProxyConfigurationUrl,
  },
];

export function registerActionUrls(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.window.registerUriHandler({
      handleUri(uri: vscode.Uri) {
        const action = ACTION_URLS.find((item) => item.path === uri.path);
        if (action) {
          void Promise.resolve(action.handle()).catch((error) => {
            logger.warn(`Failed to handle LongCat URI action: ${uri.path}`, error);
          });
          return;
        }
        logger.warn(`Unhandled LongCat URI: ${uri.toString(true)}`);
      },
    }),
  );

  for (const action of ACTION_URLS) {
    resolveActionUrl(context, action);
  }
}

function resolveActionUrl(context: vscode.ExtensionContext, action: Action): void {
  const rawUri = vscode.Uri.from({
    scheme: vscode.env.uriScheme,
    authority: context.extension.id,
    path: action.path,
  });
  setActionUrl(action, rawUri.toString());
  void vscode.env.asExternalUri(rawUri).then(
    (uri) => setActionUrl(action, uri.toString()),
    (error) => logger.warn(action.resolveFailureMessage, error),
  );
}

function setActionUrl(action: Action, url: string): void {
  if (action.key) setErrorActionUrl(action.key, url);
  action.setUrl?.(url);
}
