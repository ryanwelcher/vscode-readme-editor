// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import PlaygroundWebViewProvider from './playgroundWebViewProvider.js';
// @ts-ignore
import { runCLI } from '@wp-playground/cli';
// @ts-ignore
import { login } from '@wp-playground/blueprints';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  const provider = new PlaygroundWebViewProvider(context.extensionUri);
  // Object to store saved versions of files.

  // Add a button to show the markdown editor
  // context.subscriptions.push(
  //   vscode.commands.registerCommand('playground-readme-editor.open', () => {
  //     vscode.commands.executeCommand(
  //       'workbench.view.extension.wordpress-playground-readme-editor'
  //     );
  //   })
  // );

  // Create the webview provider.
  // context.subscriptions.push(
  //   vscode.window.registerWebviewViewProvider(
  //     PlaygroundWebViewProvider.viewType,
  //     provider,
  //     {
  //       webviewOptions: {
  //         retainContextWhenHidden: true,
  //       },
  //     }
  //   )
  // );

  // Refresh Playground when a new file is opened.
  // context.subscriptions.push(
  //   vscode.workspace.onDidCloseTextDocument((e: vscode.TextDocument) => {
  //     if (!vscode.window.visibleTextEditors.length) {
  //       provider.resetBlockEditorText();
  //     }
  //   })
  // );

  // context.subscriptions.push(
  //   vscode.window.onDidChangeActiveTextEditor(
  //     (e: vscode.TextEditor | undefined) => {
  //       if (e) {
  //         provider.refreshPlayground(e?.document);
  //       }
  //     }
  //   )
  // );

  // context.subscriptions.push(
  //   vscode.workspace.onDidChangeTextDocument(
  //     (e: vscode.TextDocumentChangeEvent) => {
  //       provider.refreshPlayground(e?.document);
  //     }
  //   )
  // );

  // Add a new command to show the block editor preview to the side
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'playground-readme-editor.openPreviewToSide',
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showInformationMessage('No active editor');
          return;
        }
        // Reuse your webview HTML generation logic
        const provider = new PlaygroundWebViewProvider(context.extensionUri);

        const panel = vscode.window.createWebviewPanel(
          'blockEditorPreview',
          'Block Editor Preview',
          vscode.ViewColumn.Beside,
          {
            enableScripts: true,
            localResourceRoots: [context.extensionUri],
          }
        );

        // panel.webview.html = provider.getLocalFile('webview.html');

        // Load playground
        //
        const cli = await runCLI({
          command: 'server',
          port: 8889,
        });

        const handler = cli.requestHandler;
        const php = await handler.getPrimaryPhp();

        // Login to the admin page.
        await login(php, {
          username: 'admin',
        });

        const contents = provider
          .getLocalFile('webview.html')
          .replaceAll('{$playgroundURL}', 'http://127.0.0.1:8889/');

        panel.webview.html = contents;

        // Close the Playground server
        panel.onDidDispose(
          () => {
            vscode.window.showInformationMessage('Closing connection');
            // Handle user closing panel before the 5sec have passed
            cli.server.close();
          },
          null,
          context.subscriptions
        );
      }
    )
  );
}

// This method is called when your extension is deactivated
export function deactivate() {}
