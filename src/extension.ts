// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import PlaygroundWebViewProvider from "./playgroundWebViewProvider";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "playground-readme-editor" is now active!'
  );

  const provider = new PlaygroundWebViewProvider(context.extensionUri);

  // Create the webview provider.
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      PlaygroundWebViewProvider.viewType,
      provider
    )
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(
      (e: vscode.TextDocumentChangeEvent) => {
        console.log("Document changed.");
        console.log(e.document.isDirty);
      }
    )
  );

  //older stuff
  //   context.subscriptions.push(
  //     vscode.commands.registerCommand("playground-readme-editor.open", () => {
  //       const editor = vscode.window.activeTextEditor;
  //       let documentText = "";
  //       if (editor) {
  //         documentText = editor.document.getText();
  //       }

  //       // Create and show a new webview
  //       const panel = vscode.window.createWebviewPanel(
  //         "wpPlaygroundReadMeEditor", // Identifies the type of the webview. Used internally
  //         "Editing Readme", // Title of the panel displayed to the user
  //         vscode.ViewColumn.Active, // Editor column to show the new webview panel in.
  //         {
  //           enableScripts: true,
  //           retainContextWhenHidden: true,
  //         } // Webview options. More on these later.
  //       );

  //       // And set its HTML content
  //       panel.webview.html = getWebviewContent(documentText);

  //       // Handle messages from the webview
  //       panel.webview.onDidReceiveMessage(
  //         (message) => {
  //           console.log(message.text, editor);
  //           // vscode.window.showInformationMessage('message');
  //           // if ( editor ) {
  //           // editor.edit((selectedText) => {
  //           // 	selectedText.replace(editor.selection, 'THIS IS THE TEXT THAT SHOULD COME FROM THE PLAYGROUND');
  //           // });
  //           // }
  //         },
  //         undefined,
  //         context.subscriptions
  //       );
  //     })
  //   );

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  // const disposable = vscode.commands.registerCommand('playground-readme-editor.helloWorld', () => {
  // 	// The code you place here will be executed every time your command is executed
  // 	// Display a message box to the user
  // 	vscode.window.showInformationMessage('Hello World from playground-readme-editor!');
  // });

  // context.subscriptions.push(disposable);
}

function getWebviewContent(initialValue: string) {
  return `
	<script>
	const vscode = acquireVsCodeApi();
		window.addEventListener(
  			"message",
  			(event) => {
				console.log( 'message', event );
				vscode.postMessage(event.data)
			},
		);
	</script>
	<iframe width="100%" height="1000px" src="https://playground.wordpress.net/?mode=seamless#${encodeURI(
    JSON.stringify(makePlaygroundBlueprint(initialValue))
  )}"></iframe>`;
}

function makePlaygroundBlueprint(
  initialValue: string,
  initialFormat: string = "markdown"
) {
  return {
    login: true,
    landingPage: "/wp-admin/post-new.php?post_type=post",
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
					wp.data.subscribe(() => {
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

// This method is called when your extension is deactivated
export function deactivate() {}
