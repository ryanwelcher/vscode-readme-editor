# WordPress Playground markdown editor.

I hate writing in markdown. It's awkward.

What if you have the option to use the WordPress block editor instead to take advantage of all of the tools it provides?

Well, now you do!

Inspired by [Dennis Snell's talk at WCUS 2024](https://www.youtube.com/live/Os6TC6-drsM?feature=shared&t=11310), I created this VSCode extension that allows you to edit your markdown files directly in the block editor.

## Usage

After installing the extension, open a markdown file and look for the Open bock editor button. It's that simple!

![](https://raw.githubusercontent.com/ryanwelcher/vscode-readme-editor/refs/heads/trunk/assets/img/screenshot.png)

> See [architecture diagram](https://excalidraw.com/#json=MDFjyFT62pfXXBoC-050c,Coltk8U-WZS8AGr-KDPU7A)

## Known Issues

1. Copy and pasting into the block editor does not work. This is a limitation based on how [VSCode handles key commands and webviews](https://github.com/microsoft/vscode/issues/65452). To get around this, you can paste into the open markdown file and clean it up in the block editor.
2. Uploaded images. They don't work right now and I am not sure if they will.
