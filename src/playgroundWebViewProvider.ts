import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
class PlaygroundWebViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "wordpress-playground-readme-editor";

  private _view?: vscode.WebviewView;
  private _activeDoc?: vscode.TextDocument;
  private _canEdit: boolean = false;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  private _allowedLangs = ["markdown"];

  public refreshPlayground(evt: vscode.TextDocument | undefined) {
    if (evt) {
      this._activeDoc = evt;
      this._canEdit = this._allowedLangs.includes(this._activeDoc.languageId);
      if (this._view) {
        this._view.webview.postMessage({
          command: "setEditorContent",
          format: "markdown",
          text: this._canEdit
            ? this._activeDoc.getText()
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

    const documentText = this._canEdit
      ? this?._activeDoc?.getText()
      : `## ${this?._activeDoc?.languageId} files are not supported`;

    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(documentText || "");

    webviewView.webview.onDidReceiveMessage(async (message) => {
      // Retrieve the active editor every time as it may have changed.

      // console.log(message);
      const editor = vscode.window.activeTextEditor;
      if (editor && this._canEdit) {
        // documentText = editor.document.getText();
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
    });
  }

  /**
   * Retrieves the markup content.
   * @returns string
   */
  private _getHTMLFile(): string {
    const filePath: vscode.Uri = vscode.Uri.file(
      path.join(this._extensionUri.path, "src", "webview.html")
    );
    return fs.readFileSync(filePath.fsPath, "utf8");
  }

  /**
   * Generate the webview content.
   * @param string content
   * @returns
   */
  private _getHtmlForWebview(content: string): string {
    const contents = this._getHTMLFile();

    // replace the content;
    return contents
      .replaceAll("${content}", content)
      .replaceAll(
        "${playgroundOptions}",
        encodeURI(JSON.stringify(this.makePlaygroundBlueprint(content)))
      );
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
    initialFormat: string = "markdown"
  ) {
    return {
      login: true,
      landingPage: "/wp-admin/post.php?post=1&action=edit",
      preferredVersions: {
        wp: "nightly",
        php: "8.0",
      },
      steps: [
        {
          step: "mkdir",
          path: "/wordpress/wp-content/plugins/playground-editor",
        },
        {
          step: "installPlugin",
          pluginZipFile: {
            resource: "url",
            url: "https://github-proxy.com/proxy/?repo=dmsnell/blocky-formats",
          },
          options: {
            activate: false,
          },
        },
        {
          step: "mv",
          fromPath: "/wordpress/wp-content/plugins/blocky-formats-trunk",
          toPath: "/wordpress/wp-content/plugins/blocky-formats",
        },
        {
          step: "activatePlugin",
          pluginPath: "blocky-formats/blocky-formats.php",
        },
        {
          step: "writeFile",
          path: "/wordpress/wp-content/plugins/playground-editor/script.js",
          data: `
    
                function waitForDOMContentLoaded() {
                    return new Promise((resolve) => {
                        if (
                            document.readyState === 'complete' ||
                            document.readyState === 'interactive'
                        ) {
                            resolve();
                        } else {
                            document.addEventListener('DOMContentLoaded', resolve);
                        }
                    });
                }
    
                await import('../blocky-formats/vendor/commonmark.min.js');
                const { markdownToBlocks, blocks2markdown } = await import('../blocky-formats/src/markdown.js');
                const formatConverters = {
                    markdown: {
                        toBlocks: markdownToBlocks,
                        fromBlocks: blocks2markdown
                    }
                };
    
                function populateEditorWithFormattedText(text, format) {
                    if(!(format in formatConverters)) {
                        throw new Error('Unsupported format');
                    }
    
                    const createBlocks = blocks => blocks.map(block => wp.blocks.createBlock(block.name, block.attributes, createBlocks(block.innerBlocks)));
                    const rawBlocks = formatConverters[format].toBlocks(text);
    
                    window.wp.data
                        .dispatch('core/block-editor')
                        .resetBlocks(createBlocks(rawBlocks))
                }
    
                function pushEditorContentsToParent(format) {
                    const blocks = wp.data.select('core/block-editor').getBlocks();
                    window.parent.postMessage({
                        command: 'playgroundEditorTextChanged',
                        format: format,
                        text: formatConverters[format].fromBlocks(blocks),
                        type: 'relay'
                    }, '*');
                }

                function pushSaveEvent() {
                  window.parent.postMessage(
                    {
                      command: 'saveOccurred',
                      type: 'relay'
                    },
                    '*'
                  );
                }
    
                // Accept commands from the parent window
                window.addEventListener('message', (event) => {
                    if(typeof event.data !== 'object') {
                        return;
                    }
                    
                    const { command, format, text } = event.data;
                    lastKnownFormat = format;
    
                    if(command === 'setEditorContent') {
                        populateEditorWithFormattedText(text, format);
                    } else if(command === 'getEditorContent') {
                        const blocks = wp.data.select('core/block-editor').getBlocks();
                        window.parent.postMessage({
                            command: 'playgroundEditorTextChanged',
                            format: format,
                            text: formatConverters[format].fromBlocks(blocks),
                            type: 'relay'
                        }, '*');
                    }
                });
    
                // Populate the editor with the initial value
                let lastKnownFormat = ${JSON.stringify(initialFormat)};
                waitForDOMContentLoaded().then(() => {
                    // @TODO: Don't do timeout.
                    //        Instead, populate the editor immediately after it's ready.
                    setTimeout(() => {
                        populateEditorWithFormattedText(
                            ${JSON.stringify(initialValue)},
                            lastKnownFormat
                        );
    
                        const debouncedPushEditorContents = debounce(pushEditorContentsToParent, 600);
                        let previousBlocks = undefined;
                        let subscribeInitialized = false;
                        let isSaving = false;
                        wp.data.subscribe(() => {
                            // if ( isSaving !== wp.data.select('core/editor').isSavingPost() ) {
                            //    pushSaveEvent();
                            //    return;
                            // }

                             if(previousBlocks === undefined) {
                                 previousBlocks = wp.data.select('core/block-editor').getBlocks();
                                 return;
                             }
                             const currentBlocks = wp.data.select('core/block-editor').getBlocks();
                             if (previousBlocks !== currentBlocks) {
                                 debouncedPushEditorContents(lastKnownFormat);
                                 previousBlocks = currentBlocks;
                             }
                         });
                    }, 500)
    
                    // Experiment with sending the updated value back to the parent window
                    // when typing. Debounce by 600ms.
                    function debounce(func, wait) {
                        let timeout;
                        return function(...args) {
                            const context = this;
                            clearTimeout(timeout);
                            timeout = setTimeout(() => func.apply(context, args), wait);
                        };
                    }
                });
                `,
        },
        {
          step: "writeFile",
          path: "/wordpress/wp-content/plugins/playground-editor/index.php",
          data: `<?php
    /**
    * Plugin Name: Playground Editor
    * Description: A simple plugin to edit rich text formats in Gutenberg.
    */
    // Disable welcome panel every time a user accesses the editor
    function disable_gutenberg_welcome_on_load() {
    if (is_admin()) {
    update_user_meta(get_current_user_id(), 'show_welcome_panel', 0);
    remove_action('enqueue_block_editor_assets', 'wp_enqueue_editor_tips');
    }
    }
    add_action('admin_init', 'disable_gutenberg_welcome_on_load');

    // Changes to clean up the interface/.
    function remove_title_support() {
          remove_post_type_support( 'post', 'title' );
          remove_post_type_support( 'post', 'thumbnail' );
          wp_update_post( array( 'ID' => 1, 'post_content' => '' ) );
    }
    add_action( 'init', 'remove_title_support' );
    
    function enqueue_script() {
        wp_enqueue_script( 'playground-editor-script', plugin_dir_url( __FILE__ ) . 'script.js', array( 'jquery' ), '1.0', true );
    }
    add_action( 'admin_init', 'enqueue_script' );
    
    // Set script attribute to module
    add_filter('script_loader_tag', function($tag, $handle, $src) {
    if ($handle === 'playground-editor-script') {
        $tag = '<script type="module" src="' . esc_url($src) . '">'.'<'.'/script>';
    }
    return $tag;
    }, 10, 3);
                `,
        },
        {
          step: "activatePlugin",
          pluginPath: "playground-editor/index.php",
        },
      ],
    };
  }
}

export default PlaygroundWebViewProvider;
