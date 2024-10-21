import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export default class PlaygroundWebViewProvider
  implements vscode.WebviewViewProvider
{
  public static readonly viewType = 'wordpress-playground-readme-editor';

  private _view?: vscode.WebviewView;
  private _activeDoc?: vscode.TextDocument;
  private _canEdit: boolean = false;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  private _allowedLangs = ['markdown'];

  public resetBlockEditorText() {
    if (this._view) {
      this._view.webview.postMessage({
        command: 'setEditorContent',
        format: 'markdown',
        text: '## Please open a file',
      });
    }
  }

  public refreshPlayground(evt: vscode.TextDocument | undefined) {
    if (evt) {
      this._activeDoc = evt;
      this._canEdit = this._allowedLangs.includes(this._activeDoc.languageId);
      const docText = this._activeDoc.getText().trim();
      if (this._view) {
        this._view.webview.postMessage({
          command: 'setEditorContent',
          format: 'markdown',
          text: this._canEdit
            ? docText.length > 0
              ? docText
              : '## Insert blocks to get started'
            : `## ${this._activeDoc.languageId} files are not supported`,
        });
      }
      // Set the activeEditor to which ever one was opened/changed
      vscode.window.showTextDocument(this._activeDoc);
    }
  }

  /**
   * Revolves a webview view.
   *
   * `resolveWebviewView` is called when a view first becomes visible. This may happen when the view is
   * first loaded or when the user hides and then shows a view again.
   *
   * @return Optional thenable indicating that the view has been fully resolved.
   */
  public resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;

    const editor = vscode.window.activeTextEditor;

    if (editor) {
      this._activeDoc = editor.document;
      this._canEdit = this._allowedLangs.includes(this._activeDoc.languageId);
    }

    let documentText = '## Please open a file';
    if (this?._activeDoc?.languageId) {
      const text = this?._activeDoc?.getText().trim();
      documentText = this._canEdit
        ? text || '## Insert blocks to get started'
        : `## ${this?._activeDoc?.languageId} files are not supported`;
    }

    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(documentText || '');

    webviewView.webview.onDidReceiveMessage(async (message) => {
      // Retrieve the active editor every time as it may have changed.

      const editor = vscode.window.activeTextEditor;
      if (editor && this._canEdit) {
        if (
          message.text !== '## Please open a file' &&
          message.text !== '## Insert blocks to get started'
        ) {
          // Update the text
          editor.edit((selectedText) => {
            selectedText.replace(
              new vscode.Range(
                editor.document.lineAt(0).range.start,
                editor.document.lineAt(editor.document.lineCount - 1).range.end
              ),
              message.text
            );
          });
        }
      }
    });
  }

  /**
   * Retrieves the markup content.
   * @returns string
   */
  private _getLocalFile(fileName: string): string {
    const filePath: vscode.Uri = vscode.Uri.file(
      path.join(this._extensionUri.path, 'assets', fileName)
    );
    return fs.readFileSync(filePath.fsPath, 'utf8');
  }

  /**
   * Generate the webview content.
   * @param string content
   * @returns
   */
  private _getHtmlForWebview(content: string): string {
    const contents = this._getLocalFile('webview.html')
      // .replaceAll('${content}', content)
      .replaceAll(
        '${playgroundOptions}',
        encodeURI(JSON.stringify(this.makePlaygroundBlueprint(content)))
      );
    // replace the content;
    return contents;
  }

  /**
   * Generate the webview content.
   * @param string content
   * @returns
   */
  private _getBlueprint(): string {
    const BlueprintContents = this._getLocalFile('_playground/blueprint.json');
    return BlueprintContents;
  }

  /**
   * Build the playground configuration.
   *
   * @param string initialValue The content to be displayed
   * @param string initialFormat The format returned by the blocks.
   * @returns object
   */
  public makePlaygroundBlueprint(
    initialValue: string,
    initialFormat: string = 'markdown'
  ) {
    let pluginIndexPhpContents = this._getLocalFile(
      '_playground/playground-editor/index.php'
    );
    let scriptPluginContent = this._getLocalFile(
      '_playground/playground-editor/script.js'
    );

    const parsedInitialValue = initialValue
      .replaceAll('"', "\\'")
      .replaceAll('\n', '\\n ');
    const scriptWithVariables = `const initialFormat = '${initialFormat}'; const initialValue = "${parsedInitialValue}"; ${scriptPluginContent}`;
    const blueprint = JSON.parse(this._getBlueprint());
    blueprint.steps[4].data = scriptWithVariables;
    blueprint.steps[5].data = `${pluginIndexPhpContents}`;

    return blueprint;
  }
}
