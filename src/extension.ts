// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import PlaygroundWebViewProvider from './playgroundWebViewProvider';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  const provider = new PlaygroundWebViewProvider(context.extensionUri);
  // Object to store saved versions of files.

  // Add a button to show the markdown editor
  context.subscriptions.push(
    vscode.commands.registerCommand('playground-readme-editor.open', () => {
      vscode.commands.executeCommand(
        'workbench.view.extension.wordpress-playground-readme-editor'
      );
    })
  );

  // Create the webview provider.
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      PlaygroundWebViewProvider.viewType,
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      }
    )
  );

  // Refresh Playground when a new file is opened.
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((e: vscode.TextDocument) => {
      if (!vscode.window.visibleTextEditors.length) {
        provider.resetBlockEditorText();
      }
    })
  );

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(
      (e: vscode.TextEditor | undefined) => {
        if (e) {
          provider.refreshPlayground(e?.document);
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(
      (e: vscode.TextDocumentChangeEvent) => {
        provider.refreshPlayground(e?.document);
      }
    )
  );
}

// This method is called when your extension is deactivated
export function deactivate() {}
